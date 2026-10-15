import * as SecureStore from 'expo-secure-store';
import { SQLiteDatabase } from 'expo-sqlite';
import { getAppSetting, setAppSetting } from '@/db/database';
import { FarmProfile } from './sync-types';

const TOKEN_KEY = 'dairyflow_auth_token';
const FARM_PROFILE_KEY = 'dairyflow_farm_profile';

// Fallback memory cache if SecureStore is unavailable (e.g. SSR/test)
let memoryToken: string | null = null;
let memoryFarm: string | null = null;

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (await isSecureStoreAvailable()) {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return memoryToken;
    }
  }
  return memoryToken;
}

export async function setAuthToken(token: string): Promise<void> {
  memoryToken = token;
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } catch (err) {
      console.warn('SecureStore setItem failed, using fallback:', err);
    }
  }
}

export async function clearAuthToken(): Promise<void> {
  memoryToken = null;
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      // ignore
    }
  }
}

export async function getStoredFarmProfile(): Promise<FarmProfile | null> {
  let json: string | null = null;
  if (await isSecureStoreAvailable()) {
    try {
      json = await SecureStore.getItemAsync(FARM_PROFILE_KEY);
    } catch {
      json = memoryFarm;
    }
  } else {
    json = memoryFarm;
  }

  if (!json) return null;
  try {
    return JSON.parse(json) as FarmProfile;
  } catch {
    return null;
  }
}

export async function setStoredFarmProfile(farm: FarmProfile): Promise<void> {
  const json = JSON.stringify(farm);
  memoryFarm = json;
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.setItemAsync(FARM_PROFILE_KEY, json);
    } catch (err) {
      console.warn('SecureStore setItem for farm failed:', err);
    }
  }
}

export async function clearStoredFarmProfile(): Promise<void> {
  memoryFarm = null;
  if (await isSecureStoreAvailable()) {
    try {
      await SecureStore.deleteItemAsync(FARM_PROFILE_KEY);
    } catch {
      // ignore
    }
  }
}

export async function getSyncCursor(db: SQLiteDatabase): Promise<number> {
  const val = await getAppSetting(db, 'sync_cursor', '0');
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
}

export async function setSyncCursor(db: SQLiteDatabase, cursor: number): Promise<void> {
  await setAppSetting(db, 'sync_cursor', String(cursor));
}

export async function getLastSyncedAt(db: SQLiteDatabase): Promise<string | null> {
  const val = await getAppSetting(db, 'sync_last_at', '');
  return val.trim() ? val : null;
}

export async function setLastSyncedAt(db: SQLiteDatabase, isoDate: string): Promise<void> {
  await setAppSetting(db, 'sync_last_at', isoDate);
}
