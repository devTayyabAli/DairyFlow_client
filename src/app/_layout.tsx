import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth/AuthGate';
import { AdminProvider } from '@/context/admin-context';
import { LanguageProvider } from '@/context/language-context';
import { DB_NAME, initDatabase } from '@/db/database';
import { SyncProvider } from '@/sync';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider
        databaseName={DB_NAME}
        onInit={initDatabase}
        options={{ enableChangeListener: true }}>
        <LanguageProvider>
          <AdminProvider>
            <SyncProvider>
              <AuthGate>
                <AnimatedSplashOverlay />
                <AppTabs />
              </AuthGate>
            </SyncProvider>
          </AdminProvider>
        </LanguageProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
