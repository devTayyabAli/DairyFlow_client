import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { useAdmin } from '@/context/admin-context';
import { useTheme } from '@/hooks/use-theme';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const {
    isLoading,
    isRegistered,
    isAuthenticated,
    authScreen,
  } = useAdmin();

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // If user explicitly chose or is routed to register screen
  if (authScreen === 'register' || !isRegistered) {
    return <RegisterScreen />;
  }

  // If user is locked out or explicitly chose login screen
  if (authScreen === 'login' || !isAuthenticated) {
    return <LoginScreen />;
  }

  // Otherwise, user is authenticated and enters main tabs
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
