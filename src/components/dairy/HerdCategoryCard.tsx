import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppIcon, SemanticIconName } from '@/components/ui';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { AnimalSpecies, LivestockSummary } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface HerdCategoryGridProps {
  summary: LivestockSummary;
  selectedCategory?: AnimalSpecies | 'All';
  onSelectCategory?: (category: AnimalSpecies | 'All') => void;
}

function HerdCategoryGridBase({
  summary,
  selectedCategory = 'All',
  onSelectCategory,
}: HerdCategoryGridProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const items = useMemo<
    { key: AnimalSpecies; icon: SemanticIconName; name: string; count: number; sub: string }[]
  >(
    () => [
      {
        key: 'Cow',
        icon: 'cow',
        name: isUrdu ? 'گائیں' : 'Cows',
        count: summary.cowsCount,
        sub: `${summary.cowsLactating} ${isUrdu ? 'چوئی والیاں' : 'lactating'}`,
      },
      {
        key: 'Buffalo',
        icon: 'buffalo',
        name: isUrdu ? 'مجھاں' : 'Buffaloes',
        count: summary.buffaloesCount,
        sub: `${summary.buffaloesLactating} ${isUrdu ? 'چوئی والیاں' : 'lactating'}`,
      },
      {
        key: 'Calf',
        icon: 'sprout',
        name: isUrdu ? 'وچھے، کٹیاں' : 'Calves',
        count: summary.calvesCount,
        sub: `${summary.calvesFemale}f · ${summary.calvesMale}m`,
      },
    ],
    [isUrdu, summary]
  );

  return (
    <View style={styles.grid}>
      {items.map((item) => {
        const selected = selectedCategory === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelectCategory?.(selected ? 'All' : item.key)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: selected ? theme.cardMint : theme.card,
                borderColor: selected ? theme.primary : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <AppIcon name={item.icon} size={20} color={theme.primary} />
            <ThemedText style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.name}
            </ThemedText>
            <ThemedText style={styles.count}>{item.count}</ThemedText>
            <ThemedText style={[styles.sub, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.sub}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const HerdCategoryGrid = memo(HerdCategoryGridBase);

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: Spacing.sm },
  card: {
    flex: 1,
    minHeight: 48,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 2,
  },
  pressed: { opacity: 0.8 },
  name: { fontSize: Typography.footnote.fontSize, fontWeight: '500', marginTop: 4 },
  count: { fontSize: Typography.title3.fontSize, fontWeight: '800' },
  sub: { fontSize: Typography.caption.fontSize, fontWeight: '500' },
});
