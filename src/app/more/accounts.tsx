import { Redirect, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordPaymentModal } from '@/components/dairy/RecordPaymentModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  BusyOverlay,
  DashboardSkeleton,
  FilterChip,
  HeroFinancialCard,
  IconBubble,
  StatCard,
  useToast,
} from '@/components/ui';
import { BorderRadius, Layout, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  Buyer,
  getAllBuyers,
  getBuyersWithStats,
  getFilteredEntries,
  getFilteredExpenses,
  getWeeklyFinancialReport,
  NewBuyerPayment,
  recordBuyerPayment,
  WeeklyFinancialReport,
} from '@/db/database';
import { useReportBrand } from '@/hooks/use-report-brand';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { logger } from '@/utils/logger';
import { exportPdf } from '@/utils/pdf-export';
import {
  buildBuyersDirectoryHtml,
  buildExpenseReportHtml,
  buildFinancialReportHtml,
  buildMilkSalesReportHtml,
  reportFileName,
  shiftMonthRange,
} from '@/utils/pdf-report';
import { getFridayToThursdayWeek } from '@/utils/week-cycle';

type TimeframeMode = 'week' | 'month' | 'today';
type ReportKind = 'financial' | 'milk' | 'expenses' | 'buyers';

const formatRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AccountsScreen() {
  const { role } = useSync();
  if (role === 'collector' || role === 'farmer') return <Redirect href="/collection" />;
  return <AccountsScreenBody />;
}

