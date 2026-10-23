import { DarkTheme, DefaultTheme, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AuthGate } from '@/components/auth/AuthGate';
import { ToastProvider } from '@/components/ui';
import { AdminProvider } from '@/context/admin-context';
import { LanguageProvider } from '@/context/language-context';
import { DB_NAME, initDatabase } from '@/db/database';
import { SyncProvider } from '@/sync';
import { Colors } from '@/constants/theme';
import { installGlobalErrorHandlers, logger } from '@/utils/logger';

installGlobalErrorHandlers();
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root error boundary (expo-router). It renders outside every provider, so it cannot
 * read the saved language and shows English and Urdu together, using static theme tokens.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const c = Colors.light;
  logger.error('Render error caught by ErrorBoundary', error);

  return (
    <View style={[styles.errorRoot, { backgroundColor: c.background }]}>
      <View style={[styles.errorIcon, { backgroundColor: c.dangerBg }]}>
        <Text style={[styles.errorIconText, { color: c.danger }]} accessibilityElementsHidden>
          !
        </Text>
      </View>
      <Text accessibilityRole="header" style={[styles.errorTitle, { color: c.text }]}>
        Something went wrong
      </Text>
      <Text style={[styles.errorTitle, styles.errorTitleUrdu, { color: c.text }]}>
        کچھ غلط ہو گیا
      </Text>
      <Text style={[styles.errorBody, { color: c.textSecondary }]}>
        DairyFlow hit an unexpected problem. Your saved records are safe.
      </Text>
      <Text style={[styles.errorBody, { color: c.textSecondary }]}>
        ایک غیر متوقع مسئلہ پیش آیا۔ آپ کا محفوظ ریکارڈ محفوظ ہے۔
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again / دوبارہ کوشش کریں"
        onPress={retry}
        style={({ pressed }) => [
          styles.errorButton,
          { backgroundColor: c.primary },
          pressed && styles.errorButtonPressed,
        ]}>
        <Text style={[styles.errorButtonText, { color: c.primaryContent }]}>
          Try again · دوبارہ کوشش کریں
        </Text>
      </Pressable>
    </View>
  );
}

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
              <ToastProvider>
                <AuthGate>
                  <AppTabs />
                </AuthGate>
              </ToastProvider>
              <AnimatedSplashOverlay />
            </SyncProvider>
          </AdminProvider>
        </LanguageProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  errorIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  errorIconText: { fontSize: 36, fontWeight: '800' },
  errorTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  errorTitleUrdu: { writingDirection: 'rtl' },
  errorBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  errorButton: {
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  errorButtonPressed: { opacity: 0.85 },
  errorButtonText: { fontSize: 16, fontWeight: '700' },
});
