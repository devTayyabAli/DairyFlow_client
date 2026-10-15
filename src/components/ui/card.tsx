import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CardVariant =
  | 'default' // Crisp white card with subtle border & soft shadow
  | 'featuredDark' // Deep emerald green hero financial card
  | 'mint' // Soft mint hero highlight card
  | 'warning' // Soft amber alert / offline banner card
  | 'flat'; // Neutral background, no shadow

export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface AppCardProps extends ViewProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  borderRadius?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AppCard({
  children,
  variant = 'default',
  padding = 'lg',
  borderRadius,
  onPress,
  style,
  testID,
  ...rest
}: AppCardProps) {
  const theme = useTheme();

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'featuredDark':
        return {
          backgroundColor: theme.cardDark,
          borderColor: theme.cardDark,
          borderWidth: 1,
          borderRadius: borderRadius ?? BorderRadius.xl, // 20px
          ...Shadows.md,
        };
      case 'mint':
        return {
          backgroundColor: theme.cardMint,
          borderColor: theme.cardMintBorder,
          borderWidth: 1,
          borderRadius: borderRadius ?? BorderRadius.lg, // 16px
        };
      case 'warning':
        return {
          backgroundColor: theme.accentBg,
          borderColor: theme.morningBorder,
          borderWidth: 1,
          borderRadius: borderRadius ?? BorderRadius.md, // 12px
        };
      case 'flat':
        return {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.borderSubtle,
          borderWidth: 1,
          borderRadius: borderRadius ?? BorderRadius.lg,
        };
      case 'default':
      default:
        return {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: borderRadius ?? BorderRadius.lg, // 16px
          ...Shadows.subtle,
        };
    }
  };

  const getPadding = (): number => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return Spacing.sm;
      case 'md':
        return Spacing.md;
      case 'xl':
        return Spacing.xl;
      case 'lg':
      default:
        return Spacing.lg;
    }
  };

  const variantStyle = getVariantStyles();
  const paddingValue = getPadding();

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.base,
          variantStyle,
          { padding: paddingValue },
          pressed && styles.pressed,
          style,
        ]}>
        {children}
      </Pressable>
    );
  }

  return (
    <View
      testID={testID}
      style={[styles.base, variantStyle, { padding: paddingValue }, style]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
