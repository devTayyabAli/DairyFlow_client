import { Ionicons } from '@expo/vector-icons';
import React, { memo, useCallback, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { MilkEntry } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

interface MilkEntryCardProps {
  entry: MilkEntry;
  onDelete: (id: number) => void;
  onEdit?: (entry: MilkEntry) => void;
  currencySymbol?: string;
}

function MilkEntryCardBase({ entry, onDelete, onEdit, currencySymbol = 'Rs' }: MilkEntryCardProps) {
  const theme = useTheme();

  const isMorning = entry.shift === 'Morning';
  const shiftBg = isMorning ? theme.morningBg : theme.eveningBg;
  const shiftColor = isMorning ? theme.morning : theme.evening;

  const formattedTime = useMemo(() => {
    const d = new Date(entry.created_at);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }, [entry.created_at]);

  const handleDeletePress = useCallback(() => {
    Alert.alert(
      'Delete entry',
      `Delete this ${entry.shift} entry of ${entry.liters} L (${currencySymbol} ${entry.total_amount})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
      ]
    );
  }, [currencySymbol, entry.id, entry.liters, entry.shift, entry.total_amount, onDelete]);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.shiftBadge, { backgroundColor: shiftBg }]}>
          <Ionicons name={isMorning ? 'sunny' : 'moon'} size={12} color={shiftColor} />
          <ThemedText style={[styles.shiftText, { color: shiftColor }]}>{entry.shift}</ThemedText>
        </View>

        <View style={styles.topRight}>
          {formattedTime ? (
            <ThemedText style={[styles.timeText, { color: theme.textMuted }]}>{formattedTime}</ThemedText>
          ) : null}
          {onEdit ? (
            <Pressable
              onPress={() => onEdit(entry)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit entry"
              style={styles.actionBtn}>
              <Ionicons name="pencil-outline" size={17} color={theme.textSecondary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleDeletePress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Delete entry"
            style={styles.actionBtn}>
            <Ionicons name="trash-outline" size={17} color={theme.danger} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mainRow}>
        <ThemedText style={styles.buyer} numberOfLines={1}>
          {entry.buyer_name}
        </ThemedText>
        <ThemedText style={[styles.amount, { color: theme.primaryDark }]}>
          {currencySymbol} {entry.total_amount.toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </ThemedText>
      </View>

      <ThemedText style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
        {entry.liters.toFixed(1)} L · {entry.fat_percentage}% fat · {currencySymbol} {entry.rate_per_liter}/L
        {entry.notes ? ` · ${entry.notes}` : ''}
      </ThemedText>
    </View>
  );
}

export const MilkEntryCard = memo(MilkEntryCardBase);

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: 6,
    ...Shadows.subtle,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  shiftText: { fontSize: 11, fontWeight: '700' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeText: { fontSize: 12 },
  actionBtn: { padding: 4 },
  mainRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.sm },
  buyer: { flex: 1, fontSize: 16, fontWeight: '700' },
  amount: { fontSize: 17, fontWeight: '800' },
  meta: { fontSize: 12.5 },
});
