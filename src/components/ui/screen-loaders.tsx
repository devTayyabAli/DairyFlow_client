import React from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { Skeleton } from './skeleton';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A card-shaped skeleton row: avatar/badge, two text lines and an amount. */
export function SkeletonRow() {
  const theme = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Skeleton width={40} height={40} radius={BorderRadius.md} />
      <View style={styles.rowText}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={11} />
      </View>
      <Skeleton width={56} height={16} />
    </View>
  );
}

/** Placeholder for list screens while their first query runs. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <View style={styles.list} accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

/** Placeholder shaped like the dashboard: hero card, two stat cards, then list rows. */
export function DashboardSkeleton() {
  const theme = useTheme();
  return (
    <View style={styles.list} accessibilityLabel="Loading" accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <Skeleton width={42} height={42} radius={BorderRadius.md} />
        <View style={styles.rowText}>
          <Skeleton width="45%" height={16} />
          <Skeleton width="30%" height={11} />
        </View>
      </View>
      <View style={[styles.hero, { backgroundColor: theme.cardDark }]}>
        <Skeleton width="35%" height={11} style={styles.onDark} />
        <Skeleton width="55%" height={30} style={styles.onDark} />
        <Skeleton width="80%" height={11} style={styles.onDark} />
      </View>
      <View style={styles.statsRow}>
        {[0, 1].map((i) => (
          <View key={i} style={[styles.stat, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Skeleton width={32} height={32} radius={BorderRadius.md} />
            <Skeleton width="60%" height={11} />
            <Skeleton width="75%" height={20} />
          </View>
        ))}
      </View>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

/**
 * Blocks the screen during a longer operation (restoring a backup, creating a PDF) so the user
 * cannot tap other things, with a short explanation of what is happening.
 */
export function BusyOverlay({ visible, message }: { visible: boolean; message: string }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay} accessibilityViewIsModal>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={message}
          accessibilityLiveRegion="polite"
          style={[styles.busyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.busyText, { color: theme.text }]}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

/** Small inline spinner with a label, for "Loading more…" or refreshing sections. */
export function InlineLoader({ label }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.inline} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="small" color={theme.primary} />
      {label ? <Text style={[styles.inlineText, { color: theme.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  rowText: { flex: 1, gap: 8 },
  hero: { borderRadius: BorderRadius.xl, padding: Spacing.xl, gap: Spacing.md },
  onDark: { backgroundColor: 'rgba(255,255,255,0.22)' },
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  stat: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  busyCard: {
    minWidth: 200,
    maxWidth: 280,
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    ...Shadows.lg,
  },
  busyText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md },
  inlineText: { fontSize: 13, fontWeight: '500' },
});
