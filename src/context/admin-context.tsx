import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { useLanguage } from '@/context/language-context';
import { getAppSetting, setAppSetting } from '@/db/database';

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
  farmName: 'الرحمان ڈیری فارم',
  ownerName: 'چوہدری صاحب',
  ownerPhone: '',
  defaultMilkRate: '220',
  isLoading: true,
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
  const [currentPin, setCurrentPin] = useState<string>('');
  const [isRegistered, setIsRegistered] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | null>(null);

  const [farmName, setFarmName] = useState<string>(isUrdu ? 'الرحمان ڈیری فارم' : 'Rehman Dairy Farm');
  const [ownerName, setOwnerName] = useState<string>(isUrdu ? 'چوہدری صاحب' : 'Farm Admin');
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

  // Load all admin settings on mount
  const loadAdminSettings = useCallback(async () => {
    const isUrdu = isUrduRef.current;
    try {
      const [savedPin, savedFarm, savedOwner, savedPhone, savedRate, savedRegistered] = await Promise.all([
        getAppSetting(db, 'admin_pin', ''),
        getAppSetting(db, 'farm_name', isUrdu ? 'الرحمان ڈیری فارم' : 'Rehman Dairy Farm'),
        getAppSetting(db, 'admin_name', isUrdu ? 'چوہدری صاحب' : 'Farm Admin'),
        getAppSetting(db, 'admin_phone', ''),
        getAppSetting(db, 'default_milk_rate', '220'),
        getAppSetting(db, 'is_registered', '1'), // Default 1 so existing databases stay active
      ]);

      const pinExists = Boolean(savedPin && savedPin.trim().length === 4);
      setHasPinSet(pinExists);
      setCurrentPin(pinExists ? savedPin.trim() : '');

      const registered = savedRegistered === '1';
      setIsRegistered(registered);

      if (!registered) {
        // First-time farm onboarding: prompt register screen
        setIsAuthenticated(false);
        setAuthScreen('register');
        setIsAdmin(false);
      } else if (pinExists) {
        // Farm registered with PIN: start in worker mode or locked screen
        // By default, farm is accessible, but sensitive admin actions require PIN
        setIsAuthenticated(true);
        setIsAdmin(false);
        setAuthScreen(null);
      } else {
        // No PIN: fully open
        setIsAuthenticated(true);
        setIsAdmin(true);
        setAuthScreen(null);
      }

      setFarmName(savedFarm || (isUrdu ? 'الرحمان ڈیری فارم' : 'Rehman Dairy Farm'));
      setOwnerName(savedOwner || (isUrdu ? 'چوہدری صاحب' : 'Farm Admin'));
      setOwnerPhone(savedPhone || '');
      setDefaultMilkRate(savedRate || '220');
    } catch {
      // Default fallbacks preserved
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load of persisted settings on mount
    loadAdminSettings();
  }, [loadAdminSettings]);

  // Verify PIN
  const verifyPin = async (inputPin: string): Promise<boolean> => {
    if (!hasPinSet || !currentPin) {
      setIsAdmin(true);
      return true;
    }
    const isValid = inputPin.trim() === currentPin.trim();
    if (isValid) {
      setIsAdmin(true);
    }
    return isValid;
  };

  // Set new PIN
  const setNewPin = async (newPin: string): Promise<void> => {
    const cleanPin = newPin.trim();
    if (cleanPin.length === 4) {
      await setAppSetting(db, 'admin_pin', cleanPin);
      setCurrentPin(cleanPin);
      setHasPinSet(true);
      setIsAdmin(true);
    } else if (cleanPin.length === 0) {
      await db.runAsync("DELETE FROM app_settings WHERE key = 'admin_pin';");
      setCurrentPin('');
      setHasPinSet(false);
      setIsAdmin(true);
    }
  };

  // Update Farm Profile
  const updateFarmProfile = async (data: Partial<FarmProfile>): Promise<void> => {
    const promises: Promise<void>[] = [];

    if (data.farmName !== undefined) {
      const cleanName = data.farmName.trim() || (isUrdu ? 'الرحمان ڈیری فارم' : 'Rehman Dairy Farm');
      setFarmName(cleanName);
      promises.push(setAppSetting(db, 'farm_name', cleanName));
    }

    if (data.ownerName !== undefined) {
      const cleanOwner = data.ownerName.trim() || (isUrdu ? 'چوہدری صاحب' : 'Farm Admin');
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
    const cleanFarm = data.farmName.trim() || (isUrdu ? 'الرحمان ڈیری فارم' : 'Rehman Dairy Farm');
    const cleanOwner = data.ownerName.trim() || (isUrdu ? 'چوہدری صاحب' : 'Farm Admin');
    const cleanPhone = data.ownerPhone.trim();
    const cleanRate = data.defaultMilkRate.trim() || '220';
    const cleanPin = data.pin.trim();

    await Promise.all([
      setAppSetting(db, 'farm_name', cleanFarm),
      setAppSetting(db, 'admin_name', cleanOwner),
      setAppSetting(db, 'admin_phone', cleanPhone),
      setAppSetting(db, 'default_milk_rate', cleanRate),
      cleanPin.length === 4
        ? setAppSetting(db, 'admin_pin', cleanPin)
        : db.runAsync("DELETE FROM app_settings WHERE key = 'admin_pin';"),
      setAppSetting(db, 'is_registered', '1'),
    ]);

    setFarmName(cleanFarm);
    setOwnerName(cleanOwner);
    setOwnerPhone(cleanPhone);
    setDefaultMilkRate(cleanRate);
    if (cleanPin.length === 4) {
      setCurrentPin(cleanPin);
      setHasPinSet(true);
    } else {
      setCurrentPin('');
      setHasPinSet(false);
    }
    setIsRegistered(true);
    setIsAuthenticated(true);
    setIsAdmin(true);
    setAuthScreen(null);
  };

  // Login as Admin using PIN
  const loginAdmin = async (pin: string): Promise<boolean> => {
    if (!hasPinSet || !currentPin) {
      setIsAuthenticated(true);
      setIsAdmin(true);
      setAuthScreen(null);
      return true;
    }
    if (pin.trim() === currentPin.trim()) {
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
    if (hasPinSet) {
      setIsAdmin(false);
      setIsAuthenticated(false);
      setAuthScreen('login');
    }
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
