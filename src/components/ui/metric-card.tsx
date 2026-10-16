import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { AppCard } from './card';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ==========================================
// 1. HERO FINANCIAL CARD (Deep Emerald Green)
// ==========================================

export interface ShiftStat {
  label: string; // e.g. "Morning", "Evening"
  value: string; // e.g. "90 L", "60 L"
  icon?: string; // emoji or icon indicator
}

export interface HeroFinancialCardProps {
  title: string; // e.g. "MILK SOLD TODAY"
  primaryValue: string; // e.g. "150 L"
  secondaryLabel?: string; // e.g. "Revenue"
  secondaryValue?: string; // e.g. "Rs 30,000"
  subtitle?: string; // e.g. "Lactating · 22 / 39 lactating animals"
  rightFootnote?: string; // e.g. "Avg. fat 4.5%"
  shifts?: ShiftStat[]; // Morning / Evening breakdown
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function HeroFinancialCard({
  title,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  subtitle,
  rightFootnote,
  shifts,
  icon,
  onPress,
  style,
}: HeroFinancialCardProps) {
  const theme = useTheme();

  return (
    <AppCard
      variant="featuredDark"
      padding="xl"
      onPress={onPress}
      style={[styles.heroCard, style]}>
      {/* Top Header Row */}
      <View style={styles.heroTopRow}>
        <View style={styles.heroLeftCol}>
          <Text style={[styles.heroLabel, { color: theme.cardDarkSubtext }]}>
            {title.toUpperCase()}
          </Text>
          <Text style={[styles.heroPrimaryValue, { color: theme.cardDarkText }]}>
            {primaryValue}
          </Text>
        </View>

        {secondaryValue ? (
          <View style={styles.heroRightCol}>
            {secondaryLabel ? (
              <Text style={[styles.heroSecondaryLabel, { color: theme.cardDarkSubtext }]}>
                {secondaryLabel}
              </Text>
            ) : null}
            <Text style={[styles.heroSecondaryValue, { color: theme.cardDarkText }]}>
              {secondaryValue}
            </Text>
          </View>
        ) : icon ? (
          <View style={styles.heroIconCol}>{icon}</View>
        ) : null}
      </View>

      {/* Middle Subtitle / Detail Row */}
      {subtitle || rightFootnote ? (
        <View style={styles.heroSubRow}>
          {subtitle ? (
            <Text style={[styles.heroSubtext, { color: theme.cardDarkSubtext }]}>
              {subtitle}
            </Text>
          ) : null}
          {rightFootnote ? (
            <Text style={[styles.heroSubtext, { color: theme.cardDarkSubtext }]}>
              {rightFootnote}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Shifts Breakdown Row */}
      {shifts && shifts.length > 0 ? (
        <View style={styles.heroShiftsRow}>
          {shifts.map((shift, idx) => (
            <View key={idx} style={styles.heroShiftItem}>
              <Text style={styles.heroShiftIcon} accessibilityElementsHidden importantForAccessibility="no">{shift.icon ?? (idx === 0 ? '☀️' : '🌙')}</Text>
              <View>
                <Text style={[styles.heroShiftLabel, { color: theme.cardDarkSubtext }]}>
                  {shift.label}
                </Text>
                <Text style={[styles.heroShiftValue, { color: theme.cardDarkText }]}>
                  {shift.value}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </AppCard>
  );
}

// ==========================================
// 2. MINT HIGHLIGHT CARD (Soft Mint Card)
// ==========================================

export interface MintHighlightCardProps {
  label: string; // e.g. "Total outstanding", "Calculated sale amount"
  value: string; // e.g. "Rs 37,000", "Rs 13,000"
  footnote?: string; // e.g. "Includes Rs 12,000 brought forward"
  icon?: React.ReactNode;
  columns?: { label: string; value: string }[];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function MintHighlightCard({
  label,
  value,
  footnote,
  icon,
  columns,
  onPress,
  style,
}: MintHighlightCardProps) {
  const theme = useTheme();

  return (
    <AppCard variant="mint" padding="lg" onPress={onPress} style={style}>
      <View style={styles.mintHeaderRow}>
        <View style={styles.mintMainCol}>
          <Text style={[styles.mintLabel, { color: theme.cardMintText }]}>{label}</Text>
          <Text style={[styles.mintValue, { color: theme.cardMintText }]}>{value}</Text>
        </View>
        {icon ? <View style={styles.mintIconWrap}>{icon}</View> : null}
      </View>

      {/* Multi-column breakdown (e.g. Feed purchases Rs 38,500 / Other expenses Rs 10,000) */}
      {columns && columns.length > 0 ? (
        <View style={styles.mintColsRow}>
          {columns.map((col, idx) => (
            <View key={idx} style={styles.mintColItem}>
              <Text style={[styles.mintColLabel, { color: theme.textSecondary }]}>
                {col.label}
              </Text>
              <Text style={[styles.mintColValue, { color: theme.text }]}>
                {col.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {footnote ? (
        <Text style={[styles.mintFootnote, { color: theme.textSecondary }]}>
          {footnote}
        </Text>
      ) : null}
    </AppCard>
  );
}

// ==========================================
// 3. STAT CARD (White 2-column or grid card)
// ==========================================

export interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  subtext?: string;
  subtextColor?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function StatCard({
  label,
  value,
  unit,
  subtext,
  subtextColor,
  icon,
  onPress,
  style,
}: StatCardProps) {
  const theme = useTheme();

  return (
    <AppCard
      variant="default"
      padding="md"
      onPress={onPress}
      style={[styles.statCardBase, style]}>
      {icon ? <View style={styles.statIconWrap}>{icon}</View> : null}

      <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>

      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        {unit ? (
          <Text style={[styles.statUnit, { color: theme.textSecondary }]}>{unit}</Text>
        ) : null}
      </View>

      {subtext ? (
        <Text
          style={[styles.statSubtext, { color: subtextColor ?? theme.textMuted }]}
          numberOfLines={1}>
          {subtext}
        </Text>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  // Hero Financial Card
  heroCard: {
    gap: Spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLeftCol: {
    flex: 1,
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  heroPrimaryValue: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  heroRightCol: {
    alignItems: 'flex-end',
  },
  heroSecondaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  heroSecondaryValue: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  heroIconCol: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroSubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
  heroShiftsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    paddingTop: 6,
  },
  heroShiftItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroShiftIcon: {
    fontSize: 16,
  },
  heroShiftLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  heroShiftValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Mint Highlight Card
  mintHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mintMainCol: {
    flex: 1,
  },
  mintLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  mintValue: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  mintIconWrap: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mintColsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(21, 128, 61, 0.2)',
  },
  mintColItem: {
    flex: 1,
  },
  mintColLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  mintColValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  mintFootnote: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },

  // Stat Card
  statCardBase: {
    flex: 1,
    justifyContent: 'space-between',
  },
  statIconWrap: {
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginVertical: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  statSubtext: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
});
