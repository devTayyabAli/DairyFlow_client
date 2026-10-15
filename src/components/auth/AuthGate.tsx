import React from 'react';

import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { BrandSplash } from '@/components/animated-icon';
import { useAdmin } from '@/context/admin-context';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isRegistered, isAuthenticated, authScreen } = useAdmin();

  if (isLoading) {
    return <BrandSplash />;
  }

  // First launch (no farm set up yet) or user explicitly chose to set up a farm
  if (authScreen === 'register' || !isRegistered) {
    return <RegisterScreen />;
  }

  // Every launch, and after logout, requires signing in
  if (authScreen === 'login' || !isAuthenticated) {
    return <LoginScreen />;
  }

  // Authenticated: show the main app tabs
  return <>{children}</>;
}
