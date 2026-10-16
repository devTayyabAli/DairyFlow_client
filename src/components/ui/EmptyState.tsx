import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/button';
import { AppIcon, SemanticIconName } from '@/components/ui/icon';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: SemanticIconName;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Friendly placeholder for lists/sections that have no data yet. */
export function EmptyState({
  title,
  message,
  icon = 'milk',
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="summary"
      style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }, style]}>
      <View style={[styles.iconRing, { backgroundColor: theme.primaryLight }]}>
        <AppIcon name={icon} size={30} color={theme.primary} />
      </View>
      <ThemedText type="headline" style={styles.center}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="subhead" themeColor="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} size="md" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  center: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.sm,
    alignSelf: 'stretch',
  },
});
