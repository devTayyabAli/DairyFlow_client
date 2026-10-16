import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { AddExpenseModal } from '@/components/dairy/AddExpenseModal';
import { ExpenseCard } from '@/components/dairy/ExpenseCard';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  FilterChip,
  HeroFinancialCard,
} from '@/components/ui';
import { BorderRadius, Layout, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  deleteExpense,
  Expense,
  ExpenseCategory,
  ExpenseSummary,
  getExpenseSummary,
  getFilteredExpenses,
  getOperatingFinancialReport,
  OperatingFinancialReport,
} from '@/db/database';
import { useReportBrand } from '@/hooks/use-report-brand';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';
import { exportPdf } from '@/utils/pdf-export';
import { buildExpenseReportHtml, reportFileName } from '@/utils/pdf-report';

type DatePreset = 'week' | 'today' | 'yesterday' | 'month' | 'all' | 'custom';
type CategoryFilter = ExpenseCategory | 'All' | 'OtherGroup';

interface ExpenseSection {
  key: string;
  title: string;
  rightText?: string;
  data: Expense[];
}

const formatRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ExpensesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { brand, lang } = useReportBrand();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [financialReport, setFinancialReport] = useState<OperatingFinancialReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const [datePreset, setDatePreset] = useState<DatePreset>('week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFocusedOnce = useRef(false);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    },
    []
  );

  const dateBounds = useMemo<{ startDate?: string; endDate?: string }>(() => {
    const now = new Date();
    const today = formatLocalDate(now);
    switch (datePreset) {
      case 'today':
        return { startDate: today, endDate: today };
      case 'yesterday': {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = formatLocalDate(y);
        return { startDate: yStr, endDate: yStr };
      }
      case 'week': {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
        const monday = new Date(d.setDate(diff));
        return { startDate: formatLocalDate(monday), endDate: today };
      }
      case 'month': {
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        return { startDate: startOfMonth, endDate: today };
      }
      case 'custom':
        return {
          startDate: customStartDate.trim() || undefined,
          endDate: customEndDate.trim() || undefined,
        };
      case 'all':
      default:
        return {};
    }
  }, [datePreset, customStartDate, customEndDate]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setFeedbackToast(msg);
    toastTimer.current = setTimeout(() => setFeedbackToast(null), 3000);
  }, []);

  const reload = useCallback(() => setRefreshTrigger((p) => p + 1), []);

  useEffect(() => {
    let isSubscribed = true;

    async function fetchData() {
      try {
        const dbCategory =
          selectedCategory === 'All' || selectedCategory === 'OtherGroup'
            ? undefined
            : selectedCategory;
        const q = searchQuery.trim() || undefined;

        const [filteredList, expenseSummary, opReport] = await Promise.all([
          getFilteredExpenses(db, {
            startDate: dateBounds.startDate,
            endDate: dateBounds.endDate,
            category: dbCategory,
            searchQuery: q,
            limit: 500,
          }),
          getExpenseSummary(db, {
            startDate: dateBounds.startDate,
            endDate: dateBounds.endDate,
            category: dbCategory,
            searchQuery: q,
          }),
          getOperatingFinancialReport(db, {
            startDate: dateBounds.startDate,
            endDate: dateBounds.endDate,
          }),
        ]);

        if (!isSubscribed) return;
        setExpenses(
          selectedCategory === 'OtherGroup'
            ? filteredList.filter((e) => e.category !== 'Feed')
            : filteredList
        );
        setSummary(expenseSummary);
        setFinancialReport(opReport);
      } catch (error) {
        if (isSubscribed) logger.error('Failed to load expenses:', error);
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
  }, [db, dateBounds, selectedCategory, searchQuery, refreshTrigger]);

  // Refresh when returning to this screen; skip the first focus (the effect above already loads).
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

  const handleSearchChange = useCallback((text: string) => {
    setSearchInput(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(text), 250);
  }, []);

  const clearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const handleDeleteExpense = useCallback(
    async (id: number) => {
      try {
        await deleteExpense(db, id);
        showToast(isUrdu ? 'خرچہ مٹا دتا گیا' : 'Expense record deleted.');
        reload();
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete expense.');
      }
    },
    [db, isUrdu, reload, showToast]
  );

  const handleEditExpense = useCallback((exp: Expense) => {
    setExpenseToEdit(exp);
    setIsAddModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setExpenseToEdit(null);
    setIsAddModalOpen(false);
  }, []);

  const handleModalSuccess = useCallback(() => {
    showToast(
      expenseToEdit ? 'Expense updated successfully.' : 'Expense recorded successfully.'
    );
    setExpenseToEdit(null);
    reload();
  }, [expenseToEdit, reload, showToast]);

  const handleResetFilters = useCallback(() => {
    setDatePreset('week');
    setSelectedCategory('All');
    clearSearch();
    setCustomStartDate('');
    setCustomEndDate('');
  }, [clearSearch]);

  const hasActiveFilters =
    datePreset !== 'week' ||
    selectedCategory !== 'All' ||
    searchQuery.trim() !== '' ||
    customStartDate !== '' ||
    customEndDate !== '';

  // PDF report for the active filters (e.g. "This month" gives a monthly expense report).
  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    try {
      setExporting(true);
      if (expenses.length === 0) {
        Alert.alert(
          isUrdu ? 'کوئی خرچہ نہیں' : 'No expenses',
          isUrdu
            ? 'موجودہ فلٹر وچ رپورٹ لئی کوئی خرچہ نہیں۔'
            : 'There are no expenses matching your current filter to put in a report.',
          [{ text: 'OK' }]
        );
        return;
      }

      // The list is capped for speed; the report must contain every matching expense.
      const dbCategory =
        selectedCategory === 'All' || selectedCategory === 'OtherGroup' ? undefined : selectedCategory;
      const fullList = await getFilteredExpenses(db, {
        startDate: dateBounds.startDate,
        endDate: dateBounds.endDate,
        category: dbCategory,
        searchQuery: searchQuery.trim() || undefined,
        limit: 10000,
      });
      const all = selectedCategory === 'OtherGroup' ? fullList.filter((e) => e.category !== 'Feed') : fullList;

      const presetLabels: Record<DatePreset, [string, string]> = {
        week: ['This week', 'اس ہفتے'],
        today: ['Today', 'اج'],
        yesterday: ['Yesterday', 'کل'],
        month: ['This month', 'اس مہینے'],
        all: ['All time', 'سارا وقت'],
        custom: ['Custom period', 'مرضی دی مدت'],
      };
      const html = buildExpenseReportHtml({
        brand,
        lang,
        expenses: all,
        periodLabel: presetLabels[datePreset][isUrdu ? 1 : 0],
        startDate: dateBounds.startDate,
        endDate: dateBounds.endDate,
        categoryFilter: selectedCategory === 'OtherGroup' ? 'Other' : selectedCategory,
      });
      const shared = await exportPdf(
        html,
        reportFileName(`expenses_${datePreset}`, dateBounds.startDate ?? all[0]?.date, dateBounds.endDate ?? all[all.length - 1]?.date),
        isUrdu ? 'اخراجات رپورٹ' : 'Expense report'
      );
      showToast(
        shared
          ? isUrdu
            ? 'PDF رپورٹ تیار اے'
            : `PDF report ready (${all.length} expenses)`
          : isUrdu
            ? 'اس ڈیوائس تے شیئرنگ دستیاب نہیں'
            : 'Sharing is not available on this device'
      );
    } catch (err) {
      logger.error('Failed to create expense PDF:', err);
      Alert.alert(
        isUrdu ? 'PDF نہیں بن سکی' : 'Could not create PDF',
        err instanceof Error ? err.message : isUrdu ? 'دوبارہ کوشش کرو۔' : 'Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExporting(false);
    }
  }, [brand, datePreset, dateBounds.endDate, dateBounds.startDate, db, expenses.length, exporting, isUrdu, lang, searchQuery, selectedCategory, showToast]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more' as never);
  }, []);

  const periodOptions = useMemo<{ key: DatePreset; label: string }[]>(
    () => [
      { key: 'week', label: isUrdu ? 'ہفتہ' : 'This week' },
      { key: 'today', label: isUrdu ? 'اج' : 'Today' },
      { key: 'yesterday', label: isUrdu ? 'کل' : 'Yesterday' },
      { key: 'month', label: isUrdu ? 'مہینہ' : 'This month' },
      { key: 'all', label: isUrdu ? 'سارے' : 'All time' },
      { key: 'custom', label: isUrdu ? 'مرضی' : 'Custom' },
    ],
    [isUrdu]
  );

  const categoryOptions = useMemo<{ key: CategoryFilter; label: string }[]>(
    () => [
      { key: 'All', label: isUrdu ? 'سارے' : 'All' },
      { key: 'Feed', label: isUrdu ? 'ونڈا' : 'Feed' },
      { key: 'OtherGroup', label: isUrdu ? 'دیگر' : 'Other' },
      { key: 'Labour', label: isUrdu ? 'ملازم' : 'Labour' },
      { key: 'Veterinary', label: isUrdu ? 'ڈاکٹر' : 'Veterinary' },
      { key: 'Transport', label: isUrdu ? 'کرایہ' : 'Transport' },
    ],
    [isUrdu]
  );

  const periodLabel = periodOptions.find((p) => p.key === datePreset)?.label ?? '';

  const totalFeedQty = summary?.totalFeedQuantity ?? 0;

  const sections = useMemo<ExpenseSection[]>(() => {
    if (expenses.length === 0) return [];
    if (selectedCategory === 'All') {
      const feed: Expense[] = [];
      const other: Expense[] = [];
      for (const item of expenses) (item.category === 'Feed' ? feed : other).push(item);
      const result: ExpenseSection[] = [];
      if (feed.length > 0) {
        result.push({
          key: 'feed',
          title: isUrdu ? 'ونڈا خریداری' : 'Feed purchases',
          rightText:
            totalFeedQty > 0
              ? `${totalFeedQty.toFixed(0)} kg`
              : `${feed.length}`,
          data: feed,
        });
      }
      if (other.length > 0) {
        result.push({
          key: 'other',
          title: isUrdu ? 'دیگر فارم خرچے' : 'Other farm expenses',
          rightText: `${other.length}`,
          data: other,
        });
      }
      return result;
    }
    return [
      {
        key: 'single',
        title:
          selectedCategory === 'OtherGroup'
            ? isUrdu ? 'دیگر فارم خرچے' : 'Other farm expenses'
            : `${selectedCategory}`,
        rightText: `${expenses.length}`,
        data: expenses,
      },
    ];
  }, [expenses, isUrdu, selectedCategory, totalFeedQty]);

  const renderItem = useCallback(
    ({ item }: { item: Expense }) => (
      <ExpenseCard expense={item} onDelete={handleDeleteExpense} onEdit={handleEditExpense} />
    ),
    [handleDeleteExpense, handleEditExpense]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: ExpenseSection }) => (
      <View style={[styles.sectionTitleRow, { backgroundColor: theme.background }]}>
        <ThemedText style={styles.sectionTitleText}>{section.title}</ThemedText>
        {section.rightText ? (
          <ThemedText style={[styles.sectionRight, { color: theme.textSecondary }]}>
            {section.rightText}
          </ThemedText>
        ) : null}
      </View>
    ),
    [theme.background, theme.textSecondary]
  );

  const keyExtractor = useCallback((item: Expense) => String(item.id), []);

  const rangeText =
    dateBounds.startDate && dateBounds.endDate
      ? dateBounds.startDate === dateBounds.endDate
        ? dateBounds.startDate
        : `${dateBounds.startDate} – ${dateBounds.endDate}`
      : isUrdu ? 'سارے ریکارڈ' : 'All recorded dates';

  const net = financialReport?.operatingBalance ?? 0;
  const showBalance = !!financialReport && financialReport.totalMilkSalesRevenue > 0;

  const header = (
    <View style={styles.headerWrap}>
      <HeroFinancialCard
        title={`${isUrdu ? 'کل خرچے' : 'Total expenses'} · ${periodLabel}`}
        primaryValue={formatRs(summary?.totalExpenses ?? 0)}
        subtitle={
          showBalance
            ? `${isUrdu ? 'خالص بچت' : 'Net balance'} ${net < 0 ? '-' : ''}${formatRs(Math.abs(net))} · ${financialReport?.operatingMarginPercentage ?? 0}%`
            : rangeText
        }
        rightFootnote={rangeText}
        shifts={[
          {
            label: isUrdu ? 'ونڈا' : 'Feed',
            value: formatRs(summary?.feedExpenses ?? 0),
            icon: '🌾',
          },
          {
            label: isUrdu ? 'دیگر' : 'Other',
            value: formatRs(summary?.otherExpenses ?? 0),
            icon: '🧾',
          },
        ]}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipsRow}>
        {periodOptions.map((p) => (
          <FilterChip
            key={p.key}
            label={p.label}
            selected={datePreset === p.key}
            onPress={() => setDatePreset(p.key)}
          />
        ))}
      </ScrollView>

      {datePreset === 'custom' ? (
        <View style={styles.customDateRow}>
          <View style={styles.flex}>
            <AppTextInput
              label="From (YYYY-MM-DD)"
              placeholder="YYYY-MM-DD"
              value={customStartDate}
              onChangeText={setCustomStartDate}
            />
          </View>
          <View style={styles.flex}>
            <AppTextInput
              label="To (YYYY-MM-DD)"
              placeholder="YYYY-MM-DD"
              value={customEndDate}
              onChangeText={setCustomEndDate}
            />
          </View>
        </View>
      ) : null}

      <AppTextInput
        placeholder={isUrdu ? 'خرچہ، دکاندار یا سامان تلاش کرو...' : 'Search expense, supplier, or note...'}
        value={searchInput}
        onChangeText={handleSearchChange}
        leftIcon={<AppIcon name="search" size={16} color={theme.textMuted} />}
        rightIcon={searchInput ? <AppIcon name="close" size={16} color={theme.textSecondary} /> : undefined}
        onRightIconPress={clearSearch}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chipsRow}>
        {categoryOptions.map((c) => (
          <FilterChip
            key={c.key}
            label={c.label}
            selected={selectedCategory === c.key}
            onPress={() => setSelectedCategory(c.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.resultsMetaRow}>
        <ThemedText style={[styles.resultsCountText, { color: theme.textSecondary }]}>
          {isUrdu
            ? `${expenses.length} ریکارڈ`
            : `${expenses.length} ${expenses.length === 1 ? 'record' : 'records'}`}
        </ThemedText>
        {hasActiveFilters ? (
          <Pressable onPress={handleResetFilters} hitSlop={10} accessibilityRole="button">
            <ThemedText style={[styles.resetText, { color: theme.danger }]}>
              {isUrdu ? 'فلٹر صاف کرو' : 'Reset filters'}
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const empty = (
    <AppCard variant="default" padding="xl" style={styles.emptyContainer}>
      <MaterialCommunityIcons name="barley" size={36} color={theme.textMuted} />
      <ThemedText style={styles.emptyTitle}>
        {hasActiveFilters
          ? isUrdu ? 'کوئی خرچہ نہیں ملیا' : 'No matching expenses found'
          : isUrdu ? 'اجے کوئی خرچہ درج نہیں' : 'No expenses recorded yet'}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {hasActiveFilters
          ? 'Try adjusting your date range or category filters.'
          : 'Record feed purchases and operational costs to track your true farm operating margins.'}
      </ThemedText>
      {hasActiveFilters ? (
        <AppButton variant="secondary" size="md" title="Clear all filters" onPress={handleResetFilters} />
      ) : (
        <AppButton
          variant="primary"
          size="md"
          title={isUrdu ? 'پہلا خرچہ پاؤ' : 'Add first expense'}
          onPress={() => setIsAddModalOpen(true)}
        />
      )}
    </AppCard>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {feedbackToast ? (
        <View style={[styles.toastContainer, { backgroundColor: theme.primaryDark }]}>
          <AppIcon name="check" size={16} color="#FFFFFF" />
          <ThemedText style={styles.toastText}>{feedbackToast}</ThemedText>
        </View>
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'واپس' : 'Go back'}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.flex}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {isUrdu ? 'خرچے تے ونڈا' : 'Feed & expenses'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {isUrdu ? 'فارم دی خوراک تے اخراجات' : 'Track what goes into your farm'}
          </ThemedText>
        </View>
        <Pressable
          onPress={handleExportPdf}
          disabled={exporting}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'PDF رپورٹ بناؤ' : 'Export expense report as PDF'}
          accessibilityState={{ busy: exporting, disabled: exporting }}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          {exporting ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <AppIcon name="print" size={18} color={theme.text} />
          )}
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + 96 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={10}
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

      {/* Floating add button, above the tab bar */}
      <Pressable
        onPress={() => setIsAddModalOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={isUrdu ? 'نواں خرچہ پاؤ' : 'Add purchase or expense'}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.primary, bottom: Layout.bottomTabInset + Spacing.md },
          pressed && styles.pressed,
        ]}>
        <AppIcon name="add" size={20} color="#FFFFFF" />
        <ThemedText style={styles.fabText}>{isUrdu ? 'خرچہ پاؤ' : 'Add expense'}</ThemedText>
      </Pressable>

      <AddExpenseModal
        visible={isAddModalOpen}
        expenseToEdit={expenseToEdit}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700', letterSpacing: -0.2 },
  headerSubtitle: { fontSize: Typography.footnote.fontSize, marginTop: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs },
  headerWrap: { gap: Spacing.md, marginBottom: Spacing.xs },
  chipsRow: { flexDirection: 'row', gap: Spacing.xs, paddingRight: Spacing.lg },
  customDateRow: { flexDirection: 'row', gap: Spacing.sm },
  resultsMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultsCountText: { fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  resetText: { fontSize: Typography.footnote.fontSize, fontWeight: '700' },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sectionTitleText: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  sectionRight: { fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  emptyTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700', marginTop: 4 },
  emptySubtitle: { fontSize: Typography.footnote.fontSize, textAlign: 'center', maxWidth: 280 },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    minHeight: 52,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.md,
  },
  fabText: { color: '#FFFFFF', fontSize: Typography.subhead.fontSize, fontWeight: '700' },
});
