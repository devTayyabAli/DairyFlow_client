import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { exportMilkEntriesToCsv } from '@/utils/csv-export';
import { saveContentToCache, shareExportFile } from '@/utils/file-storage';

import { AddMilkEntryModal } from '@/components/dairy/AddMilkEntryModal';
import { MilkEntryCard } from '@/components/dairy/MilkEntryCard';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  FilterChip,
  LanguageToggleButton,
  StatCard,
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  addBuyer,
  Buyer,
  deleteMilkEntry,
  getAllBuyers,
  getDefaultBuyer,
  getFilteredEntries,
  insertMilkEntry,
  MilkEntry,
  NewMilkEntry,
  ShiftType,
  updateMilkEntry,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type ShiftFilter = ShiftType | 'All';

interface DateSection {
  date: string;
  title: string;
  isToday: boolean;
  totalLiters: number;
  totalRevenue: number;
  data: MilkEntry[];
}

const SEARCH_DEBOUNCE_MS = 250;
const TOAST_MS = 3000;

const DATE_PRESETS: { key: DatePreset; en: string; ur: string }[] = [
  { key: 'all', en: 'All time', ur: 'سارا وقت' },
  { key: 'today', en: 'Today', ur: 'اج' },
  { key: 'yesterday', en: 'Yesterday', ur: 'کل' },
  { key: 'week', en: 'This week', ur: 'اس ہفتے' },
  { key: 'month', en: 'This month', ur: 'اس مہینے' },
  { key: 'custom', en: 'Custom', ur: 'مرضی دی تاریخ' },
];

const SHIFT_OPTIONS: { key: ShiftFilter; en: string; ur: string }[] = [
  { key: 'All', en: 'All shifts', ur: 'ساریاں شفٹاں' },
  { key: 'Morning', en: '☀️ Morning', ur: '☀️ صبح' },
  { key: 'Evening', en: '🌙 Evening', ur: '🌙 شام' },
];

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatSectionDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const formatRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

// ---------------------------------------------------------------------------
// Date section header (memoized)
// ---------------------------------------------------------------------------
interface SectionHeaderProps {
  title: string;
  isToday: boolean;
  liters: number;
  revenue: number;
  todayLabel: string;
}

const SectionHeader = memo(function SectionHeader({
  title,
  isToday,
  liters,
  revenue,
  todayLabel,
}: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <AppIcon name="calendar" size={14} color={theme.primary} />
        <ThemedText style={styles.sectionTitle} numberOfLines={1}>
          {title}
          {isToday ? ` · ${todayLabel}` : ''}
        </ThemedText>
      </View>
      <View style={[styles.sectionTotalPill, { backgroundColor: theme.primaryLight }]}>
        <ThemedText style={[styles.sectionTotalText, { color: theme.primaryDark }]}>
          {liters.toFixed(1)} L · {formatRs(revenue)}
        </ThemedText>
      </View>
    </View>
  );
});

