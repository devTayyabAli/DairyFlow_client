import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Layout, Shadows, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'dark'
  | 'ghost'
  | 'danger';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  testID,
}: AppButtonProps) {
  const theme = useTheme();

  // Variant-specific visual styling
  const getVariantStyles = (): {
    container: ViewStyle;
    text: TextStyle;
    spinnerColor: string;
  } => {
    switch (variant) {
      case 'primary':
        return {
          container: {
            backgroundColor: theme.primary,
            borderColor: theme.primary,
            borderWidth: 1,
            ...Shadows.sm,
          },
          text: {
            color: theme.primaryContent,
          },
          spinnerColor: theme.primaryContent,
        };
      case 'secondary':
        return {
          container: {
            backgroundColor: theme.backgroundElement,
            borderColor: theme.border,
            borderWidth: 1,
          },
          text: {
            color: theme.primaryDark,
          },
          spinnerColor: theme.primaryDark,
        };
      case 'outline':
        return {
          container: {
            backgroundColor: theme.card,
            borderColor: theme.border,
            borderWidth: 1,
            ...Shadows.subtle,
          },
          text: {
            color: theme.primaryDark,
          },
          spinnerColor: theme.primaryDark,
        };
      case 'dark':
        return {
          container: {
            backgroundColor: theme.cardDark,
            borderColor: theme.cardDark,
            borderWidth: 1,
            ...Shadows.sm,
          },
          text: {
            color: theme.cardDarkText,
          },
          spinnerColor: theme.cardDarkText,
        };
      case 'ghost':
        return {
          container: {
            backgroundColor: 'transparent',
            borderColor: 'transparent',
            borderWidth: 1,
          },
          text: {
            color: theme.primary,
          },
          spinnerColor: theme.primary,
        };
      case 'danger':
        return {
          container: {
            backgroundColor: theme.dangerBg,
            borderColor: theme.danger,
            borderWidth: 1,
          },
          text: {
            color: theme.danger,
          },
          spinnerColor: theme.danger,
        };
    }
  };

  // Size-specific dimensions
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; gap: number } => {
    switch (size) {
      case 'sm':
        return {
          container: {
            height: Layout.buttonHeight.sm,
            paddingHorizontal: 12,
            borderRadius: BorderRadius.sm,
          },
          text: {
            fontSize: Typography.subhead.fontSize,
            lineHeight: Typography.subhead.lineHeight,
            fontWeight: '600',
          },
          gap: 6,
        };
      case 'md':
        return {
          container: {
            height: Layout.buttonHeight.md,
            paddingHorizontal: 16,
            borderRadius: BorderRadius.md,
          },
          text: {
            fontSize: Typography.bodyMedium.fontSize,
            lineHeight: Typography.bodyMedium.lineHeight,
            fontWeight: '600',
          },
          gap: 8,
        };
      case 'lg':
      default:
        return {
          container: {
            height: Layout.buttonHeight.lg,
            paddingHorizontal: 20,
            borderRadius: BorderRadius.md + 2, // 14px rounded button
          },
          text: {
            fontSize: Typography.headline.fontSize,
            lineHeight: Typography.headline.lineHeight,
            fontWeight: '700',
          },
          gap: 8,
        };
    }
  };

  const variantStyle = getVariantStyles();
  const sizeStyle = getSizeStyles();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyle.container,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={variantStyle.spinnerColor} />
      ) : (
        <View style={[styles.contentRow, { gap: sizeStyle.gap }]}>
          {icon && iconPosition === 'left' ? <View>{icon}</View> : null}
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[styles.textBase, sizeStyle.text, variantStyle.text, textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' ? <View>{icon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  textBase: {
    textAlign: 'center',
    flexShrink: 1,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
});
