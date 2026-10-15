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
import { FarmProfile, SyncResult, SyncStatus } from './sync-types';

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
}

interface ServerError {
  code?: string;
  message?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}

const NETWORK_ERROR = 'Could not connect to server. Please check your internet connection.';

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
  farm: FarmProfile | null;
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
  signOut: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const WRITE_DEBOUNCE_MS = 3000;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { reloadSettings } = useAdmin();
  const { isUrdu } = useLanguage();
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAtState] = useState<string | null>(null);
  const [isSignedIn, setIsSignedInState] = useState<boolean>(false);
  const [farm, setFarm] = useState<FarmProfile | null>(null);
  const [isSessionExpired, setIsSessionExpired] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [apiUrl, setApiUrlState] = useState<string>(getApiBaseUrl());

  // Mirrors isSignedIn so callbacks never act on a stale value (e.g. right after sign-in).
  const isSignedInRef = useRef<boolean>(false);
  const isUrduRef = useRef<boolean>(isUrdu);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSyncRef = useRef<() => void>(() => {});

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
      setStatus('error');
      setError(result.message || 'Sync failed');
    } else {
      setStatus('idle');
    }

    return result;
  }, [db, refreshStats]);

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

      if (previousFarmId && previousFarmId !== data.farm.id) {
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
      setSignedIn(true);
      setFarm(data.farm);
      setIsSessionExpired(false);

      // Reflect the farm profile locally so the app shows the account's name/owner/rate.
      if (data.farm.farmName) await setAppSetting(db, 'farm_name', data.farm.farmName);
      if (data.farm.ownerName) await setAppSetting(db, 'admin_name', data.farm.ownerName);
      if (data.farm.phone) await setAppSetting(db, 'admin_phone', data.farm.phone);
      if (data.farm.defaultMilkRate) {
        await setAppSetting(db, 'default_milk_rate', String(data.farm.defaultMilkRate));
      }
      await setAppSetting(db, 'is_registered', '1');
      await reloadSettings();

      // Queue this phone's own (non-demo) data, then run the first two-way sync.
      await enqueueAllUserDataForSync(db);
      await refreshStats();
      syncNow().catch(() => {});

      return { success: true };
    },
    [db, refreshStats, reloadSettings, setSignedIn, syncNow]
  );

  const postJson = useCallback(async (path: string, body: unknown) => {
    const res = await fetch(getApiEndpoint(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Non-JSON bodies (proxy errors, HTML) must not crash the screen.
    const data = await res.json().catch(() => null);
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
        return { success: false, error: err instanceof Error ? err.message : NETWORK_ERROR };
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
        return { success: false, error: err instanceof Error ? err.message : NETWORK_ERROR };
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
        return { success: false, error: err instanceof Error ? err.message : NETWORK_ERROR };
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
        return { success: false, error: err instanceof Error ? err.message : NETWORK_ERROR };
      }
    },
    [postJson]
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
    await clearAuthToken();
    await clearStoredFarmProfile();
    setSignedIn(false);
    setFarm(null);
    setIsSessionExpired(false);
    setStatus('idle');
    setError(null);
  }, [setSignedIn]);

  useEffect(() => {
    onSessionExpired(() => {
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
      const storedFarm = await getStoredFarmProfile();
      if (!isMounted) return;
      setSignedIn(Boolean(token));
      setFarm(storedFarm);
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

  return (
    <SyncContext.Provider
      value={{
        status,
        pendingCount,
        lastSyncedAt,
        syncNow,
        isSignedIn,
        farm,
        isSessionExpired,
        error,
        apiUrl,
        updateApiUrl,
        signIn,
        register,
        verifyOtp,
        resendOtp,
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
