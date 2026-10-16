import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordPaymentModal } from '@/components/dairy/RecordPaymentModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  HeroFinancialCard,
  StatCard,
} from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  Buyer,
  getAllBuyers,
  getWeeklyFinancialReport,
  NewBuyerPayment,
  recordBuyerPayment,
  WeeklyFinancialReport,
} from '@/db/database';
import { useReportBrand } from '@/hooks/use-report-brand';
import { useTheme } from '@/hooks/use-theme';
import { getFridayToThursdayWeek } from '@/utils/week-cycle';
import { logger } from '@/utils/logger';
import { exportPdf } from '@/utils/pdf-export';
import { buildFinancialReportHtml, monthRangeOf, reportFileName } from '@/utils/pdf-report';

const formatRs = (n: number) => `Rs ${Math.round(n).toLocaleString()}`;

export default function AccountsScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();
  const { brand, lang } = useReportBrand();
  const [exporting, setExporting] = useState(false);

  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [report, setReport] = useState<WeeklyFinancialReport | null>(null);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const period = useMemo(() => getFridayToThursdayWeek(undefined, weekOffset), [weekOffset]);

  const loadData = useCallback(async () => {
    try {
      const [finReport, allBuyers] = await Promise.all([
        getWeeklyFinancialReport(db, period.startDate, period.endDate),
        getAllBuyers(db),
      ]);
      setReport(finReport);
      setBuyers(allBuyers);
    } catch (err) {
      logger.error('Failed to load weekly financial report:', err);
    } finally {
      setRefreshing(false);
    }
  }, [db, period.startDate, period.endDate]);

  // Fires on mount and on every return to the screen; also re-runs when the week changes.
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

  const handleRecordPayment = useCallback(
    async (payment: NewBuyerPayment) => {
      await recordBuyerPayment(db, payment);
      await loadData();
      Alert.alert(
        isUrdu ? 'ادائیگی درج ہو گئی' : 'Payment recorded',
        `Rs ${payment.amount.toLocaleString()}`
      );
    },
    [db, isUrdu, loadData]
  );

  // PDF export: the selected week, or the whole calendar month that week ends in.
  const exportReport = useCallback(
    async (kind: 'weekly' | 'monthly') => {
      if (exporting) return;
      setExporting(true);
      try {
        let data = report;
        let start = period.startDate;
        let end = period.endDate;
        if (kind === 'monthly') {
          const month = monthRangeOf(period.endDate);
          start = month.start;
          end = month.end;
          data = await getWeeklyFinancialReport(db, start, end);
        }
        if (!data) return;

        const html = buildFinancialReportHtml({ brand, lang, report: data, kind });
        const shared = await exportPdf(
          html,
          reportFileName(kind === 'weekly' ? 'weekly_report' : 'monthly_report', start, end),
          isUrdu ? 'رپورٹ شیئر کرو' : 'Share report'
        );
        if (!shared) {
          Alert.alert(
            isUrdu ? 'شیئر نہیں ہو سکیا' : 'Sharing unavailable',
            isUrdu ? 'اس ڈیوائس تے شیئرنگ دستیاب نہیں۔' : 'Sharing is not available on this device.'
          );
        }
      } catch (err) {
        logger.error('Failed to export report PDF:', err);
        Alert.alert(
          isUrdu ? 'PDF نہیں بن سکی' : 'Could not create PDF',
          isUrdu ? 'دوبارہ کوشش کرو۔' : 'Please try again.'
        );
      } finally {
        setExporting(false);
      }
    },
    [brand, db, exporting, isUrdu, lang, period.endDate, period.startDate, report]
  );

  const handleExportPress = useCallback(() => {
    if (!report) return;
    const month = monthRangeOf(period.endDate);
    Alert.alert(
      isUrdu ? 'رپورٹ PDF' : 'Export PDF report',
      isUrdu ? 'کیہڑی رپورٹ بنانی اے؟' : 'Which report would you like?',
      [
        {
          text: isUrdu ? `ہفتہ وار (${period.label})` : `Weekly · ${period.label}`,
          onPress: () => {
            exportReport('weekly');
          },
        },
        {
          text: isUrdu ? `ماہانہ (${month.start.slice(0, 7)})` : `Monthly · ${month.start.slice(0, 7)}`,
          onPress: () => {
            exportReport('monthly');
          },
        },
        { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
      ]
    );
  }, [exportReport, isUrdu, period.endDate, period.label, report]);

  const revenue = report?.totalMilkRevenue ?? 0;
  const expenses = report?.totalExpenses ?? 0;
  const net = report?.netOperatingProfit ?? 0;
  const receivables = report?.totalReceivables ?? 0;
  const margin = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
  const unit = isUrdu ? 'لیٹر' : 'L';

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'واپس' : 'Back'}
          onPress={goBack}
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {isUrdu ? 'ہفتہ وار رپورٹ' : 'Weekly report'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {isUrdu ? 'جمعہ تا جمعرات · فارم دا حساب' : 'Friday to Thursday · farm finances'}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'رپورٹ PDF' : 'Export PDF report'}
          accessibilityState={{ busy: exporting, disabled: exporting }}
          disabled={exporting}
          onPress={handleExportPress}
          hitSlop={6}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="print" size={18} color={theme.text} />
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
        {/* Week selector */}
        <View style={[styles.periodBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'پچھلا ہفتہ' : 'Previous week'}
            onPress={() => setWeekOffset((p) => p - 1)}
            style={[styles.periodNavBtn, { backgroundColor: theme.backgroundElement }]}>
            <AppIcon name="chevronLeft" size={18} color={theme.text} />
          </Pressable>
          <View style={styles.periodLabelWrap}>
            <ThemedText style={styles.periodLabel} numberOfLines={1}>
              {period.label}
            </ThemedText>
            <ThemedText style={[styles.periodHint, { color: theme.textMuted }]}>
              {weekOffset === 0
                ? isUrdu ? 'اس ہفتے' : 'This week'
                : isUrdu ? 'ہفتہ وار دورانیہ' : 'Weekly period'}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'اگلا ہفتہ' : 'Next week'}
            onPress={() => setWeekOffset((p) => p + 1)}
            style={[styles.periodNavBtn, { backgroundColor: theme.backgroundElement }]}>
            <AppIcon name="chevronRight" size={18} color={theme.text} />
          </Pressable>
        </View>

        {/* Net earnings hero */}
        <HeroFinancialCard
          title={isUrdu ? 'خالص آمدنی · ہفتہ' : 'Net earnings · week to date'}
          primaryValue={`${net < 0 ? '-' : ''}${formatRs(Math.abs(net))}`}
          subtitle={
            isUrdu
              ? `آمدنی − خرچے · ${margin}% مارجن`
              : `Revenue − expenses · ${margin}% margin`
          }
          rightFootnote={
            isUrdu
              ? `${report?.entriesCount ?? 0} اندراج`
              : `${report?.entriesCount ?? 0} sales`
          }
        />

        {/* Revenue / expenses */}
        <View style={styles.row}>
          <StatCard
            label={isUrdu ? 'دودھ دی آمدنی' : 'Milk revenue'}
            value={formatRs(revenue)}
            subtext={`${report?.totalMilkLiters ?? 0} ${unit} · ${report?.avgDailyLiters ?? 0} ${unit}/${isUrdu ? 'دن' : 'day'}`}
            subtextColor={theme.primary}
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
            onPress={() => router.push('/more/expenses')}
            style={styles.flex}
          />
        </View>

        {/* Expense breakdown */}
        <AppCard variant="default" padding="md" style={styles.card}>
          <ThemedText style={styles.cardTitle}>
            {isUrdu ? 'خرچیاں دی تقسیم' : 'Expense breakdown'}
          </ThemedText>
          {!report || report.expenseCategories.length === 0 ? (
            <ThemedText style={[styles.muted, { color: theme.textSecondary }]}>
              {isUrdu ? 'اس ہفتے کوئی خرچہ درج نہیں' : 'No expenses recorded this week.'}
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

        {/* Cash & buyer balances */}
        <AppCard variant="default" padding="md" style={styles.card}>
          <ThemedText style={styles.cardTitle}>
            {isUrdu ? 'نقد تے گاہک بقایا' : 'Cash & buyer balances'}
          </ThemedText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'وصول شدہ' : 'Payments received'}
              </ThemedText>
              <ThemedText style={[styles.metricValue, { color: theme.success }]}>
                {formatRs(report?.totalCollections ?? 0)}
              </ThemedText>
            </View>
            <View style={styles.flex}>
              <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'کل بقایا' : 'Outstanding dues'}
              </ThemedText>
              <ThemedText
                style={[styles.metricValue, { color: receivables > 0 ? theme.danger : theme.success }]}>
                {formatRs(receivables)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.row}>
            <AppButton
              variant="primary"
              size="md"
              title={isUrdu ? 'رقم وصول کرو' : 'Record payment'}
              icon={<AppIcon name="wallet" size={16} color="#FFFFFF" />}
              onPress={() => setIsPaymentModalOpen(true)}
              style={styles.flex}
            />
            <AppButton
              variant="outline"
              size="md"
              title={isUrdu ? 'گاہک بل' : 'Buyer bills'}
              icon={<AppIcon name="users" size={16} color={theme.primaryDark} />}
              onPress={() => router.push('/buyers')}
              style={styles.flex}
            />
          </View>
        </AppCard>
      </ScrollView>

      <RecordPaymentModal
        visible={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSave={handleRecordPayment}
        buyers={buyers}
        outstandingBalance={report?.totalReceivables}
      />
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
  row: { flexDirection: 'row', gap: Spacing.md },
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
  periodHint: { fontSize: Typography.caption.fontSize, marginTop: 1 },
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
});
