import React, { useEffect } from 'react';

import { CloudAuthScreen } from './CloudAuthScreen';
import { LoginScreen } from './LoginScreen';
import { BrandSplash } from '@/components/animated-icon';
import { useAdmin } from '@/context/admin-context';
import { useSync } from '@/sync';

/**
 * Two layers, in this order:
 *  1. Account (email + password, OTP at registration). Required once per phone; the session is
 *     remembered, so later launches and all daily work happen offline.
 *  2. Local PIN quick-lock. Only asked when a PIN was set; signing in with the account password
 *     counts as owner authentication and skips it for that session.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isRegistered, isAuthenticated, hasPinSet, skipRegistration } = useAdmin();
  // A phone that already holds a farm from before accounts existed may continue offline for
  // this launch, so an outage can never lock a farmer out of their own records.
  const { isSignedIn, isSessionReady, isOfflineMode, setOfflineMode } = useSync();

  const hasAccess = isSignedIn || isOfflineMode;
  const needsAutoEnter = hasAccess && !isAuthenticated && !hasPinSet;

  useEffect(() => {
    if (needsAutoEnter) skipRegistration().catch(() => {});
  }, [needsAutoEnter, skipRegistration]);

  if (isLoading || !isSessionReady) {
    return <BrandSplash />;
  }

  if (!hasAccess) {
    return (
      <CloudAuthScreen
        canContinueOffline={isRegistered}
        onContinueOffline={() => setOfflineMode(true)}
      />
    );
  }

  if (!isAuthenticated) {
    // With no PIN the effect above enters automatically; show the splash for that frame.
    return hasPinSet ? <LoginScreen /> : <BrandSplash />;
  }

  return <>{children}</>;
}
