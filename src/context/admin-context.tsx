import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useLanguage } from '@/context/language-context';
import { getAppSetting, setAppSetting } from '@/db/database';
import { checkPin, hashPin } from '@/utils/pin-crypto';
import {
  attemptsRemaining,
  FAILED_ATTEMPTS_KEY,
  isValidPin,
  LOCKED_UNTIL_KEY,
  lockRemainingMs,
  parseCounter,
  parseStoredPin,
  PIN_SETTING_KEY,
  recordFailure,
  type StoredPin,
} from '@/utils/pin-security';

export const DEFAULT_FARM_NAME = 'DairyFlow';
const DEFAULT_OWNER_EN = 'Farm Admin';
const DEFAULT_OWNER_UR = 'فارم ایڈمن';

// Sample names that older builds used as defaults; never show them to real users.
const LEGACY_FARM_NAMES = ['Rehman Dairy Farm', 'الرحمان ڈیری فارم', 'رحمان ڈیری فارم', 'Dairy Farm Manager'];
const LEGACY_OWNER_NAMES = ['چوہدری صاحب', 'Chaudhry Sahab'];

function cleanFarmName(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  return !n || LEGACY_FARM_NAMES.includes(n) ? DEFAULT_FARM_NAME : n;
}

function cleanOwnerName(name: string | null | undefined, isUrdu: boolean): string {
  const n = (name ?? '').trim();
  return !n || LEGACY_OWNER_NAMES.includes(n) ? (isUrdu ? DEFAULT_OWNER_UR : DEFAULT_OWNER_EN) : n;
}

export interface FarmProfile {
  farmName: string;
  ownerName: string;
  ownerPhone: string;
  defaultMilkRate: string;
}

export interface RegisterFarmPayload extends FarmProfile {
  pin: string;
}

