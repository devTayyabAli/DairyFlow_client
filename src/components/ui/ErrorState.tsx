import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/button';
import { AppIcon } from '@/components/ui/icon';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Inline error with an optional retry action. */
export function ErrorState({
  message,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
  style,
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        { backgroundColor: theme.dangerBg, borderColor: theme.danger },
        style,
      ]}>
      <AppIcon name="alert" size={28} color={theme.danger} />
      <ThemedText type="headline" style={[styles.center, { color: theme.danger }]}>
        {title}
      </ThemedText>
      <ThemedText type="subhead" style={[styles.center, { color: theme.text }]}>
        {message}
      </ThemedText>
      {onRetry ? (
        <AppButton title={retryLabel} onPress={onRetry} variant="outline" size="md" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  center: {
    textAlign: 'center',
  },
});
