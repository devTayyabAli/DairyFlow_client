import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { useAdmin } from '@/context/admin-context';

export const BRAND_DARK = '#0B3D22';
const MIN_VISIBLE_MS = 1600;

/** Static brand screen: logo, wordmark, tagline and a loader. */
export function BrandSplash({ showLoader = true }: { showLoader?: boolean }) {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View style={styles.logoRing}>
          <Image
            source={require('@/assets/images/dairyflow-mark.png')}
            style={styles.logo}
            contentFit="contain"
          />
        </View>
        <Text style={styles.wordmark}>DairyFlow</Text>
        <Text style={styles.tagline}>Smart Dairy Farm Management</Text>
      </View>

      <View style={styles.footer}>
        {showLoader ? <ActivityIndicator size="small" color="#A7F3C5" /> : null}
        <Text style={styles.footerText}>Loading your farm…</Text>
      </View>
    </View>
  );
}

/**
 * Full-screen overlay shown on app launch. It replaces the native splash seamlessly
 * (same background colour), stays for a short minimum time and until settings are loaded,
 * then fades out to reveal the login screen.
 */
export function AnimatedSplashOverlay() {
  const { isLoading } = useAdmin();
  const [visible, setVisible] = useState(true);
  const [minElapsed, setMinElapsed] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const [scale] = useState(() => new Animated.Value(0.92));

  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [scale]);

  useEffect(() => {
    if (!minElapsed || isLoading) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setVisible(false);
    });
  }, [minElapsed, isLoading, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={() => {
        SplashScreen.hideAsync().catch(() => {});
      }}
      style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.fill, { transform: [{ scale }] }]}>
        <BrandSplash />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: BRAND_DARK,
  },
  fill: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: BRAND_DARK,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 64,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRing: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    width: 76,
    height: 76,
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    color: '#A7D7B8',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  footer: {
    alignItems: 'center',
    gap: 10,
  },
  footerText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
});
