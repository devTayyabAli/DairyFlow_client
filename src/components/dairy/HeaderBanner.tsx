import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { OfflineStatusBadge } from './OfflineStatusBadge';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

interface HeaderBannerProps {
  selectedDate: string; // YYYY-MM-DD
  farmName?: string;
}

export function HeaderBanner({ selectedDate, farmName }: HeaderBannerProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const displayFarmName = farmName || (isUrdu ? 'الرحمان ڈیری فارم' : 'Dairy Farm Manager');

  // Format date nicely e.g. "Tuesday, Oct 14"
  const formattedDate = (() => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return selectedDate;
    }
  })();

  const isToday = (() => {
    const today = new Date().toISOString().split('T')[0];
    return selectedDate === today;
  })();

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconWrap, { backgroundColor: theme.primaryLight }]}>
            <Ionicons name="leaf" size={20} color={theme.primary} />
          </View>
          <View>
            <ThemedText style={styles.farmTitle} type="smallBold">
              {displayFarmName}
            </ThemedText>
            <ThemedText style={styles.subTitle} type="small">
              {isUrdu ? 'روزانہ دودھ دا ریکارڈ تے شفٹاں' : 'Milk Collection & Shifts'}
            </ThemedText>
          </View>
        </View>
        <OfflineStatusBadge />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.dateRow}>
        <View style={styles.dateLabelGroup}>
          <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
          <ThemedText style={styles.dateText}>
            {formattedDate}
          </ThemedText>
        </View>

        {isToday ? (
          <View style={[styles.todayChip, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.todayText, { color: theme.primaryDark }]}>
              {isUrdu ? 'اج دا دن' : 'TODAY'}
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.historicalChip, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.historicalText, { color: theme.textSecondary }]}>
              {isUrdu ? 'پچھلا ریکارڈ' : 'PAST RECORD'}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  farmTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.primaryDark,
  },
  subTitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  todayText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  historicalChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historicalText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