interface AdminContextType {
  isAdmin: boolean;
  hasPinSet: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  authScreen: 'login' | 'register' | null;
  farmName: string;
  ownerName: string;
  ownerPhone: string;
  defaultMilkRate: string;
  isLoading: boolean;
  /** Consecutive wrong PIN attempts (persisted, reset on success). */
  failedAttempts: number;
  /** Epoch ms until which PIN entry is locked; 0 when not locked. */
  pinLockedUntil: number;
  /** Wrong PINs still allowed before the next lockout. */
  pinAttemptsRemaining: number;
  verifyPin: (pin: string) => Promise<boolean>;
  setNewPin: (newPin: string) => Promise<void>;
  updateFarmProfile: (data: Partial<FarmProfile>) => Promise<void>;
  registerFarm: (data: RegisterFarmPayload) => Promise<void>;
  loginAdmin: (pin: string) => Promise<boolean>;
  loginWorker: () => void;
  lockApp: () => void;
  logoutAdmin: () => void;
  setAuthScreen: (screen: 'login' | 'register' | null) => void;
  skipRegistration: () => Promise<void>;
  isPinModalOpen: boolean;
  openPinModal: (onSuccess?: () => void) => void;
  closePinModal: () => void;
  onPinSuccessCallback: (() => void) | null;
  reloadSettings: () => Promise<void>;
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  hasPinSet: false,
  isRegistered: true,
  isAuthenticated: true,
  authScreen: null,
  farmName: DEFAULT_FARM_NAME,
  ownerName: DEFAULT_OWNER_EN,
  ownerPhone: '',
  defaultMilkRate: '220',
  isLoading: true,
  failedAttempts: 0,
  pinLockedUntil: 0,
  pinAttemptsRemaining: 5,
  verifyPin: async () => false,
  setNewPin: async () => {},
  updateFarmProfile: async () => {},
  registerFarm: async () => {},
  loginAdmin: async () => false,
  loginWorker: () => {},
  lockApp: () => {},
  logoutAdmin: () => {},
  setAuthScreen: () => {},
  skipRegistration: async () => {},
  isPinModalOpen: false,
  openPinModal: () => {},
  closePinModal: () => {},
  onPinSuccessCallback: null,
  reloadSettings: async () => {},
});

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [hasPinSet, setHasPinSet] = useState<boolean>(false);
  // Only a salted hash is ever kept (state or DB); the plain PIN is never stored.
  const storedPinRef = useRef<StoredPin>({ kind: 'none' });
  const checkingRef = useRef<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [pinLockedUntil, setPinLockedUntil] = useState<number>(0);
  const lockRef = useRef({ failedAttempts: 0, lockedUntil: 0 });
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | null>(null);

  const [farmName, setFarmName] = useState<string>(DEFAULT_FARM_NAME);
  const [ownerName, setOwnerName] = useState<string>(isUrdu ? DEFAULT_OWNER_UR : DEFAULT_OWNER_EN);
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [defaultMilkRate, setDefaultMilkRate] = useState<string>('220');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Global Pin Modal controls
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [onPinSuccessCallback, setOnPinSuccessCallback] = useState<(() => void) | null>(null);

  // Language only affects fallback names; keep it out of the load deps so toggling
  // language never re-runs the load and resets the admin session.
  const isUrduRef = useRef(isUrdu);
  useEffect(() => {
    isUrduRef.current = isUrdu;
  }, [isUrdu]);

  const applyLockState = useCallback((failed: number, lockedUntil: number) => {
    lockRef.current = { failedAttempts: failed, lockedUntil };
    setFailedAttempts(failed);
    setPinLockedUntil(lockedUntil);
  }, []);

  const persistLockState = useCallback(
    async (failed: number, lockedUntil: number) => {
      applyLockState(failed, lockedUntil);
      await Promise.all([
        setAppSetting(db, FAILED_ATTEMPTS_KEY, String(failed)),
        setAppSetting(db, LOCKED_UNTIL_KEY, String(lockedUntil)),
      ]);
    },
    [db, applyLockState]
  );

  // Load all admin settings on mount
  const loadAdminSettings = useCallback(async () => {
    const isUrdu = isUrduRef.current;
    try {
      const [savedPin, savedFarm, savedOwner, savedPhone, savedRate, savedRegistered, savedFailed, savedLockedUntil] =
        await Promise.all([
          getAppSetting(db, PIN_SETTING_KEY, ''),
          getAppSetting(db, 'farm_name', ''),
          getAppSetting(db, 'admin_name', ''),
          getAppSetting(db, 'admin_phone', ''),
          getAppSetting(db, 'default_milk_rate', '220'),
          // Fresh installs start unregistered so the owner sets up the farm first.
          getAppSetting(db, 'is_registered', '0'),
          getAppSetting(db, FAILED_ATTEMPTS_KEY, '0'),
          getAppSetting(db, LOCKED_UNTIL_KEY, '0'),
        ]);

      let stored = parseStoredPin(savedPin);
      if (stored.kind === 'legacy') {
        // Migrate a plain 4-digit PIN from an older build to a salted hash. The same PIN
        // keeps working; if the write fails the plain value is kept and still verifies.
        try {
          const hashed = await hashPin(stored.pin);
          await setAppSetting(db, PIN_SETTING_KEY, hashed);
          stored = parseStoredPin(hashed);
        } catch {
          // keep legacy value; upgraded on the next successful verification
        }
      }
      storedPinRef.current = stored;
      setHasPinSet(stored.kind === 'legacy' || stored.kind === 'v1');
      applyLockState(parseCounter(savedFailed), parseCounter(savedLockedUntil));

      const registered = savedRegistered === '1';
      setIsRegistered(registered);
      setIsAdmin(false);
      setIsAuthenticated(false);
      // Every launch starts on an auth screen: setup for new farms, login otherwise.
      setAuthScreen(registered ? 'login' : 'register');

      setFarmName(cleanFarmName(savedFarm));
      setOwnerName(cleanOwnerName(savedOwner, isUrdu));
      setOwnerPhone(savedPhone || '');
      setDefaultMilkRate(savedRate || '220');
    } catch {
      // Default fallbacks preserved
    } finally {
      setIsLoading(false);
    }
  }, [db, applyLockState]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load of persisted settings on mount
    loadAdminSettings();
  }, [loadAdminSettings]);

  // Check an entered PIN: enforces the persisted lockout, counts failures, upgrades legacy values.
  const attemptPin = async (inputPin: string): Promise<boolean> => {
    const stored = storedPinRef.current;
    if (stored.kind !== 'legacy' && stored.kind !== 'v1') return true;
    if (checkingRef.current) return false;
    if (lockRemainingMs(lockRef.current.lockedUntil, Date.now()) > 0) return false;

    checkingRef.current = true;
    try {
      const input = inputPin.trim();
      const ok = isValidPin(input) && (await checkPin(stored, input));
      if (ok) {
        if (stored.kind === 'legacy') {
          try {
            const hashed = await hashPin(input);
            await setAppSetting(db, PIN_SETTING_KEY, hashed);
            storedPinRef.current = parseStoredPin(hashed);
          } catch {
            // keep legacy value; retried on the next successful verification
          }
        }
        if (lockRef.current.failedAttempts > 0 || lockRef.current.lockedUntil > 0) {
          await persistLockState(0, 0);
        }
        return true;
      }
      const next = recordFailure(lockRef.current, Date.now());
      await persistLockState(next.failedAttempts, next.lockedUntil);
      return false;
    } finally {
      checkingRef.current = false;
    }
  };

  // Verify PIN
  const verifyPin = async (inputPin: string): Promise<boolean> => {
    const isValid = await attemptPin(inputPin);
    if (isValid) {
      setIsAdmin(true);
    }
    return isValid;
  };

  // Set new PIN
  const setNewPin = async (newPin: string): Promise<void> => {
    const cleanPin = newPin.trim();
    if (isValidPin(cleanPin)) {
      const hashed = await hashPin(cleanPin);
      await setAppSetting(db, PIN_SETTING_KEY, hashed);
      storedPinRef.current = parseStoredPin(hashed);
      await persistLockState(0, 0);
      setHasPinSet(true);
      setIsAdmin(true);
    } else if (cleanPin.length === 0) {
      await db.runAsync("DELETE FROM app_settings WHERE key = 'admin_pin';");
      storedPinRef.current = { kind: 'none' };
      await persistLockState(0, 0);
      setHasPinSet(false);
      setIsAdmin(true);
    }
  };

  // Update Farm Profile
  const updateFarmProfile = async (data: Partial<FarmProfile>): Promise<void> => {
    const promises: Promise<void>[] = [];

    if (data.farmName !== undefined) {
      const cleanName = cleanFarmName(data.farmName);
      setFarmName(cleanName);
      promises.push(setAppSetting(db, 'farm_name', cleanName));
    }

    if (data.ownerName !== undefined) {
      const cleanOwner = cleanOwnerName(data.ownerName, isUrdu);
      setOwnerName(cleanOwner);
      promises.push(setAppSetting(db, 'admin_name', cleanOwner));
    }

    if (data.ownerPhone !== undefined) {
      const cleanPhone = data.ownerPhone.trim();
      setOwnerPhone(cleanPhone);
      promises.push(setAppSetting(db, 'admin_phone', cleanPhone));
    }

    if (data.defaultMilkRate !== undefined) {
      const cleanRate = data.defaultMilkRate.trim() || '220';
      setDefaultMilkRate(cleanRate);
      promises.push(setAppSetting(db, 'default_milk_rate', cleanRate));
    }

    await Promise.all(promises);
  };

  // Register Farm (New Farm Onboarding)
  const registerFarm = async (data: RegisterFarmPayload): Promise<void> => {
    const cleanFarm = cleanFarmName(data.farmName);
    const cleanOwner = cleanOwnerName(data.ownerName, isUrdu);
    const cleanPhone = data.ownerPhone.trim();
    const cleanRate = data.defaultMilkRate.trim() || '220';
    const cleanPin = data.pin.trim();
    const hasNewPin = isValidPin(cleanPin);
    const hashedPin = hasNewPin ? await hashPin(cleanPin) : '';

    await Promise.all([
      setAppSetting(db, 'farm_name', cleanFarm),
      setAppSetting(db, 'admin_name', cleanOwner),
      setAppSetting(db, 'admin_phone', cleanPhone),
      setAppSetting(db, 'default_milk_rate', cleanRate),
      hasNewPin
        ? setAppSetting(db, PIN_SETTING_KEY, hashedPin)
        : db.runAsync("DELETE FROM app_settings WHERE key = 'admin_pin';"),
      setAppSetting(db, 'is_registered', '1'),
    ]);

    setFarmName(cleanFarm);
    setOwnerName(cleanOwner);
    setOwnerPhone(cleanPhone);
    setDefaultMilkRate(cleanRate);
    storedPinRef.current = hasNewPin ? parseStoredPin(hashedPin) : { kind: 'none' };
    await persistLockState(0, 0);
    setHasPinSet(hasNewPin);
    setIsRegistered(true);
    setIsAuthenticated(true);
    setIsAdmin(true);
    setAuthScreen(null);
  };

  // Login as Admin using PIN
  const loginAdmin = async (pin: string): Promise<boolean> => {
    if (await attemptPin(pin)) {
      setIsAuthenticated(true);
      setIsAdmin(true);
      setAuthScreen(null);
      return true;
    }
    return false;
  };

  // Login as Worker (can enter daily records, cannot modify admin rates/profile)
  const loginWorker = () => {
    setIsAuthenticated(true);
    setIsAdmin(false);
    setAuthScreen(null);
  };

  // Lock App / Logout (brings up Login Screen)
  const lockApp = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setAuthScreen('login');
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    setIsAuthenticated(false);
    setAuthScreen('login');
  };

  const skipRegistration = async () => {
    await setAppSetting(db, 'is_registered', '1');
    setIsRegistered(true);
    setIsAuthenticated(true);
    setIsAdmin(true);
    setAuthScreen(null);
  };

  const openPinModal = (onSuccess?: () => void) => {
    if (isAdmin || !hasPinSet) {
      if (onSuccess) onSuccess();
      return;
    }
    setOnPinSuccessCallback(() => onSuccess || null);
    setIsPinModalOpen(true);
  };

  const closePinModal = () => {
    setIsPinModalOpen(false);
    setOnPinSuccessCallback(null);
  };

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        hasPinSet,
        isRegistered,
        isAuthenticated,
        authScreen,
        farmName,
        ownerName,
        ownerPhone,
        defaultMilkRate,
        isLoading,
        failedAttempts,
        pinLockedUntil,
        pinAttemptsRemaining: attemptsRemaining(failedAttempts),
        verifyPin,
        setNewPin,
        updateFarmProfile,
        registerFarm,
        loginAdmin,
        loginWorker,
        lockApp,
        logoutAdmin,
        setAuthScreen,
        skipRegistration,
        isPinModalOpen,
        openPinModal,
        closePinModal,
        onPinSuccessCallback,
        reloadSettings: loadAdminSettings,
      }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
