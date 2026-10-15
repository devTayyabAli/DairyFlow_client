import { Platform } from 'react-native';

const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

let customApiUrl: string | null = null;

export function setCustomApiUrl(url: string | null): void {
  customApiUrl = url && url.trim().length > 0 ? url.trim().replace(/\/+$/, '') : null;
}

export function getCustomApiUrl(): string | null {
  return customApiUrl;
}

export function getApiBaseUrl(): string {
  if (customApiUrl) {
    return customApiUrl;
  }
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_URL;
}

// Android release builds block cleartext (http://) traffic, so sync would silently fail in
// production. Use an https:// server URL for anything other than local development.
if (!__DEV__ && /^http:\/\//i.test(getApiBaseUrl())) {
  console.warn('[Sync] API URL is not HTTPS; Android release builds will refuse to connect.');
}

export function getApiEndpoint(path: string): string {
  const base = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
