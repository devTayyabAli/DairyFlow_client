import React, { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppCard } from '@/components/ui/card';
import { AppIcon } from '@/components/ui/icon';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { BuyerOverviewItem, BuyerWithStats } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return 'BY';
  const words = clean.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

interface BuyerCardProps {
  buyer: BuyerWithStats;
  maxLiters?: number;
  onPress: (buyer: BuyerWithStats) => void;
}

function BuyerCardComponent({ buyer, maxLiters = 0, onPress }: BuyerCardProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  // Extract initials from buyer name (e.g. "Ahmed Milk Centre" -> "AM")
  const initials = useMemo(() => getInitials(buyer.name), [buyer.name]);

  // Volume share percentage for the visual progress bar
  const volumePercentage = useMemo(() => {
    if (!maxLiters || maxLiters <= 0 || buyer.totalLiters <= 0) return 6;
    const ratio = Math.min(100, Math.round((buyer.totalLiters / maxLiters) * 100));
    return Math.max(8, ratio);
  }, [buyer.totalLiters, maxLiters]);

  return (
    <AppCard variant="default" padding="md" style={styles.cardContainer}>
      <Pressable
        onPress={() => onPress(buyer)}
        accessibilityRole="button"
        accessibilityLabel={`View account for ${buyer.name}`}
        style={({ pressed }) => [styles.pressableWrap, pressed && styles.pressed]}>
        {/* Top Header Row */}
        <View style={styles.topRow}>
          {/* Avatar Initials Bubble */}
          <View style={[styles.avatarBubble, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarText, { color: theme.primaryDark }]}>
              {initials}
            </ThemedText>
          </View>

          {/* Name & Contact Subtitle */}
          <View style={styles.nameContainer}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.buyerName} numberOfLines={1}>
                {buyer.name}
              </ThemedText>
            </View>

            {/* Subtitle / Details */}
            <View style={styles.subtitleRow}>
              {buyer.address ? (
                <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {buyer.address}
                </ThemedText>
              ) : buyer.phone ? (
                <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {buyer.phone}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.subtitleMuted, { color: theme.textMuted }]}>
                  {isUrdu ? 'رجسٹرڈ گاہک' : 'Registered customer'}
                </ThemedText>
              )}
            </View>
          </View>

          {/* Right Default Badge & Chevron */}
          <View style={styles.rightGroup}>
            {buyer.is_default === 1 ? (
              <View style={[styles.defaultBadge, { backgroundColor: theme.primaryLight }]}>
                <ThemedText style={[styles.defaultBadgeText, { color: theme.primaryDark }]}>
                  {isUrdu ? 'بنیادی' : 'DEFAULT'}
                </ThemedText>
              </View>
            ) : null}
            <AppIcon name="chevronRight" size={16} color={theme.textMuted} />
          </View>
        </View>

        {/* 3-Column Stats Row (matching Screenshot 151325) */}
        <View style={[styles.statsRow, { borderColor: theme.border }]}>
          {/* Column 1: Sales to Date */}
          <View style={styles.statCol}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'کل فروخت' : 'Sales · to date'}
            </ThemedText>
            <ThemedText style={styles.statValue}>
              Rs {Math.round(buyer.totalRevenue).toLocaleString()}
            </ThemedText>
          </View>

          {/* Column 2: Total Volume */}
          <View style={styles.statCol}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'کل دودھ' : 'Volume'}
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.primaryDark }]}>
              {buyer.totalLiters.toFixed(1)} {isUrdu ? 'لیٹر' : 'L'}
            </ThemedText>
          </View>

          {/* Column 3: Total Deliveries / Records */}
          <View style={[styles.statCol, styles.statColRight]}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'اندراج' : 'Deliveries'}
            </ThemedText>
            <ThemedText style={styles.statValue}>
              {isUrdu
                ? `${buyer.entriesCount} بار`
                : `${buyer.entriesCount} ${buyer.entriesCount === 1 ? 'sale' : 'sales'}`}
            </ThemedText>
          </View>
        </View>

        {/* Volume Activity Indicator Bar */}
        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${volumePercentage}%`,
                backgroundColor: buyer.totalLiters > 0 ? theme.primary : theme.textMuted,
              },
            ]}
          />
        </View>
      </Pressable>
    </AppCard>
  );
}

export const BuyerCard = React.memo(BuyerCardComponent);

// ---------------------------------------------------------------------------
// Buyers tab card (sales / paid / balance due + payment progress)
// ---------------------------------------------------------------------------

interface BuyerOverviewCardProps {
  item: BuyerOverviewItem;
  onPress: (buyerId: number) => void;
  onDelete?: (item: BuyerOverviewItem) => void;
}

function BuyerOverviewCardComponent({ item, onPress, onDelete }: BuyerOverviewCardProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { buyer } = item;

  const initials = useMemo(() => getInitials(buyer.name), [buyer.name]);
  const hasBalance = item.balanceDue > 0;
  const paidPct = Math.max(0, Math.min(100, Number.isFinite(item.percentagePaid) ? item.percentagePaid : 0));
  const subtitle = buyer.address || buyer.phone || (isUrdu ? 'رجسٹرڈ گاہک' : 'Registered customer');

  const handlePress = useCallback(() => onPress(buyer.id), [onPress, buyer.id]);

  return (
    <AppCard variant="default" padding="md">
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={isUrdu ? `${buyer.name} کا کھاتہ` : `Open account for ${buyer.name}`}
        style={({ pressed }) => [styles.pressableWrap, pressed && styles.pressed]}>
        <View style={styles.topRow}>
          <View style={[styles.avatarBubble, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarText, { color: theme.primaryDark }]}>{initials}</ThemedText>
          </View>

          <View style={styles.nameContainer}>
            <ThemedText style={styles.buyerName} numberOfLines={1}>
              {buyer.name}
            </ThemedText>
            <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]} numberOfLines={1}>
              {subtitle}
              {item.weeklyLiters > 0 ? ` · ${item.weeklyLiters} L ${isUrdu ? 'اس ہفتے' : 'this week'}` : ''}
            </ThemedText>
          </View>

          {buyer.is_default === 1 ? (
            <View style={[styles.defaultBadge, { backgroundColor: theme.primaryLight }]}>
              <ThemedText style={[styles.defaultBadgeText, { color: theme.primaryDark }]}>
                {isUrdu ? 'بنیادی' : 'DEFAULT'}
              </ThemedText>
            </View>
          ) : null}
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUrdu ? `${buyer.name} حذف کریں` : `Delete ${buyer.name}`}
              hitSlop={10}
              onPress={(e) => {
                e.stopPropagation?.();
                onDelete(item);
              }}
              style={({ pressed }) => [styles.deleteCardBtn, pressed && styles.pressed]}>
              <AppIcon name="trash" size={16} color={theme.danger} />
            </Pressable>
          ) : (
            <AppIcon name="chevronRight" size={16} color={theme.textMuted} />
          )}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'فروخت' : 'Sales'}
            </ThemedText>
            <ThemedText style={styles.statValue}>Rs {Math.round(item.totalSalesAmount).toLocaleString()}</ThemedText>
          </View>
          <View style={styles.statCol}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'ادا شدہ' : 'Paid'}
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: theme.success }]}>
              Rs {Math.round(item.totalPaidAmount).toLocaleString()}
            </ThemedText>
          </View>
          <View style={[styles.statCol, styles.statColRight]}>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'بقایا' : 'Balance due'}
            </ThemedText>
            <ThemedText style={[styles.statValue, { color: hasBalance ? theme.danger : theme.success }]}>
              Rs {Math.round(item.balanceDue).toLocaleString()}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: theme.backgroundElement }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${paidPct}%`, backgroundColor: paidPct >= 100 ? theme.success : theme.primary },
            ]}
          />
        </View>
      </Pressable>
    </AppCard>
  );
}

export const BuyerOverviewCard = React.memo(BuyerOverviewCardComponent);

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: Spacing.md,
  },
  pressableWrap: {
    gap: Spacing.sm,
  },
  pressed: {
    opacity: 0.85,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarBubble: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  nameContainer: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buyerName: {
    fontSize: Typography.bodyBold.fontSize,
    fontWeight: '700',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subtitleText: {
    fontSize: Typography.footnote.fontSize,
  },
  subtitleMuted: {
    fontSize: Typography.footnote.fontSize,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  defaultBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
    marginTop: 2,
  },
  statCol: {
    flex: 1,
    gap: 2,
  },
  statColRight: {
    alignItems: 'flex-end',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  deleteCardBtn: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
});
