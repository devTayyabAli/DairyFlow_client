import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { ShiftType } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

interface ShiftFilterBarProps {
  selectedShift: ShiftType | 'All';
  onSelectShift: (shift: ShiftType | 'All') => void;
  selectedDate: string; // YYYY-MM-DD
  onChangeDate: (date: string) => void;
  onOpenAddModal?: () => void;
}

export function ShiftFilterBar({
  selectedShift,
  onSelectShift,
  selectedDate,
  onChangeDate,
  onOpenAddModal,
}: ShiftFilterBarProps) {
  const theme = useTheme();

  // Robust timezone-safe local date parsing and formatting
  const parseLocalDate = (dateStr: string): Date => {
    try {
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
    } catch {
      // fallback
    }
    return new Date();
  };

  const formatLocalDate = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const handlePrevDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() - 1);
    onChangeDate(formatLocalDate(d));
  };

  const handleNextDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + 1);
    onChangeDate(formatLocalDate(d));
  };

  const handleGoToday = () => {
    onChangeDate(formatLocalDate(new Date()));
  };

  const isToday = selectedDate === formatLocalDate(new Date());

  return (
    <View style={styles.container}>
      {/* Date Navigation Scrubber Strip */}
      <View
        style={[
          styles.dateNavRow,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <Pressable
          onPress={handlePrevDay}
          accessibilityRole="button"
          accessibilityLabel="Previous Day"
          style={({ pressed }) => [styles.dateNavBtn, pressed && styles.pressed]}>
          <Ionicons name="chevron-back" size={16} color={theme.primary} />
          <ThemedText style={[styles.dateNavBtnText, { color: theme.primary }]}>
            Prev
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleGoToday}
          accessibilityRole="button"
          accessibilityLabel="Go to Today"
          style={({ pressed }) => [
            styles.todayBtn,
            isToday && { backgroundColor: theme.primaryLight },
            pressed && styles.pressed,
          ]}>
          <Ionicons
            name="today-outline"
            size={15}
            color={isToday ? theme.primaryDark : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.todayBtnText,
              { color: isToday ? theme.primaryDark : theme.textSecondary },
            ]}>
            Today
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={handleNextDay}
          accessibilityRole="button"
          accessibilityLabel="Next Day"
          style={({ pressed }) => [styles.dateNavBtn, pressed && styles.pressed]}>
          <ThemedText style={[styles.dateNavBtnText, { color: theme.primary }]}>
            Next
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </Pressable>
      </View>

      {/* Shifts Filter Segment Row */}
      <View style={styles.filterAndActionRow}>
        <View style={styles.shiftSegmentGroup}>
          {(['All', 'Morning', 'Evening'] as const).map((shift) => {
            const isSelected = selectedShift === shift;
            return (
              <Pressable
                key={shift}
                onPress={() => onSelectShift(shift)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.segmentBtn,
                  {
                    backgroundColor: isSelected ? theme.primary : theme.card,
                    borderColor: isSelected ? theme.primary : theme.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <ThemedText
                  style={[
                    styles.segmentText,
                    {
                      color: isSelected ? '#FFFFFF' : theme.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}>
                  {shift === 'All' ? 'All Shifts' : shift === 'Morning' ? '☀️ Morning' : '🌙 Evening'}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Optional Quick Add Entry Button (if passed) */}
        {onOpenAddModal ? (
          <Pressable
            onPress={onOpenAddModal}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.addEntryBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <ThemedText style={styles.addEntryText}>Add</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  dateNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    elevation: 1,
  },
  dateNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
  },
  dateNavBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  todayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  todayBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterAndActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  shiftSegmentGroup: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontSize: 12,
  },
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    elevation: 2,
  },
  addEntryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
