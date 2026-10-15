import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface HerdAlertBannerProps {
  title: string;
  subtitle: string;
  onPress?: () => void;
}

function HerdAlertBannerBase({ title, subtitle, onPress }: HerdAlertBannerProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.morningBg, borderColor: theme.morningBorder },
        pressed && styles.pressed,
      ]}>
      <AppIcon name="calendar" size={18} color={theme.morning} />
      <View style={styles.textGroup}>
        <ThemedText style={[styles.title, { color: theme.morning }]} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <AppIcon name="chevronRight" size={16} color={theme.morning} />
    </Pressable>
  );
}

export const HerdAlertBanner = memo(HerdAlertBannerBase);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 52,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  textGroup: { flex: 1, gap: 1 },
  title: { fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  subtitle: { fontSize: Typography.footnote.fontSize, fontWeight: '500' },
  pressed: { opacity: 0.8 },
});
