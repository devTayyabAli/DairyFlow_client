import React, { useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface AppTextInputProps extends TextInputProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  unitSuffix?: string; // e.g. "L", "%", "Rs / L"
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  inputContainerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function AppTextInput({
  label,
  required,
  error,
  helperText,
  leftIcon,
  rightIcon,
  unitSuffix,
  onRightIconPress,
  containerStyle,
  inputContainerStyle,
  inputStyle,
  labelStyle,
  onFocus,
  onBlur,
  testID,
  ...rest
}: AppTextInputProps) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);

  const getBorderColor = (): string => {
    if (hasError) return theme.danger;
    if (isFocused) return theme.inputFocusBorder;
    return theme.inputBorder;
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Top Label */}
      {label ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: theme.textSecondary }, labelStyle]}>
            {label}
            {required ? <Text style={{ color: theme.danger }}> *</Text> : null}
          </Text>
        </View>
      ) : null}

      {/* Input Field Box */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.inputBg,
            borderColor: getBorderColor(),
          },
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          inputContainerStyle,
        ]}>
        {leftIcon ? <View style={styles.leftIconWrap}>{leftIcon}</View> : null}

        <TextInput
          testID={testID}
          style={[
            styles.input,
            {
              color: theme.text,
            },
            inputStyle,
          ]}
          placeholderTextColor={theme.textMuted}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {unitSuffix ? (
          <View style={[styles.suffixBadge, { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.suffixText, { color: theme.textSecondary }]}>
              {unitSuffix}
            </Text>
          </View>
        ) : null}

        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            style={styles.rightIconWrap}>
            {rightIcon}
          </Pressable>
        ) : null}
      </View>

      {/* Error or Helper Message */}
      {hasError ? (
        <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helperText, { color: theme.textMuted }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  label: {
    fontSize: Typography.subhead.fontSize,
    lineHeight: Typography.subhead.lineHeight,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: Layout.inputHeight, // 48px
    borderRadius: BorderRadius.md, // 12px
    borderWidth: 1.2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  inputFocused: {
    borderWidth: 1.5,
  },
  inputError: {
    borderWidth: 1.5,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
    paddingVertical: 0,
  },
  leftIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
  },
  suffixBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suffixText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '700',
  },
  errorText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '500',
    marginTop: 2,
  },
  helperText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '400',
    marginTop: 2,
  },
});
