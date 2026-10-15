import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppCard, AppIcon } from '@/components/ui';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { LivestockSummary } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface HerdSummaryCardProps {
  summary: LivestockSummary;
}

function HerdSummaryCardBase({ summary }: HerdSummaryCardProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const segments = [
    { key: 'cows', count: summary.cowsCount, color: theme.primary, label: isUrdu ? 'گائیں' : 'cows' },
    { key: 'buffaloes', count: summary.buffaloesCount, color: theme.evening, label: isUrdu ? 'مجھاں' : 'buffaloes' },
    { key: 'calves', count: summary.calvesCount, color: theme.morning, label: isUrdu ? 'وچھے/کٹیاں' : 'calves' },
  ];

  return (
    <AppCard variant="default" padding="md" style={styles.card}>
      <View style={styles.topRow}>
        <View>
          <ThemedText style={[styles.label, { color: theme.textSecondary }]}>
            {isUrdu ? 'کل جانور (ڈنگر)' : 'Total animals'}
          </ThemedText>
          <ThemedText style={styles.totalNumber}>{summary.totalAnimals}</ThemedText>
        </View>

        <View style={[styles.lactatingBadge, { backgroundColor: theme.primaryLight }]}>
          <AppIcon name="milk" size={14} color={theme.primaryDark} />
          <ThemedText style={[styles.lactatingText, { color: theme.primaryDark }]}>
            {summary.lactatingCount} {isUrdu ? 'چوئی والیاں' : 'lactating'}
          </ThemedText>
        </View>
      </View>

      {/* Proportional bar */}
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}>
        {summary.totalAnimals > 0
          ? segments.map((s) =>
              s.count > 0 ? <View key={s.key} style={{ flex: s.count, backgroundColor: s.color }} /> : null
            )
          : null}
      </View>

      <View style={styles.legendRow}>
        {segments.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
              {s.count} {s.label}
            </ThemedText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

export const HerdSummaryCard = memo(HerdSummaryCardBase);

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: Typography.subhead.fontSize, fontWeight: '500' },
  totalNumber: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  lactatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  lactatingText: { fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  bar: { flexDirection: 'row', height: 8, borderRadius: BorderRadius.full, overflow: 'hidden', gap: 2 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: Spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: Typography.footnote.fontSize, fontWeight: '500' },
});
