import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND_DARK } from '@/components/animated-icon';

/**
 * Solid brand-colour strip behind the system status bar. The auth screens scroll under a
 * transparent status bar, so without it the logo and language toggle slide beneath the clock and
 * battery icons and become unreadable.
 */
export function StatusBarCover() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.cover, { height: insets.top }]} />;
}

const styles = StyleSheet.create({
  cover: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_DARK,
    zIndex: 10,
  },
});
