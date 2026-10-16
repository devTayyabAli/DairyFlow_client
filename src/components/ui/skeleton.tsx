import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing placeholder block. Stays static when the user prefers reduced motion. */
export function Skeleton({ width = '100%', height = 16, radius = BorderRadius.sm, style }: SkeletonProps) {
  const theme = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.55));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width, height, borderRadius: radius, backgroundColor: theme.backgroundSelected, opacity },
        style,
      ]}
    />
  );
}
