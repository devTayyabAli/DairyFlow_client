import * as Network from 'expo-network';
import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  enqueueAllUserDataForSync,
  getAppSetting,
  getPendingSyncCount,
  getSyncFarmId,
  purgeDemoData,
  setAppSetting,
  setSyncFarmId,
  wipeLocalFarmData,
} from '@/db/database';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { getApiBaseUrl, getApiEndpoint, setCustomApiUrl } from './sync-config';
import {
  isNetworkConnected,
  isSyncRunning,
  onSessionExpired,
  serverHasData,
  syncNow as executeSyncNow,
} from './sync-engine';
import {
  clearAuthToken,
  clearStoredFarmProfile,
  getAuthToken,
  getLastSyncedAt,
  getStoredFarmProfile,
  setAuthToken,
  setStoredFarmProfile,
} from './sync-storage';
import { logger } from '@/utils/logger';
import {
  describeError,
  fetchWithTimeout,
  networkErrorMessage,
  serverTroubleMessage,
} from './network-errors';
import { retryDelayMs } from './retry-schedule';
import { BusinessType, FarmProfile, SyncResult, SyncStatus, UserRole } from './sync-types';

export interface AuthResult {
  success: boolean;
  error?: string;
  /**
   * Set when this phone still holds data that belongs to a different farm account. Nothing was
   * changed; call again with `replaceLocalData: true` after the user confirms.
   */
  needsConfirmation?: 'other-farm';
  /** Account exists but the email is not confirmed yet: show the OTP step for `email`. */
  needsVerification?: boolean;
  /** Registration accepted; a one-time code was emailed to `email`. */
  otpRequired?: boolean;
  email?: string;
  resendAfterSeconds?: number;
  /** Machine-readable server error code (e.g. OTP_INVALID, OTP_EXPIRED, OTP_LOCKED). */
  code?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}

export interface AuthOptions {
  replaceLocalData?: boolean;
}

export interface RegisterInput {
  farmName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  defaultMilkRate?: number;
  businessType?: BusinessType;
}

interface ServerError {
  code?: string;
  message?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}


function failure(data: { error?: ServerError } | null, fallback: string): AuthResult {
  const err = data?.error;
  return {
    success: false,
    error: err?.message || fallback,
    code: err?.code,
    attemptsLeft: err?.attemptsLeft,
    retryAfterSeconds: err?.retryAfterSeconds,
  };
}

