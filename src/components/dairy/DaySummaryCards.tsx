import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { DaySummary } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

interface DaySummaryCardsProps {
  summary: DaySummary;
  currencySymbol?: string;
}

export function DaySummaryCards({ summary, currencySymbol = 'Rs.' }: DaySummaryCardsProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {/* Primary Highlights: 2 main cards side by side */}
      <View style={styles.row}>
        {/* Total Liters Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: theme.primaryLight }]}>
              <MaterialCommunityIcons name="cup-water" size={18} color={theme.primary} />
            </View>
            <ThemedText style={styles.cardTitle} type="small">
              Total Production
            </ThemedText>
          </View>

          <View style={styles.valueRow}>
            <ThemedText style={[styles.bigNumber, { color: theme.primaryDark }]}>
              {summary.totalLiters.toFixed(1)}
            </ThemedText>
            <ThemedText style={styles.unitText}>Liters</ThemedText>
          </View>

          {/* Morning / Evening Sub-badges */}
          <View style={styles.shiftsSubRow}>
            <View style={[styles.shiftChip, { backgroundColor: Colors.light.morningBg }]}>
              <ThemedText style={[styles.shiftChipText, { color: Colors.light.morning }]}>
                ☀️ {summary.morningLiters.toFixed(1)} L
              </ThemedText>
            </View>
            <View style={[styles.shiftChip, { backgroundColor: Colors.light.eveningBg }]}>
              <ThemedText style={[styles.shiftChipText, { color: Colors.light.evening }]}>
                🌙 {summary.eveningLiters.toFixed(1)} L
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Total Revenue Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.iconContainer, { backgroundColor: Colors.light.accentBg }]}>
              <Ionicons name="cash-outline" size={18} color={Colors.light.accent} />
            </View>
            <ThemedText style={styles.cardTitle} type="small">
              Total Revenue
            </ThemedText>
          </View>

          <View style={styles.valueRow}>
            <ThemedText style={[styles.bigNumber, { color: Colors.light.primaryDark }]}>
              {currencySymbol} {summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
            </ThemedText>
          </View>

          {/* Revenue shift breakdown */}
          <View style={styles.shiftsSubRow}>
            <View style={[styles.shiftChip, { backgroundColor: Colors.light.morningBg }]}>
              <ThemedText style={[styles.shiftChipText, { color: Colors.light.morning }]}>
                ☀️ {currencySymbol}{Math.round(summary.morningRevenue)}
              </ThemedText>
            </View>
            <View style={[styles.shiftChip, { backgroundColor: Colors.light.eveningBg }]}>
              <ThemedText style={[styles.shiftChipText, { color: Colors.light.evening }]}>
                🌙 {currencySymbol}{Math.round(summary.eveningRevenue)}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>

      {/* Tertiary Status Strip: Average Fat & Total Saved Entries */}
      <View style={[styles.qualityStrip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <View style={styles.qualityItem}>
          <Ionicons name="flask-outline" size={16} color={theme.primary} />
          <ThemedText style={styles.qualityLabel}>Avg. Fat Content:</ThemedText>
          <ThemedText style={[styles.qualityValue, { color: theme.primaryDark }]}>
            {summary.avgFat > 0 ? `${summary.avgFat}%` : '—'}
          </ThemedText>
        </View>

        <View style={[styles.stripDivider, { backgroundColor: theme.border }]} />

        <View style={styles.qualityItem}>
          <Ionicons name="layers-outline" size={16} color={theme.primary} />
          <ThemedText style={styles.qualityLabel}>Saved Entries:</ThemedText>
          <ThemedText style={[styles.qualityValue, { color: theme.primaryDark }]}>
            {summary.entriesCount}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 4,
  },
  bigNumber: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  shiftsSubRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  shiftChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  qualityStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
  qualityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  qualityValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  stripDivider: {
    width: 1,
    height: 18,
  },
});
