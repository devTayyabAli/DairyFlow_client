import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddBuyerModal } from '@/components/dairy/AddBuyerModal';
import { AddMilkEntryModal } from '@/components/dairy/AddMilkEntryModal';
import { EmptyEntriesState } from '@/components/dairy/EmptyEntriesState';
import { MilkEntryCard } from '@/components/dairy/MilkEntryCard';
import { OfflineStatusBadge } from '@/components/dairy/OfflineStatusBadge';
import { ShiftFilterBar } from '@/components/dairy/ShiftFilterBar';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppIcon,
  HeroFinancialCard,
  IconBubble,
  LanguageToggleButton,
  StatCard,
} from '@/components/ui';
import { BorderRadius, Layout, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import {
  addBuyer,
  Buyer,
  DaySummary,
  deleteMilkEntry,
  ExpenseSummary,
  getAllBuyers,
  getDaySummary,
  getDefaultBuyer,
  getEntriesForDate,
  getExpenseSummary,
  insertMilkEntry,
  MilkEntry,
  NewMilkEntry,
  ShiftType,
  updateMilkEntry,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { logger } from '@/utils/logger';

const EMPTY_SUMMARY: DaySummary = {
  totalLiters: 0,
  totalRevenue: 0,
  morningLiters: 0,
  eveningLiters: 0,
  morningRevenue: 0,
  eveningRevenue: 0,
  avgFat: 0,
  entriesCount: 0,
};

// Timezone-safe local calendar date (YYYY-MM-DD)
function getLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const formatRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function HomeScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { farmName } = useAdmin();
  const { syncNow, isSignedIn } = useSync();

  const todayDateStr = getLocalDateStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);
  const [selectedShift, setSelectedShift] = useState<ShiftType | 'All'>('All');

  const [summary, setSummary] = useState<DaySummary>(EMPTY_SUMMARY);
  const [dayExpenses, setDayExpenses] = useState<ExpenseSummary | null>(null);
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [defaultBuyer, setDefaultBuyer] = useState<Buyer | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<MilkEntry | null>(null);
  const [isAddBuyerModalOpen, setIsAddBuyerModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFocusedOnce = useRef(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const reload = useCallback(() => setRefreshTrigger((prev) => prev + 1), []);

  // Load everything for the selected day in one parallel round-trip.
  useEffect(() => {
    let isSubscribed = true;

    async function fetchData() {
      try {
        const [sum, expSum, list, allBuyers, defBuyer] = await Promise.all([
          getDaySummary(db, selectedDate),
          getExpenseSummary(db, { startDate: selectedDate, endDate: selectedDate }),
          getEntriesForDate(db, selectedDate, selectedShift),
          getAllBuyers(db),
          getDefaultBuyer(db),
        ]);
        if (!isSubscribed) return;
        setSummary(sum);
        setDayExpenses(expSum);
        setEntries(list);
        setBuyers(allBuyers);
        setDefaultBuyer(defBuyer);
      } catch (error) {
        if (isSubscribed) logger.error('Failed to load dashboard data:', error);
      } finally {
        if (isSubscribed) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }

    fetchData();
    return () => {
      isSubscribed = false;
    };
  }, [db, selectedDate, selectedShift, refreshTrigger]);

  // Refresh when returning to this tab, but skip the initial focus (the effect above already loads).
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) reload();
      hasFocusedOnce.current = true;
    }, [reload])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isSignedIn) {
        await syncNow();
      }
    } catch {
      // ignore
    } finally {
      reload();
    }
  }, [isSignedIn, reload, syncNow]);

  const handleSaveEntry = useCallback(
    async (newEntry: NewMilkEntry) => {
      await insertMilkEntry(db, newEntry);
      showToast(
        isUrdu
          ? `${newEntry.liters} لیٹر دا اندراج محفوظ ہو گیا`
          : `Saved ${newEntry.shift} entry (${newEntry.liters} L)`
      );
      if (newEntry.date !== selectedDate) setSelectedDate(newEntry.date);
      else reload();
    },
    [db, isUrdu, reload, selectedDate, showToast]
  );

  const handleUpdateEntry = useCallback(
    async (id: number, updated: NewMilkEntry) => {
      await updateMilkEntry(db, id, updated);
      showToast(isUrdu ? 'اندراج اپڈیٹ ہو گیا' : `Updated ${updated.shift} entry`);
      reload();
    },
    [db, isUrdu, reload, showToast]
  );

  const handleDeleteEntry = useCallback(
    async (id: number) => {
      await deleteMilkEntry(db, id);
      showToast(isUrdu ? 'اندراج مٹا دتا گیا' : 'Entry deleted');
      reload();
    },
    [db, isUrdu, reload, showToast]
  );

  const handleEditEntry = useCallback((entry: MilkEntry) => {
    setEntryToEdit(entry);
    setIsAddModalOpen(true);
  }, []);

  const closeEntryModal = useCallback(() => {
    setEntryToEdit(null);
    setIsAddModalOpen(false);
  }, []);

  const handleAddBuyer = useCallback(
    async (name: string, phone?: string, address?: string, isDefault?: boolean) => {
      await addBuyer(db, name, phone, address, isDefault);
      const [updatedBuyers, def] = await Promise.all([getAllBuyers(db), getDefaultBuyer(db)]);
      setBuyers(updatedBuyers);
      if (isDefault) setDefaultBuyer(def);
      showToast(isUrdu ? `گاہک "${name}" شامل ہو گیا` : `Added buyer "${name}"`);
    },
    [db, isUrdu, showToast]
  );

  const isToday = selectedDate === todayDateStr;
  const expensesTotal = dayExpenses?.totalExpenses ?? 0;
  const netBalance = summary.totalRevenue - expensesTotal;
  const unit = isUrdu ? 'لیٹر' : 'L';
  const fatText = summary.avgFat > 0 ? `${summary.avgFat}%` : '—';

  const dateLabel = useMemo(() => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, [selectedDate]);

  const renderItem = useCallback(
    ({ item }: { item: MilkEntry }) => (
      <MilkEntryCard entry={item} onDelete={handleDeleteEntry} onEdit={handleEditEntry} />
    ),
    [handleDeleteEntry, handleEditEntry]
  );

  const header = (
    <View style={styles.headerContainer}>
      {/* Brand row */}
      <View style={styles.brandRow}>
        <View style={styles.brandIdentity}>
          <IconBubble icon="sprout" variant="mint" size={42} iconSize={22} />
          <View style={styles.flexShrink}>
            <ThemedText style={styles.brandTitle}>{isUrdu ? 'ڈیری فلو' : 'DairyFlow'}</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.brandSubtitle, { color: theme.textSecondary }]}>
              {farmName}
            </ThemedText>
          </View>
        </View>
        <LanguageToggleButton />
      </View>

      {/* Greeting */}
      <View style={styles.greetingRow}>
        <View style={styles.flexShrink}>
          <ThemedText style={styles.greetingTitle}>
            {isUrdu ? 'السلام علیکم' : 'Assalam-o-Alaikum'}
          </ThemedText>
          <ThemedText style={[styles.greetingDate, { color: theme.textSecondary }]}>
            {dateLabel}
            {isToday ? (isUrdu ? ' · اج' : ' · Today') : ''}
          </ThemedText>
        </View>
        <OfflineStatusBadge compact />
      </View>

      {/* Hero summary */}
      <HeroFinancialCard
        title={
          isToday
            ? isUrdu ? 'اج دا دودھ' : 'Milk sold today'
            : isUrdu ? 'دودھ دا ریکارڈ' : 'Milk collection'
        }
        primaryValue={`${summary.totalLiters.toFixed(1)} ${unit}`}
        secondaryLabel={isUrdu ? 'کل رقم' : 'Revenue'}
        secondaryValue={formatRs(summary.totalRevenue)}
        subtitle={
          isUrdu ? `${summary.entriesCount} اندراج` : `${summary.entriesCount} sales recorded`
        }
        rightFootnote={isUrdu ? `اوسط فیٹ ${fatText}` : `Avg. fat ${fatText}`}
        shifts={[
          {
            label: isUrdu ? 'صبح' : 'Morning',
            value: `${summary.morningLiters.toFixed(1)} ${unit}`,
            icon: '☀️',
          },
          {
            label: isUrdu ? 'شام' : 'Evening',
            value: `${summary.eveningLiters.toFixed(1)} ${unit}`,
            icon: '🌙',
          },
        ]}
      />

      <AppButton
        variant="primary"
        size="lg"
        fullWidth
        title={isUrdu ? 'دودھ دا اندراج' : 'Add milk sale'}
        icon={<AppIcon name="add" size={20} color="#FFFFFF" />}
        onPress={() => setIsAddModalOpen(true)}
      />

      {/* Money snapshot */}
      <View style={styles.statsRow}>
        <StatCard
          label={isUrdu ? 'فارم خرچے' : 'Farm expenses'}
          value={formatRs(expensesTotal)}
          subtext={isUrdu ? 'تفصیل ویکھو' : 'Tap for details'}
          subtextColor={theme.textSecondary}
          icon={<IconBubble icon="feed" variant="amber" size={32} iconSize={16} />}
          onPress={() => router.push('/more/expenses')}
        />
        <StatCard
          label={isUrdu ? 'خالص بچت' : 'Net balance'}
          value={`${netBalance < 0 ? '-' : ''}${formatRs(Math.abs(netBalance))}`}
          subtext={isUrdu ? 'ہفتہ وار رپورٹ' : 'Weekly report'}
          subtextColor={netBalance < 0 ? theme.danger : theme.primary}
          icon={<IconBubble icon="chart" variant="mint" size={32} iconSize={16} />}
          onPress={() => router.push('/more/accounts')}
        />
      </View>

      {/* Entries */}
      <ShiftFilterBar
        selectedShift={selectedShift}
        onSelectShift={setSelectedShift}
        selectedDate={selectedDate}
        onChangeDate={setSelectedDate}
      />

      <View style={styles.sectionTitleRow}>
        <ThemedText style={styles.sectionTitle}>
          {isToday
            ? isUrdu ? 'اج دے اندراج' : "Today's entries"
            : isUrdu ? 'محفوظ اندراج' : 'Saved entries'}
        </ThemedText>
        <View style={[styles.countBadge, { backgroundColor: theme.primaryLight }]}>
          <ThemedText style={[styles.countBadgeText, { color: theme.primaryDark }]}>
            {entries.length}
          </ThemedText>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {toast ? (
        <View style={[styles.toastContainer, { backgroundColor: theme.primaryDark }]}>
          <AppIcon name="check" size={16} color="#FFFFFF" />
          <ThemedText style={styles.toastText}>{toast}</ThemedText>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={
            <EmptyEntriesState shiftFilter={selectedShift} onAddPress={() => setIsAddModalOpen(true)} />
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + 32 }]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        />
      )}

      <AddMilkEntryModal
        visible={isAddModalOpen}
        onClose={closeEntryModal}
        onSaveEntry={handleSaveEntry}
        entryToEdit={entryToEdit}
        onUpdateEntry={handleUpdateEntry}
        buyers={buyers}
        defaultBuyer={defaultBuyer}
        onAddBuyer={handleAddBuyer}
        initialDate={selectedDate}
      />

      <AddBuyerModal
        visible={isAddBuyerModalOpen}
        onClose={() => setIsAddBuyerModalOpen(false)}
        onSaveBuyer={handleAddBuyer}
        existingBuyers={buyers}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  headerContainer: { gap: Spacing.md, marginBottom: Spacing.xs },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.md,
    ...Shadows.md,
  },
  toastText: { color: '#FFFFFF', fontSize: Typography.subhead.fontSize, fontWeight: '600', flexShrink: 1 },

  brandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  brandIdentity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  brandTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700', letterSpacing: -0.2 },
  brandSubtitle: { fontSize: Typography.footnote.fontSize, fontWeight: '500' },

  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  greetingTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700' },
  greetingDate: { fontSize: Typography.subhead.fontSize, fontWeight: '500', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: Spacing.md },

  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  countBadge: { minWidth: 28, paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full, alignItems: 'center' },
  countBadgeText: { fontSize: Typography.footnote.fontSize, fontWeight: '700' },
});