interface SyncContextValue {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  syncNow: () => Promise<SyncResult>;
  isSignedIn: boolean;
  /** false until the saved session (token) has been read at startup; gate waits for it. */
  isSessionReady: boolean;
  /**
   * True while a phone that predates accounts is used without signing in (this launch only).
   * Turning it off sends the user back to the sign-in screen.
   */
  isOfflineMode: boolean;
  setOfflineMode: (value: boolean) => void;
  farm: FarmProfile | null;
  role: UserRole;
  businessType: BusinessType;
  isSessionExpired: boolean;
  error: string | null;
  apiUrl: string;
  updateApiUrl: (url: string) => Promise<void>;
  signIn: (email: string, password: string, options?: AuthOptions) => Promise<AuthResult>;
  /** Step 1 of signup: creates a pending account and emails a code. Does not sign in. */
  register: (data: RegisterInput) => Promise<AuthResult>;
  /** Step 2 of signup: confirms the emailed code, then signs in. */
  verifyOtp: (email: string, otp: string, options?: AuthOptions) => Promise<AuthResult>;
  resendOtp: (email: string) => Promise<AuthResult>;
  /** Emails a password-reset code. Always reports success for well-formed requests (no enumeration). */
  forgotPassword: (email: string) => Promise<AuthResult>;
  /** Sets a new password using the emailed code, then signs in. */
  resetPassword: (
    email: string,
    otp: string,
    newPassword: string,
    options?: AuthOptions
  ) => Promise<AuthResult>;
  /** Signed-in users only. Other devices are signed out by the server. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const WRITE_DEBOUNCE_MS = 3000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { reloadSettings, skipRegistration } = useAdmin();
  const { isUrdu } = useLanguage();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);
  const [isSignedIn, setIsSignedInState] = useState<boolean>(false);
  const [isSessionReady, setIsSessionReady] = useState<boolean>(false);
  const [isOfflineMode, setOfflineMode] = useState<boolean>(false);
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrlState] = useState<string>(getApiBaseUrl());

  // Mirrors isSignedIn so callbacks never act on a stale value (e.g. right after sign-in).
  const isSignedInRef = useRef<boolean>(false);
  const isUrduRef = useRef<boolean>(isUrdu);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSyncRef = useRef<() => void>(() => {});

  // Automatic retry after a failed sync (server down, timeout…): 30 s, 1 min, then every 5 min.
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef<number>(0);
  const sessionExpiredRef = useRef<boolean>(false);
  const syncNowRef = useRef<() => Promise<SyncResult>>(async () => ({ status: 'skipped' }));

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    retryAttemptRef.current = 0;
  }, []);

  const scheduleRetry = useCallback(() => {
    // Nothing to retry once signed out, or when only a new sign-in can help.
    if (!isSignedInRef.current || sessionExpiredRef.current) return;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    const delay = retryDelayMs(retryAttemptRef.current);
    retryAttemptRef.current += 1;
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      syncNowRef.current().catch(() => {});
    }, delay);
  }, []);

  const scheduleRetryRef = useRef<() => void>(() => {});
  const clearRetryRef = useRef<() => void>(() => {});

  useEffect(() => {
    scheduleRetryRef.current = scheduleRetry;
    clearRetryRef.current = clearRetry;
  }, [scheduleRetry, clearRetry]);

  // Never leave a timer running after the provider goes away.
  useEffect(() => clearRetry, [clearRetry]);

  useEffect(() => {
    isUrduRef.current = isUrdu;
  }, [isUrdu]);

  const setSignedIn = useCallback((value: boolean) => {
    isSignedInRef.current = value;
    setIsSignedInState(value);
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      setPendingCount(await getPendingSyncCount(db));
      setLastSyncedAtState(await getLastSyncedAt(db));
    } catch {
      // ignore
    }
  }, [db]);

  const syncNow = useCallback(async (): Promise<SyncResult> => {
    if (!isSignedInRef.current) {
      return { status: 'skipped', message: 'Not signed in' };
    }

    if (!(await isNetworkConnected())) {
      setStatus('offline');
      return { status: 'skipped', message: 'No internet connection' };
    }

    setStatus('syncing');
    setError(null);

    const result = await executeSyncNow(db);
    await refreshStats();

    if (result.status === 'success') {
      if (result.rejectedCount) {
        // Rejected rows were dropped from the queue; tell the user instead of hiding it.
        setStatus('error');
        setError(
          isUrduRef.current
            ? `${result.rejectedCount} تبدیلیاں سرور نے قبول نہیں کیں (${result.rejectedSample ?? ''})`
            : `${result.rejectedCount} change(s) were rejected by the server (${result.rejectedSample ?? ''})`
        );
      } else {
        setStatus('idle');
      }
    } else if (result.status === 'error') {
      const lang = isUrduRef.current ? 'ur' : 'en';
      setStatus('error');
      setError(
        result.kind === 'network'
          ? networkErrorMessage(lang)
          : result.kind === 'server'
            ? serverTroubleMessage(lang)
            : result.message || 'Sync failed'
      );
    } else {
      setStatus('idle');
    }

    // A failed attempt schedules its own retry; any success ends the back-off.
    if (result.status === 'error') scheduleRetryRef.current();
    else if (result.status === 'success') clearRetryRef.current();

    return result;
  }, [db, refreshStats]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  const scheduleSync = useCallback(() => {
    if (!isSignedInRef.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      syncNow()
        .then((res) => {
          // Local edits made while a sync was running are only queued: send them right after.
          if (res.status === 'success' && (res.appliedCount ?? 0) > 0) {
            getPendingSyncCount(db)
              .then((count) => count > 0 && scheduleSyncRef.current())
              .catch(() => {});
          }
        })
        .catch(() => {});
    }, WRITE_DEBOUNCE_MS);
  }, [db, syncNow]);

  useEffect(() => {
    scheduleSyncRef.current = scheduleSync;
  }, [scheduleSync]);

  // Shared tail of sign-in and registration.
  const completeAuth = useCallback(
    async (
      data: { token: string; farm: FarmProfile },
      options?: AuthOptions
    ): Promise<AuthResult> => {
      const previousFarmId = await getSyncFarmId(db);

      const previousUserId = await getAppSetting(db, 'sync_user_id', '');
      const nextUserId = data.farm.userId || data.farm.id;
      const differentPerson = Boolean(previousUserId && previousUserId !== nextUserId);
      if (previousFarmId && (previousFarmId !== data.farm.id || differentPerson)) {
        // This phone holds another farm's data. Pushing it into this account (and reusing the old
        // sync cursor) would mix farms, so require an explicit confirmation to start clean.
        if (!options?.replaceLocalData) {
          return {
            success: false,
            needsConfirmation: 'other-farm',
            error: isUrduRef.current
              ? 'اس فون وچ کسی ہور فارم دا ڈیٹا اے۔'
              : 'This phone still has data from a different farm.',
          };
        }
        await wipeLocalFarmData(db);
      } else if (!previousFarmId && (await serverHasData(data.token))) {
        // Restoring an existing farm onto a phone that only has the built-in demo records.
        await purgeDemoData(db);
      }

      await setAuthToken(data.token);
      await setStoredFarmProfile(data.farm);
      await setSyncFarmId(db, data.farm.id);
      await setAppSetting(db, 'sync_user_id', data.farm.userId || data.farm.id);
      setSignedIn(true);
      setFarm(data.farm);
      sessionExpiredRef.current = false;
      clearRetry();
      setIsSessionExpired(false);

      // Reflect the farm profile locally so the app shows the account's name/owner/rate.
      if (data.farm.farmName) await setAppSetting(db, 'farm_name', data.farm.farmName);
      if (data.farm.ownerName) await setAppSetting(db, 'admin_name', data.farm.ownerName);
      if (data.farm.phone) await setAppSetting(db, 'admin_phone', data.farm.phone);
      if (data.farm.defaultMilkRate) {
        await setAppSetting(db, 'default_milk_rate', String(data.farm.defaultMilkRate));
      }
      if (data.farm.businessType) {
        await setAppSetting(db, 'business_type', data.farm.businessType);
      }
      if (data.farm.role) {
        await setAppSetting(db, 'user_role', data.farm.role);
      }
      await setAppSetting(db, 'is_registered', '1');
      await reloadSettings();
      // Proving the account password is owner-level authentication: enter the app as admin
      // without asking for the local PIN right after.
      await skipRegistration();

      // Queue this phone's own (non-demo) data, then run the first two-way sync.
      await enqueueAllUserDataForSync(db);
      await refreshStats();
      syncNow().catch(() => {});

      return { success: true };
    },
    [clearRetry, db, refreshStats, reloadSettings, skipRegistration, setSignedIn, syncNow]
  );

  const postJson = useCallback(async (path: string, body: unknown) => {
    const res = await fetchWithTimeout(getApiEndpoint(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Non-JSON bodies (proxy errors, HTML) must not crash the screen.
    let data = await res.json().catch(() => null);
    if (res.status >= 500) {
      // Whatever the server said (or an HTML error page), the user only needs to know it is down.
      logger.warn(`Server error ${res.status} on ${path}`);
      data = { error: { code: 'SERVER_ERROR', message: serverTroubleMessage(isUrduRef.current ? 'ur' : 'en') } };
    }
    return { res, data };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string, options?: AuthOptions): Promise<AuthResult> => {
      try {
        const normalized = email.trim().toLowerCase();
        const { res, data } = await postJson('/auth/login', { email: normalized, password });
        if (res.status === 403 && data?.error?.code === 'EMAIL_NOT_VERIFIED') {
          return { success: false, needsVerification: true, email: normalized, error: data.error.message };
        }
        if (!res.ok) return failure(data, 'Login failed. Please check your credentials.');
        return await completeAuth(data, options);
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    [completeAuth, postJson]
  );

  const register = useCallback(
    async (formData: RegisterInput): Promise<AuthResult> => {
      try {
        const payload = { ...formData, email: formData.email.trim().toLowerCase() };
        const { res, data } = await postJson('/auth/register', payload);
        if (res.status === 202) {
          return {
            success: true,
            otpRequired: true,
            email: data?.email ?? payload.email,
            resendAfterSeconds: data?.resendAfterSeconds,
          };
        }
        return failure(data, 'Registration failed.');
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    [postJson]
  );

  const verifyOtp = useCallback(
    async (email: string, otp: string, options?: AuthOptions): Promise<AuthResult> => {
      try {
        const { res, data } = await postJson('/auth/verify-otp', {
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
        });
        if (!res.ok) return failure(data, 'Verification failed.');
        return await completeAuth(data, options);
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    [completeAuth, postJson]
  );

  const resendOtp = useCallback(
    async (email: string): Promise<AuthResult> => {
      try {
        const { res, data } = await postJson('/auth/resend-otp', { email: email.trim().toLowerCase() });
        if (res.status === 202) {
          return {
            success: true,
            otpRequired: true,
            email: email.trim().toLowerCase(),
            resendAfterSeconds: data?.resendAfterSeconds,
          };
        }
        return failure(data, 'Could not resend the code.');
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    [postJson]
  );

  const forgotPassword = useCallback(
    async (email: string): Promise<AuthResult> => {
      try {
        const normalized = email.trim().toLowerCase();
        const { res, data } = await postJson('/auth/forgot-password', { email: normalized });
        if (res.status === 202) {
          return {
            success: true,
            otpRequired: true,
            email: normalized,
            resendAfterSeconds: data?.resendAfterSeconds,
          };
        }
        return failure(data, 'Could not send the reset code.');
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    [postJson]
  );

  const resetPassword = useCallback(
    async (
      email: string,
      otp: string,
      newPassword: string,
      options?: AuthOptions
    ): Promise<AuthResult> => {
      try {
        const { res, data } = await postJson('/auth/reset-password', {
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword,
        });
        if (!res.ok) return failure(data, 'Could not reset the password.');
        return await completeAuth(data, options);
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    [completeAuth, postJson]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<AuthResult> => {
      try {
        const token = await getAuthToken();
        if (!token) return { success: false, error: 'Not signed in', code: 'NOT_SIGNED_IN' };

        const res = await fetch(getApiEndpoint('/auth/change-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) return failure(data, 'Could not change the password.');

        // The server issues a fresh token and invalidates every older one (other devices).
        if (data?.token) await setAuthToken(data.token);
        return { success: true };
      } catch (err) {
        return { success: false, error: describeError(err, isUrduRef.current ? 'ur' : 'en'), code: 'NETWORK' };
      }
    },
    []
  );

  const updateApiUrl = useCallback(
    async (newUrl: string) => {
      const clean = newUrl.trim();
      await setAppSetting(db, 'sync_api_url', clean);
      setCustomApiUrl(clean || null);
      setApiUrlState(getApiBaseUrl());
    },
    [db]
  );

  const signOut = useCallback(async () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    clearRetry();
    await clearAuthToken();
    await clearStoredFarmProfile();
    setSignedIn(false);
    setFarm(null);
    sessionExpiredRef.current = false;
    setIsSessionExpired(false);
    setStatus('idle');
    setError(null);
  }, [clearRetry, setSignedIn]);

  useEffect(() => {
    onSessionExpired(() => {
      // Retrying cannot fix an expired session; only signing in again can.
      sessionExpiredRef.current = true;
      clearRetryRef.current();
      setIsSessionExpired(true);
      setStatus('error');
      setError('Session expired. Please sign in again.');
    });
  }, []);

  // Restore saved server URL and session on mount, then sync once.
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const savedApiUrl = await getAppSetting(db, 'sync_api_url', '');
        if (savedApiUrl.trim().length > 0) {
          setCustomApiUrl(savedApiUrl.trim());
          if (isMounted) setApiUrlState(savedApiUrl.trim());
        }
      } catch {
        // ignore
      }

      const token = await getAuthToken();
      let storedFarm = await getStoredFarmProfile();
      if (token && storedFarm && !storedFarm.userId) {
        try {
          const res = await fetchWithTimeout(getApiEndpoint('/auth/me'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = (await res.json()) as { user?: { id?: string; name?: string }; role?: FarmProfile['role'] };
            storedFarm = {
              ...storedFarm,
              userId: body.user?.id,
              role: body.role || storedFarm.role,
              accountName: storedFarm.accountName || body.user?.name,
            };
            await setStoredFarmProfile(storedFarm);
            if (storedFarm.userId) await setAppSetting(db, 'sync_user_id', storedFarm.userId);
          }
        } catch {
          // The saved profile still works; the next sign-in fills in the person id.
        }
      }
      if (!isMounted) return;
      setSignedIn(Boolean(token));
      setFarm(storedFarm);
      setIsSessionReady(true);
      await refreshStats();
      if (token && isMounted) syncNow().catch(() => {});
    })();

    return () => {
      isMounted = false;
    };
  }, [db, refreshStats, setSignedIn, syncNow]);

  // Triggers while signed in: app returns to foreground, connectivity returns, local writes.
  useEffect(() => {
    if (!isSignedIn) return;

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        refreshStats();
        syncNow().catch(() => {});
      }
    });

    const networkSub = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        syncNow().catch(() => {});
      } else {
        setStatus('offline');
      }
    });

    // Every local write enqueues a row in sync_queue (via triggers), so that table is the signal.
    // Ignore our own queue clean-up while a sync is running.
    let dbSub: { remove: () => void } | null = null;
    try {
      dbSub = addDatabaseChangeListener((event) => {
        if (event.tableName !== 'sync_queue' || isSyncRunning()) return;
        refreshStats();
        scheduleSync();
      });
    } catch {
      // Change listener unavailable: syncing still happens on foreground/network/manual triggers.
    }

    return () => {
      appStateSub.remove();
      networkSub.remove();
      dbSub?.remove();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [isSignedIn, refreshStats, scheduleSync, syncNow]);

  const role: UserRole = farm?.role ?? 'owner';
  const businessType: BusinessType = farm?.businessType ?? 'farm';

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount,
        lastSyncedAt,
        syncNow,
        isSignedIn,
        isSessionReady,
        isOfflineMode,
        setOfflineMode,
        farm,
        role,
        businessType,
        isSessionExpired,
        error,
        apiUrl,
        updateApiUrl,
        signIn,
        register,
        verifyOtp,
        resendOtp,
        forgotPassword,
        resetPassword,
        changePassword,
        signOut,
      }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within a <SyncProvider>');
  }
  return ctx;
}