export default function ExploreScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  // Data
  const [entries, setEntries] = useState<MilkEntry[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [defaultBuyer, setDefaultBuyer] = useState<Buyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Modals & feedback
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<MilkEntry | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState<ShiftFilter>('All');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFocusedOnce = useRef(false);

  const todayStr = useMemo(() => formatLocalDate(new Date()), []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  // Debounce search typing before it hits SQLite.
  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const dateBounds = useMemo<{ startDate?: string; endDate?: string }>(() => {
    switch (datePreset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };
      case 'yesterday': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = formatLocalDate(y);
        return { startDate: yStr, endDate: yStr };
      }
      case 'week': {
        const d = new Date();
        const day = d.getDay();
        d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); // Monday
        return { startDate: formatLocalDate(d), endDate: todayStr };
      }
      case 'month':
        return { startDate: `${todayStr.slice(0, 8)}01`, endDate: todayStr };
      case 'custom':
        return {
          startDate: customStartDate.trim() || undefined,
          endDate: customEndDate.trim() || undefined,
        };
      default:
        return {};
    }
  }, [datePreset, todayStr, customStartDate, customEndDate]);

  const { startDate, endDate } = dateBounds;

  // Entries: re-query when filters or reloadKey change.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getFilteredEntries(db, {
          startDate,
          endDate,
          shift: shiftFilter,
          searchQuery: searchQuery.trim() || undefined,
          limit: 500,
        });
        if (active) setEntries(list);
      } catch (error) {
        console.error('Failed to load records:', error);
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [db, startDate, endDate, shiftFilter, searchQuery, reloadKey]);

  // Buyers (for the add/edit modal): only on mount and explicit reloads.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [all, def] = await Promise.all([getAllBuyers(db), getDefaultBuyer(db)]);
        if (active) {
          setBuyers(all);
          setDefaultBuyer(def);
        }
      } catch (error) {
        console.error('Failed to load buyers:', error);
      }
    })();
    return () => {
      active = false;
    };
  }, [db, reloadKey]);

  // Refresh on returning to the tab, but skip the first focus (effects above already load).
  useFocusEffect(
    useCallback(() => {
      if (hasFocusedOnce.current) reload();
      hasFocusedOnce.current = true;
    }, [reload])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  // Mutations
  const handleSaveEntry = useCallback(
    async (newEntry: NewMilkEntry) => {
      await insertMilkEntry(db, newEntry);
      showToast(
        isUrdu
          ? `${newEntry.liters} لیٹر دا اندراج محفوظ ہو گیا`
          : `Saved ${newEntry.shift} entry (${newEntry.liters} L)`
      );
      reload();
    },
    [db, isUrdu, reload, showToast]
  );

  const handleUpdateEntry = useCallback(
    async (id: number, updated: NewMilkEntry) => {
      await updateMilkEntry(db, id, updated);
      showToast(
        isUrdu ? 'اندراج اپڈیٹ ہو گیا' : `Updated ${updated.shift} entry (${updated.liters} L)`
      );
      setEntryToEdit(null);
      setIsEntryModalOpen(false);
      reload();
    },
    [db, isUrdu, reload, showToast]
  );

  const handleDeleteEntry = useCallback(
    async (id: number) => {
      await deleteMilkEntry(db, id);
      showToast(isUrdu ? 'اندراج مٹا دتا گیا' : 'Record deleted');
      reload();
    },
    [db, isUrdu, reload, showToast]
  );

  const handleAddBuyer = useCallback(
    async (name: string, phone?: string, address?: string, isDefault?: boolean) => {
      await addBuyer(db, name, phone, address, isDefault);
      showToast(isUrdu ? `گاہک "${name}" شامل ہو گیا` : `Added buyer "${name}"`);
      reload();
    },
    [db, isUrdu, reload, showToast]
  );

  const handleEditEntry = useCallback((entry: MilkEntry) => {
    setEntryToEdit(entry);
    setIsEntryModalOpen(true);
  }, []);

  const openAddModal = useCallback(() => {
    setEntryToEdit(null);
    setIsEntryModalOpen(true);
  }, []);

  const closeEntryModal = useCallback(() => {
    setEntryToEdit(null);
    setIsEntryModalOpen(false);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const hasActiveFilters =
    searchInput.trim() !== '' || shiftFilter !== 'All' || datePreset !== 'all';

  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
    setShiftFilter('All');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
  }, []);

  const handleExportCsv = useCallback(async () => {
    if (exportingCsv) return;
    try {
      setExportingCsv(true);
      if (entries.length === 0) {
        Alert.alert(
          isUrdu ? 'کوئی ریکارڈ نہیں' : 'No milk records',
          isUrdu
            ? 'موجودہ فلٹر وچ ایکسپورٹ لئی کوئی ریکارڈ نہیں۔'
            : 'There are no records matching your current filter to export.',
          [{ text: 'OK' }]
        );
        return;
      }
      const csv = exportMilkEntriesToCsv(entries);
      const saved = await saveContentToCache(`dairyflow_milk_records_${todayStr}.csv`, csv);
      const shared = await shareExportFile(saved.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Milk Records (CSV)',
      });
      showToast(
        shared
          ? `Exported ${entries.length} milk records to CSV.`
          : `Saved to cache: ${saved.filename}`
      );
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Unable to generate CSV file.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportingCsv(false);
    }
  }, [entries, exportingCsv, isUrdu, showToast, todayStr]);

  // Derived data
  const summary = useMemo(() => {
    let totalLiters = 0;
    let totalRevenue = 0;
    let morningLiters = 0;
    let eveningLiters = 0;
    let weightedFat = 0;
    for (const e of entries) {
      totalLiters += e.liters;
      totalRevenue += e.total_amount;
      weightedFat += e.fat_percentage * e.liters;
      if (e.shift === 'Morning') morningLiters += e.liters;
      else eveningLiters += e.liters;
    }
    return {
      totalLiters,
      totalRevenue,
      morningLiters,
      eveningLiters,
      avgFat: totalLiters > 0 ? Number((weightedFat / totalLiters).toFixed(2)) : 0,
    };
  }, [entries]);

  const sections = useMemo<DateSection[]>(() => {
    const map = new Map<string, DateSection>();
    for (const e of entries) {
      let section = map.get(e.date);
      if (!section) {
        section = {
          date: e.date,
          title: formatSectionDate(e.date),
          isToday: e.date === todayStr,
          totalLiters: 0,
          totalRevenue: 0,
          data: [],
        };
        map.set(e.date, section);
      }
      section.totalLiters += e.liters;
      section.totalRevenue += e.total_amount;
      section.data.push(e);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [entries, todayStr]);

  // Render helpers
  const todayLabel = isUrdu ? 'اج' : 'Today';

  const renderItem = useCallback(
    ({ item }: { item: MilkEntry }) => (
      <MilkEntryCard entry={item} onDelete={handleDeleteEntry} onEdit={handleEditEntry} />
    ),
    [handleDeleteEntry, handleEditEntry]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: DateSection }) => (
      <SectionHeader
        title={section.title}
        isToday={section.isToday}
        liters={section.totalLiters}
        revenue={section.totalRevenue}
        todayLabel={todayLabel}
      />
    ),
    [todayLabel]
  );

  const keyExtractor = useCallback((item: MilkEntry) => String(item.id), []);

  const entryCount = entries.length;
  const unit = isUrdu ? 'لیٹر' : 'L';
  const fatText = summary.avgFat > 0 ? `${summary.avgFat}%` : '—';

  const listHeader = (
    <View style={styles.headerWrap}>
      <View style={styles.statsRow}>
        <StatCard
          label={isUrdu ? 'کل دودھ' : 'Total milk'}
          value={summary.totalLiters.toFixed(1)}
          unit={unit}
          subtext={
            isUrdu
              ? `${entryCount} اندراج · فیٹ ${fatText}`
              : `${entryCount} ${entryCount === 1 ? 'sale' : 'sales'} · fat ${fatText}`
          }
        />
        <StatCard
          label={isUrdu ? 'کل رقم' : 'Revenue'}
          value={formatRs(summary.totalRevenue)}
          subtext={`☀️ ${summary.morningLiters.toFixed(1)} · 🌙 ${summary.eveningLiters.toFixed(1)} ${unit}`}
          subtextColor={theme.textSecondary}
        />
      </View>

      <AppTextInput
        placeholder={isUrdu ? 'گاہک، تاریخ یا نوٹ تلاش کرو...' : 'Search buyer, date, or note...'}
        value={searchInput}
        onChangeText={setSearchInput}
        returnKeyType="search"
        leftIcon={<AppIcon name="search" size={16} color={theme.textMuted} />}
        rightIcon={
          searchInput ? <AppIcon name="close" size={16} color={theme.textSecondary} /> : undefined
        }
        onRightIconPress={clearSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipsRow}>
        {DATE_PRESETS.map((p) => (
          <FilterChip
            key={p.key}
            label={isUrdu ? p.ur : p.en}
            selected={datePreset === p.key}
            onPress={() => setDatePreset(p.key)}
          />
        ))}
        <View style={[styles.chipDivider, { backgroundColor: theme.border }]} />
        {SHIFT_OPTIONS.map((s) => (
          <FilterChip
            key={s.key}
            label={isUrdu ? s.ur : s.en}
            selected={shiftFilter === s.key}
            onPress={() => setShiftFilter(s.key)}
          />
        ))}
      </ScrollView>

      {datePreset === 'custom' ? (
        <View style={styles.customDateRow}>
          <View style={styles.customDateCol}>
            <AppTextInput
              label={isUrdu ? 'شروع (YYYY-MM-DD)' : 'From (YYYY-MM-DD)'}
              placeholder="YYYY-MM-DD"
              value={customStartDate}
              onChangeText={setCustomStartDate}
              autoCorrect={false}
            />
          </View>
          <View style={styles.customDateCol}>
            <AppTextInput
              label={isUrdu ? 'آخری (YYYY-MM-DD)' : 'To (YYYY-MM-DD)'}
              placeholder="YYYY-MM-DD"
              value={customEndDate}
              onChangeText={setCustomEndDate}
              autoCorrect={false}
            />
          </View>
        </View>
      ) : null}
    </View>
  );

  const listEmpty = (
    <AppCard variant="default" padding="xl" style={styles.emptyContainer}>
      <AppIcon name="search" size={36} color={theme.textMuted} />
      <ThemedText style={styles.emptyTitle}>
        {isUrdu ? 'کوئی ریکارڈ نہیں ملیا' : 'No milk records found'}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {hasActiveFilters
          ? isUrdu
            ? 'فلٹر نال کوئی ریکارڈ میل نہیں کھاندا۔'
            : 'No records match the active search or filters.'
          : isUrdu
            ? 'ہیٹھاں بٹن نال دودھ دا اندراج شروع کرو۔'
            : 'Tap "Add milk sale" to record your first sale.'}
      </ThemedText>
      {hasActiveFilters ? (
        <AppButton
          variant="secondary"
          size="sm"
          title={isUrdu ? 'فلٹر صاف کرو' : 'Clear filters'}
          onPress={handleResetFilters}
        />
      ) : null}
    </AppCard>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {toast ? (
        <View style={[styles.toastContainer, { backgroundColor: theme.primaryDark }]}>
          <AppIcon name="check" size={16} color="#FFFFFF" />
          <ThemedText style={styles.toastText}>{toast}</ThemedText>
        </View>
      ) : null}

      {/* Slim header */}
      <View style={styles.header}>
        <View style={styles.headerTitleWrap}>
          <ThemedText style={styles.headerTitle}>
            {isUrdu ? 'دودھ دا ریکارڈ' : 'Milk Records'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {isUrdu
              ? `${entryCount} اندراج${hasActiveFilters ? ' · فلٹر لاگو' : ''}`
              : `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}${hasActiveFilters ? ' · filtered' : ''}`}
          </ThemedText>
        </View>

        <View style={styles.headerActions}>
          {hasActiveFilters ? (
            <Pressable
              onPress={handleResetFilters}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Reset filters"
              style={({ pressed }) => [styles.resetBtn, pressed && styles.pressed]}>
              <ThemedText style={[styles.resetBtnText, { color: theme.danger }]}>
                {isUrdu ? 'صاف کرو' : 'Reset'}
              </ThemedText>
            </Pressable>
          ) : null}
          <LanguageToggleButton />
          <Pressable
            onPress={handleExportCsv}
            disabled={exportingCsv}
            accessibilityRole="button"
            accessibilityLabel="Export milk records to CSV"
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            {exportingCsv ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <AppIcon name="share" size={17} color={theme.textSecondary} />
            )}
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <SectionList<MilkEntry, DateSection>
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          windowSize={7}
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

      {/* Primary action */}
      <View pointerEvents="box-none" style={styles.fabWrap}>
        <AppButton
          variant="primary"
          size="lg"
          fullWidth
          title={isUrdu ? 'دودھ دا اندراج' : 'Add milk sale'}
          icon={<AppIcon name="add" size={20} color="#FFFFFF" />}
          onPress={openAddModal}
          style={styles.fabButton}
        />
      </View>

      <AddMilkEntryModal
        visible={isEntryModalOpen}
        onClose={closeEntryModal}
        onSaveEntry={handleSaveEntry}
        entryToEdit={entryToEdit}
        onUpdateEntry={handleUpdateEntry}
        buyers={buyers}
        defaultBuyer={defaultBuyer}
        onAddBuyer={handleAddBuyer}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
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
  toastText: {
    color: '#FFFFFF',
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
    flexShrink: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700' },
  headerSubtitle: { fontSize: Typography.footnote.fontSize },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Shadows.subtle,
  },
  resetBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  resetBtnText: { fontSize: Typography.footnote.fontSize, fontWeight: '700' },
  pressed: { opacity: 0.8 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: 110,
  },
  headerWrap: { gap: Spacing.sm, marginBottom: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  chipDivider: { width: 1, height: 20, marginHorizontal: 4 },
  customDateRow: { flexDirection: 'row', gap: Spacing.sm },
  customDateCol: { flex: 1 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  sectionTitle: { fontSize: Typography.subhead.fontSize, fontWeight: '700', flexShrink: 1 },
  sectionTotalPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  sectionTotalText: { fontSize: 11, fontWeight: '700' },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  emptyTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700', marginTop: 4 },
  emptySubtitle: { fontSize: Typography.footnote.fontSize, textAlign: 'center', maxWidth: 280 },

  fabWrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.md,
  },
  fabButton: { ...Shadows.md },
});