function AccountsScreenBody() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();
  const { brand, lang } = useReportBrand();
  const toast = useToast();

  const [timeframe, setTimeframe] = useState<TimeframeMode>('week');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [dayOffset, setDayOffset] = useState<number>(0);

  const [report, setReport] = useState<WeeklyFinancialReport | null>(null);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Derive date bounds and human labels based on active timeframe mode
  const { startDate, endDate, periodLabel, periodHint } = useMemo(() => {
    if (timeframe === 'month') {
      const todayIso = toLocalDateString(new Date());
      const mRange = shiftMonthRange(todayIso, monthOffset);
      const mDate = new Date(`${mRange.start}T12:00:00Z`);
      const monthLabel = mDate.toLocaleDateString(isUrdu ? 'ur-PK' : 'en-US', {
        month: 'long',
        year: 'numeric',
      });
      const hint =
        monthOffset === 0
          ? isUrdu
            ? 'اس مہینے دا حساب'
            : "This month's summary"
          : isUrdu
          ? 'ماہانہ دورانیہ'
          : 'Monthly period';
      return {
        startDate: mRange.start,
        endDate: mRange.end,
        periodLabel: monthLabel,
        periodHint: hint,
      };
    }

    if (timeframe === 'today') {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      const dayIso = toLocalDateString(d);
      const dayLabel = d.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const hint =
        dayOffset === 0
          ? isUrdu
            ? 'اج دا حساب'
            : "Today's summary"
          : isUrdu
          ? 'روزانہ دورانیہ'
          : 'Daily period';
      return {
        startDate: dayIso,
        endDate: dayIso,
        periodLabel: dayLabel,
        periodHint: hint,
      };
    }

    // Default: Friday to Thursday weekly dairy cycle
    const w = getFridayToThursdayWeek(undefined, weekOffset);
    const hint =
      weekOffset === 0
        ? isUrdu
          ? 'اس ہفتے (جمعہ تا جمعرات)'
          : 'This week (Fri - Thu)'
        : isUrdu
        ? 'ہفتہ وار دورانیہ'
        : 'Weekly period';
    return {
      startDate: w.startDate,
      endDate: w.endDate,
      periodLabel: w.label,
      periodHint: hint,
    };
  }, [dayOffset, isUrdu, monthOffset, timeframe, weekOffset]);

  const loadData = useCallback(async () => {
    try {
      const [finReport, allBuyers] = await Promise.all([
        getWeeklyFinancialReport(db, startDate, endDate),
        getAllBuyers(db),
      ]);
      setReport(finReport);
      setBuyers(allBuyers);
    } catch (err) {
      logger.error('Failed to load financial report data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, endDate, startDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more' as never);
  }, []);

  const handlePrev = useCallback(() => {
    if (timeframe === 'week') setWeekOffset((w) => w - 1);
    else if (timeframe === 'month') setMonthOffset((m) => m - 1);
    else setDayOffset((d) => d - 1);
  }, [timeframe]);

  const handleNext = useCallback(() => {
    if (timeframe === 'week') setWeekOffset((w) => w + 1);
    else if (timeframe === 'month') setMonthOffset((m) => m + 1);
    else setDayOffset((d) => d + 1);
  }, [timeframe]);

  const handleSelectTimeframe = useCallback((mode: TimeframeMode) => {
    setTimeframe(mode);
    setWeekOffset(0);
    setMonthOffset(0);
    setDayOffset(0);
  }, []);

  const handleRecordPayment = useCallback(
    async (payment: NewBuyerPayment) => {
      await recordBuyerPayment(db, payment);
      await loadData();
      toast.success(
        `${isUrdu ? 'ادائیگی درج ہو گئی' : 'Payment recorded'} · Rs ${payment.amount.toLocaleString()}`
      );
    },
    [db, isUrdu, loadData, toast]
  );

  // Universal PDF Report generator for any of the 4 report types
  const exportReport = useCallback(
    async (kind: ReportKind) => {
      setIsReportModalOpen(false);
      if (exporting) return;
      setExporting(true);

      try {
        let html = '';
        let fileName = '';
        let shareTitle = '';

        if (kind === 'financial') {
          const reportKind = timeframe === 'month' ? 'monthly' : timeframe === 'week' ? 'weekly' : 'custom';
          html = buildFinancialReportHtml({
            brand,
            lang,
            report: report ?? {
              startDate,
              endDate,
              totalMilkLiters: 0,
              morningLiters: 0,
              eveningLiters: 0,
              totalMilkRevenue: 0,
              avgDailyLiters: 0,
              totalExpenses: 0,
              feedExpenses: 0,
              otherExpenses: 0,
              expenseCategories: [],
              totalCollections: 0,
              totalReceivables: 0,
              netOperatingProfit: 0,
              entriesCount: 0,
              expensesCount: 0,
            },
            kind: reportKind,
          });
          fileName = reportFileName(`financial_${timeframe}`, startDate, endDate);
          shareTitle = isUrdu ? 'مالیاتی رپورٹ' : 'Financial Report';
        } else if (kind === 'milk') {
          const entries = await getFilteredEntries(db, {
            startDate,
            endDate,
            limit: 10000,
          });
          html = buildMilkSalesReportHtml({
            brand,
            lang,
            entries,
            periodLabel,
            startDate,
            endDate,
          });
          fileName = reportFileName(`milk_sales_${timeframe}`, startDate, endDate);
          shareTitle = isUrdu ? 'دودھ دی فروخت رپورٹ' : 'Milk Sales Report';
        } else if (kind === 'expenses') {
          const expenses = await getFilteredExpenses(db, {
            startDate,
            endDate,
            limit: 10000,
          });
          html = buildExpenseReportHtml({
            brand,
            lang,
            expenses,
            periodLabel,
            startDate,
            endDate,
          });
          fileName = reportFileName(`expenses_${timeframe}`, startDate, endDate);
          shareTitle = isUrdu ? 'فارم خرچیاں دی رپورٹ' : 'Expenses Report';
        } else if (kind === 'buyers') {
          const buyersWithStats = await getBuyersWithStats(db);
          html = buildBuyersDirectoryHtml({
            brand,
            lang,
            buyers: buyersWithStats,
          });
          fileName = reportFileName('buyers_directory', startDate, endDate);
          shareTitle = isUrdu ? 'گاہکاں دا کھاتہ' : 'Buyers Directory';
        }

        const shared = await exportPdf(html, fileName, shareTitle);
        if (shared) {
          toast.success(isUrdu ? 'PDF رپورٹ تیار اے' : 'PDF report generated & shared');
        } else {
          toast.info(
            isUrdu
              ? 'اس ڈیوائس تے شیئرنگ دستیاب نہیں'
              : 'Sharing is not available on this device'
          );
        }
      } catch (err) {
        logger.error('Failed to export report PDF:', err);
        toast.error(
          isUrdu ? 'PDF نہیں بن سکی۔ دوبارہ کوشش کرو۔' : 'Could not create PDF. Please try again.'
        );
      } finally {
        setExporting(false);
      }
    },
    [brand, db, endDate, exporting, isUrdu, lang, periodLabel, report, startDate, timeframe, toast]
  );

  const revenue = report?.totalMilkRevenue ?? 0;
  const expenses = report?.totalExpenses ?? 0;
  const net = report?.netOperatingProfit ?? 0;
  const receivables = report?.totalReceivables ?? 0;
  const unit = isUrdu ? 'لیٹر' : 'L';

  const handleShareWhatsAppSummary = useCallback(async () => {
    const isProfit = net >= 0;
    const msg = [
      `🥛 *DairyFlow فارم مالیاتی خلاصہ*`,
      `📅 *دورانیہ:* ${periodLabel}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🟢 *کل آمدن (Revenue):* ${formatRs(revenue)} (${report?.totalMilkLiters ?? 0} ${unit})`,
      `🔴 *فارم خرچے (Expenses):* ${formatRs(expenses)}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *خالص بچت:* ${formatRs(Math.abs(net))} ${isProfit ? '🎉 (منافع / Profit)' : '⚠️ (نقصان / Loss)'}`,
      receivables > 0 ? `📌 *مارکیٹ ادھار / بقایا:* ${formatRs(receivables)}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `_DairyFlow Farm Management_`,
    ].filter(Boolean).join('\n');

    try {
      const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message: msg });
      }
    } catch {
      await Share.share({ message: msg });
    }
  }, [expenses, net, periodLabel, receivables, report?.totalMilkLiters, revenue, unit]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'واپس' : 'Back'}
          onPress={goBack}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {isUrdu ? 'فارم رپورٹس تے حساب' : 'Farm Reports & Accounts'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {isUrdu ? 'آمدنی، خرچے، بچت تے PDF رپورٹ' : 'Revenue, expenses, profit & PDF reports'}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'PDF رپورٹ بناؤ' : 'Export PDF report'}
          accessibilityState={{ busy: exporting, disabled: exporting }}
          disabled={exporting}
          onPress={() => setIsReportModalOpen(true)}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.primaryLight, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="print" size={18} color={theme.primaryDark} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Layout.bottomTabInset + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }>
        {/* Simple Timeframe Filter Tabs */}
        <View style={styles.timeframeTabsRow}>
          <FilterChip
            label={isUrdu ? 'ایہہ ہفتہ' : 'Weekly'}
            selected={timeframe === 'week'}
            onPress={() => handleSelectTimeframe('week')}
            style={styles.timeframeChip}
          />
          <FilterChip
            label={isUrdu ? 'ایہہ مہینہ' : 'Monthly'}
            selected={timeframe === 'month'}
            onPress={() => handleSelectTimeframe('month')}
            style={styles.timeframeChip}
          />
          <FilterChip
            label={isUrdu ? 'اج دا حساب' : 'Today'}
            selected={timeframe === 'today'}
            onPress={() => handleSelectTimeframe('today')}
            style={styles.timeframeChip}
          />
        </View>

        {/* Date / Period Selector with Prev / Next */}
        <View style={[styles.periodBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'پچھلا' : 'Previous'}
            onPress={handlePrev}
            style={[styles.periodNavBtn, { backgroundColor: theme.backgroundElement }]}>
            <AppIcon name="chevronLeft" size={18} color={theme.text} />
          </Pressable>
          <View style={styles.periodLabelWrap}>
            <ThemedText style={styles.periodLabel} numberOfLines={1}>
              {periodLabel}
            </ThemedText>
            <ThemedText style={[styles.periodHint, { color: theme.textSecondary }]}>
              {periodHint}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'اگلا' : 'Next'}
            onPress={handleNext}
            style={[styles.periodNavBtn, { backgroundColor: theme.backgroundElement }]}>
            <AppIcon name="chevronRight" size={18} color={theme.text} />
          </Pressable>
        </View>

        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            {/* Net Savings / Profit Hero Card */}
            <HeroFinancialCard
              title={isUrdu ? 'خالص بچت / منافع' : 'Net savings / profit'}
              primaryValue={`${net < 0 ? '-' : ''}${formatRs(Math.abs(net))}`}
              subtitle={
                isUrdu
                  ? `دودھ دی کمائی − فارم خرچے`
                  : `Milk revenue − Farm expenses`
              }
              rightFootnote={
                isUrdu
                  ? `${report?.entriesCount ?? 0} اندراج`
                  : `${report?.entriesCount ?? 0} sales`
              }
            />

            {/* Quick Share Action Row: WhatsApp Summary & Full PDF */}
            <View style={styles.shareActionRow}>
              <Pressable
                onPress={handleShareWhatsAppSummary}
                style={[styles.shareActionBtn, { backgroundColor: '#128C7E', borderColor: '#0E6B60' }]}>
                <ThemedText style={styles.shareActionBtnTextWhite}>
                  💬 {isUrdu ? 'واٹس ایپ خلاصہ' : 'WhatsApp Summary'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => setIsReportModalOpen(true)}
                style={[styles.shareActionBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText style={[styles.shareActionBtnText, { color: theme.text }]}>
                  📄 {isUrdu ? 'PDF رپورٹ' : 'PDF Report'}
                </ThemedText>
              </Pressable>
            </View>

            {/* Milk Revenue & Expenses Metric Cards */}
            <View style={styles.row}>
              <StatCard
                label={isUrdu ? 'دودھ دی کمائی' : 'Milk revenue'}
                value={formatRs(revenue)}
                subtext={`${report?.totalMilkLiters ?? 0} ${unit} · ${report?.avgDailyLiters ?? 0} ${unit}/${isUrdu ? 'دن' : 'day'}`}
                subtextColor={theme.primary}
                icon={<IconBubble icon="milk" variant="mint" size={32} iconSize={16} />}
                onPress={() => router.push('/explore')}
                style={styles.flex}
              />
              <StatCard
                label={isUrdu ? 'فارم خرچے' : 'Farm expenses'}
                value={formatRs(expenses)}
                subtext={
                  isUrdu
                    ? `${report?.expensesCount ?? 0} خرچے`
                    : `${report?.expensesCount ?? 0} items`
                }
                subtextColor={theme.textSecondary}
                icon={<IconBubble icon="feed" variant="amber" size={32} iconSize={16} />}
                onPress={() => router.push('/more/expenses')}
                style={styles.flex}
              />
            </View>

            {/* Cash Collections & Market Dues */}
            <AppCard variant="default" padding="md" style={styles.card}>
              <ThemedText style={styles.cardTitle}>
                {isUrdu ? 'نقد وصولی تے مارکیٹ ادھار' : 'Cash & market dues'}
              </ThemedText>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'وصول شدہ کیش' : 'Cash received'}
                  </ThemedText>
                  <ThemedText style={[styles.metricValue, { color: theme.success }]}>
                    {formatRs(report?.totalCollections ?? 0)}
                  </ThemedText>
                </View>
                <View style={styles.flex}>
                  <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'گاہکاں ول بقایا (ادھار)' : 'Outstanding dues'}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.metricValue,
                      { color: receivables > 0 ? theme.danger : theme.success },
                    ]}>
                    {formatRs(receivables)}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.row}>
                <AppButton
                  variant="primary"
                  size="md"
                  title={isUrdu ? 'رقم وصول کرو' : 'Receive payment'}
                  icon={<AppIcon name="wallet" size={16} color="#FFFFFF" />}
                  onPress={() => setIsPaymentModalOpen(true)}
                  style={styles.flex}
                />
                <AppButton
                  variant="outline"
                  size="md"
                  title={isUrdu ? 'گاہکاں دے بل' : 'Buyer bills'}
                  icon={<AppIcon name="users" size={16} color={theme.primaryDark} />}
                  onPress={() => router.push('/buyers')}
                  style={styles.flex}
                />
              </View>
            </AppCard>

            {/* Expense Breakdown */}
            <AppCard variant="default" padding="md" style={styles.card}>
              <ThemedText style={styles.cardTitle}>
                {isUrdu ? 'خرچیاں دی تقسیم (کیہڑا خرچہ کنواں ہویا؟)' : 'Expense breakdown'}
              </ThemedText>
              {!report || report.expenseCategories.length === 0 ? (
                <ThemedText style={[styles.muted, { color: theme.textSecondary }]}>
                  {isUrdu ? 'اس دورانیے وچ کوئی خرچہ درج نہیں ہویا' : 'No expenses recorded in this period.'}
                </ThemedText>
              ) : (
                report.expenseCategories.map((c) => (
                  <View key={c.category} style={styles.catRow}>
                    <View style={styles.catLabelRow}>
                      <ThemedText style={styles.catName}>{c.category}</ThemedText>
                      <ThemedText style={[styles.catAmount, { color: theme.textSecondary }]}>
                        {formatRs(c.amount)} · {c.percentage}%
                      </ThemedText>
                    </View>
                    <View style={[styles.catTrack, { backgroundColor: theme.backgroundElement }]}>
                      <View
                        style={[
                          styles.catBar,
                          {
                            width: `${Math.min(100, Math.max(0, c.percentage))}%`,
                            backgroundColor: c.category === 'Feed' ? theme.primary : theme.morning,
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </AppCard>
          </>
        )}
      </ScrollView>

      {/* PDF Generation Overlay */}
      <BusyOverlay visible={exporting} message={isUrdu ? 'PDF رپورٹ بن رہی اے…' : 'Creating PDF report…'} />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        visible={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSave={handleRecordPayment}
        buyers={buyers}
        outstandingBalance={report?.totalReceivables}
      />

      {/* Clear & Intuitive Report Chooser Modal */}
      <Modal
        visible={isReportModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsReportModalOpen(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsReportModalOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: theme.card }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={styles.flex}>
                <ThemedText style={styles.modalTitle}>
                  {isUrdu ? 'کیہڑی رپورٹ بنانی اے؟' : 'Choose Report to Share'}
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {isUrdu ? `مدت: ${periodLabel}` : `Period: ${periodLabel}`}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setIsReportModalOpen(false)}
                hitSlop={8}
                style={[styles.modalCloseBtn, { backgroundColor: theme.backgroundElement }]}>
                <AppIcon name="close" size={18} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.reportList}>
              {/* Option 1: Complete Financial Report */}
              <Pressable
                onPress={() => exportReport('financial')}
                style={({ pressed }) => [
                  styles.reportOption,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <IconBubble icon="chart" variant="mint" size={40} iconSize={20} />
                <View style={styles.reportOptionText}>
                  <ThemedText style={styles.reportOptionTitle}>
                    {isUrdu ? '1. فارم دا مکمل حساب (مالیاتی رپورٹ)' : '1. Financial P&L Report'}
                  </ThemedText>
                  <ThemedText style={[styles.reportOptionDesc, { color: theme.textSecondary }]}>
                    {isUrdu
                      ? 'دودھ دی کمائی، خرچے تے خالص بچت دا مکمل کھاتہ'
                      : 'Complete breakdown of revenue, expenses, and net profit'}
                  </ThemedText>
                </View>
                <AppIcon name="chevronRight" size={18} color={theme.textSecondary} />
              </Pressable>

              {/* Option 2: Milk Sales Report */}
              <Pressable
                onPress={() => exportReport('milk')}
                style={({ pressed }) => [
                  styles.reportOption,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <IconBubble icon="milk" variant="mint" size={40} iconSize={20} />
                <View style={styles.reportOptionText}>
                  <ThemedText style={styles.reportOptionTitle}>
                    {isUrdu ? '2. دودھ دی فروخت رپورٹ' : '2. Milk Sales Report'}
                  </ThemedText>
                  <ThemedText style={[styles.reportOptionDesc, { color: theme.textSecondary }]}>
                    {isUrdu
                      ? 'صبح تے شام دا دودھ، لیٹر، فیٹ، ریٹ تے گاہکاں دی لسٹ'
                      : 'Shift-wise milk deliveries, fat %, rate, and buyers'}
                  </ThemedText>
                </View>
                <AppIcon name="chevronRight" size={18} color={theme.textSecondary} />
              </Pressable>

              {/* Option 3: Farm Expenses Report */}
              <Pressable
                onPress={() => exportReport('expenses')}
                style={({ pressed }) => [
                  styles.reportOption,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <IconBubble icon="feed" variant="amber" size={40} iconSize={20} />
                <View style={styles.reportOptionText}>
                  <ThemedText style={styles.reportOptionTitle}>
                    {isUrdu ? '3. فارم خرچیاں دی رپورٹ' : '3. Farm Expenses Report'}
                  </ThemedText>
                  <ThemedText style={[styles.reportOptionDesc, { color: theme.textSecondary }]}>
                    {isUrdu
                      ? 'ونڈا، خوراک، مزدوری تے ڈاکٹر دے خرچیاں دی تفصیلی لسٹ'
                      : 'Detailed category breakdown of feed, wages, vet and costs'}
                  </ThemedText>
                </View>
                <AppIcon name="chevronRight" size={18} color={theme.textSecondary} />
              </Pressable>

              {/* Option 4: Buyers Directory & Dues */}
              <Pressable
                onPress={() => exportReport('buyers')}
                style={({ pressed }) => [
                  styles.reportOption,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  pressed && styles.pressed,
                ]}>
                <IconBubble icon="users" variant="mint" size={40} iconSize={20} />
                <View style={styles.reportOptionText}>
                  <ThemedText style={styles.reportOptionTitle}>
                    {isUrdu ? '4. گاہکاں دا کھاتہ تے ڈائریکٹری' : '4. Buyers Directory & Dues'}
                  </ThemedText>
                  <ThemedText style={[styles.reportOptionDesc, { color: theme.textSecondary }]}>
                    {isUrdu
                      ? 'سارے گاہکاں دی لسٹ، کل خریداری تے بقایا ادھار'
                      : 'List of all buyers with total sales and outstanding dues'}
                  </ThemedText>
                </View>
                <AppIcon name="chevronRight" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerText: { flex: 1 },
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
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, gap: Spacing.md },
  timeframeTabsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  timeframeChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  periodNavBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelWrap: { flex: 1, alignItems: 'center' },
  periodLabel: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  periodHint: { fontSize: Typography.caption.fontSize, marginTop: 2 },
  exportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  exportBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  exportBannerText: {
    flex: 1,
    gap: 2,
  },
  exportBannerTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
  },
  exportBannerSubtitle: {
    fontSize: Typography.caption.fontSize,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  card: { gap: Spacing.md },
  cardTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  muted: { fontSize: Typography.footnote.fontSize },
  catRow: { gap: 6 },
  catLabelRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  catName: { fontSize: Typography.subhead.fontSize, fontWeight: '600' },
  catAmount: { fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  catTrack: { height: 8, borderRadius: BorderRadius.full, overflow: 'hidden' },
  catBar: { height: '100%', borderRadius: BorderRadius.full },
  metricLabel: { fontSize: Typography.footnote.fontSize },
  metricValue: { fontSize: Typography.title3.fontSize, fontWeight: '800', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Layout.bottomTabInset + Spacing.lg,
    gap: Spacing.md,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: Typography.footnote.fontSize,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  reportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  reportOptionText: {
    flex: 1,
    gap: 2,
  },
  reportOptionTitle: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  reportOptionDesc: {
    fontSize: Typography.caption.fontSize,
  },
  shareActionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  shareActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  shareActionBtnTextWhite: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shareActionBtnText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
});
