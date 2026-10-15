import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordPaymentModal } from '@/components/dairy/RecordPaymentModal';
import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, ShiftBadge } from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  BuyerLedgerSummary,
  BuyerPayment,
  getBuyerLedger,
  MilkEntry,
  NewBuyerPayment,
  recordBuyerPayment,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { getFridayToThursdayWeek } from '@/utils/week-cycle';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-12" -> "Mon, 12 Oct" (or "Mon 12 Oct 2026" when withYear). */
function formatDay(ymd: string, withYear = false): string {
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) return ymd;
  const weekday = WEEKDAYS[new Date(y, m - 1, d, 12).getDay()];
  return withYear
    ? `${weekday} ${d} ${MONTHS[m - 1]} ${y}`
    : `${weekday}, ${d} ${MONTHS[m - 1]}`;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'BY';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const keyExtractor = (item: MilkEntry) => String(item.id);

// ---------------------------------------------------------------------------
// Row components
// ---------------------------------------------------------------------------

const PaymentRow = React.memo(function PaymentRow({ payment }: { payment: BuyerPayment }) {
  const theme = useTheme();
  const sub = payment.received_by
    ? `${payment.payment_method} · ${payment.received_by}`
    : payment.payment_method;

  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: theme.successBg }]}>
        <AppIcon name="wallet" size={16} color={theme.success} />
      </View>
      <View style={styles.rowTextWrap}>
        <ThemedText style={styles.rowTitle}>{formatDay(payment.date)}</ThemedText>
        <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
          {sub}
        </ThemedText>
      </View>
      <ThemedText style={[styles.rowAmount, { color: theme.success }]}>
        Rs {payment.amount.toLocaleString()}
      </ThemedText>
    </View>
  );
});

const MilkRow = React.memo(function MilkRow({ entry }: { entry: MilkEntry }) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const detail = `${entry.fat_percentage ? `${entry.fat_percentage}% fat · ` : ''}Rs ${entry.rate_per_liter}/L`;

  return (
    <AppCard variant="default" padding="md" style={styles.milkCard}>
      <View style={styles.row}>
        <ShiftBadge shift={entry.shift} size="sm" />
        <View style={styles.rowTextWrap}>
          <ThemedText style={styles.rowTitle}>
            {entry.liters} {isUrdu ? 'لیٹر' : 'L'}
          </ThemedText>
          <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {formatDay(entry.date)} · {detail}
          </ThemedText>
        </View>
        <ThemedText style={styles.rowAmount}>Rs {entry.total_amount.toLocaleString()}</ThemedText>
      </View>
    </AppCard>
  );
});

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BuyerLedgerScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();
  const params = useLocalSearchParams<{ id: string }>();
  const buyerId = parseInt(params.id ?? '0', 10);

  const [weekOffset, setWeekOffset] = useState(0);
  const [ledger, setLedger] = useState<BuyerLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const period = useMemo(() => getFridayToThursdayWeek(undefined, weekOffset), [weekOffset]);
  const { startDate, endDate } = period;

  const loadLedger = useCallback(async () => {
    if (!buyerId) {
      setLoading(false);
      return;
    }
    try {
      const data = await getBuyerLedger(db, buyerId, startDate, endDate);
      setLedger(data);
    } catch (err) {
      console.error('Failed to load buyer ledger:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, buyerId, startDate, endDate]);

  // Single fetch path: runs on mount, on focus and when the period changes.
  useFocusEffect(
    useCallback(() => {
      loadLedger();
    }, [loadLedger])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLedger();
  }, [loadLedger]);

  const goPrevWeek = useCallback(() => setWeekOffset((w) => w - 1), []);
  const goNextWeek = useCallback(() => setWeekOffset((w) => Math.min(0, w + 1)), []);
  const openPayment = useCallback(() => setIsPaymentModalOpen(true), []);
  const closePayment = useCallback(() => setIsPaymentModalOpen(false), []);

  const buyer = ledger?.buyer;
  const outstanding = ledger?.outstandingBalance ?? 0;

  const handleCall = useCallback(() => {
    const phone = buyer?.phone;
    if (!phone) {
      Alert.alert('No Phone', 'No contact number available for this buyer.');
      return;
    }
    Linking.openURL(`tel:${phone.replace(/[^\d+]/g, '')}`).catch(() => {
      Alert.alert('Phone Call', `Contact: ${phone}`);
    });
  }, [buyer?.phone]);

  const openBill = useCallback(() => {
    router.push({
      pathname: '/buyers/bill',
      params: { buyerId: String(buyerId), startDate, endDate },
    } as any);
  }, [buyerId, startDate, endDate]);

  const handleRecordPayment = useCallback(
    async (payment: NewBuyerPayment) => {
      await recordBuyerPayment(db, payment);
      await loadLedger();
      Alert.alert('Payment Saved', `Rs ${payment.amount.toLocaleString()} payment recorded successfully.`);
    },
    [db, loadLedger]
  );

  const renderItem = useCallback(({ item }: { item: MilkEntry }) => <MilkRow entry={item} />, []);

  const initials = useMemo(() => getInitials(buyer?.name ?? ''), [buyer?.name]);
  const periodText = `${formatDay(startDate).replace(',', '')} – ${formatDay(endDate, true)}`;
  const entries = ledger?.entries;
  const payments = ledger?.payments;

  if (!ledger && !loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.notFound}>
          <ThemedText style={styles.notFoundTitle}>{isUrdu ? 'گاہک نہیں ملا' : 'Buyer not found'}</ThemedText>
          <AppButton title={isUrdu ? 'واپس' : 'Go back'} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Buyer chip */}
      <AppCard variant="default" padding="md">
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
            <ThemedText style={[styles.avatarText, { color: theme.primaryDark }]}>{initials}</ThemedText>
          </View>
          <View style={styles.rowTextWrap}>
            <ThemedText style={styles.buyerName} numberOfLines={1}>
              {buyer?.name ?? ''}
            </ThemedText>
            <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {[buyer?.address, buyer?.phone].filter(Boolean).join(' · ') ||
                (isUrdu ? 'رجسٹرڈ گاہک' : 'Registered customer')}
            </ThemedText>
          </View>
          {buyer?.phone ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isUrdu ? 'کال کریں' : 'Call buyer'}
              onPress={handleCall}
              style={({ pressed }) => [styles.callButton, { backgroundColor: theme.primaryLight }, pressed && styles.pressed]}>
              <AppIcon name="phone" size={16} color={theme.primaryDark} />
            </Pressable>
          ) : null}
        </View>
      </AppCard>

      {/* Period selector */}
      <View style={[styles.periodBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous week"
          onPress={goPrevWeek}
          style={[styles.periodNav, { backgroundColor: theme.backgroundElement }]}>
          <AppIcon name="chevronLeft" size={16} color={theme.text} />
        </Pressable>
        <View style={styles.periodLabelWrap}>
          <ThemedText style={styles.periodLabel} numberOfLines={1}>
            {periodText}
          </ThemedText>
          <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
            {weekOffset === 0
              ? isUrdu ? 'اس ہفتے کا حساب' : 'Week to date'
              : isUrdu ? 'گزشتہ ہفتہ' : 'Past week'}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next week"
          disabled={weekOffset >= 0}
          onPress={goNextWeek}
          style={[styles.periodNav, { backgroundColor: theme.backgroundElement }, weekOffset >= 0 && styles.disabled]}>
          <AppIcon name="chevronRight" size={16} color={theme.text} />
        </Pressable>
      </View>

      {/* Outstanding balance */}
      <AppCard variant="mint" padding="lg" style={styles.balanceCard}>
        <ThemedText style={[styles.balanceLabel, { color: theme.cardMintText }]}>
          {isUrdu ? 'بقایا رقم' : 'Outstanding balance'}
        </ThemedText>
        <ThemedText style={[styles.balanceAmount, { color: theme.cardMintText }]} numberOfLines={1}>
          Rs {outstanding.toLocaleString()}
        </ThemedText>

        <View style={[styles.breakdown, { borderTopColor: theme.cardMintBorder }]}>
          <View style={styles.breakdownLine}>
            <ThemedText style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'سابقہ بقایا' : 'Opening balance'}
            </ThemedText>
            <ThemedText style={styles.breakdownValue}>Rs {(ledger?.openingBalance ?? 0).toLocaleString()}</ThemedText>
          </View>
          <View style={styles.breakdownLine}>
            <ThemedText style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'دودھ کی فروخت' : 'Milk sales'} · {ledger?.totalSalesVolume ?? 0} L
            </ThemedText>
            <ThemedText style={styles.breakdownValue}>
              + Rs {(ledger?.totalSalesAmount ?? 0).toLocaleString()}
            </ThemedText>
          </View>
          <View style={styles.breakdownLine}>
            <ThemedText style={[styles.breakdownLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'وصول شدہ ادائیگیاں' : 'Payments received'}
            </ThemedText>
            <ThemedText style={[styles.breakdownValue, { color: theme.success }]}>
              − Rs {(ledger?.totalPaymentsReceived ?? 0).toLocaleString()}
            </ThemedText>
          </View>
        </View>
      </AppCard>

      {/* Actions */}
      <View style={styles.actionsRow}>
        <AppButton
          variant="primary"
          title={isUrdu ? 'ادائیگی درج کریں' : 'Record payment'}
          icon={<AppIcon name="cash" size={18} color="#FFFFFF" />}
          onPress={openPayment}
          style={styles.actionBtn}
        />
        <AppButton
          variant="outline"
          title={isUrdu ? 'ہفتہ وار بل' : 'Weekly bill'}
          icon={<AppIcon name="print" size={18} color={theme.primaryDark} />}
          onPress={openBill}
          style={styles.actionBtn}
        />
      </View>

      {/* Payment records */}
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>{isUrdu ? 'ادائیگی کا ریکارڈ' : 'Payment records'}</ThemedText>
        <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
          {payments?.length ?? 0} {isUrdu ? 'ادائیگیاں' : 'payments'}
        </ThemedText>
      </View>
      <AppCard variant="default" padding="md" style={styles.paymentsCard}>
        {payments && payments.length > 0 ? (
          payments.map((p) => <PaymentRow key={p.id} payment={p} />)
        ) : (
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            {isUrdu ? 'اس ہفتے کوئی ادائیگی نہیں' : 'No payments recorded this week.'}
          </ThemedText>
        )}
      </AppCard>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>{isUrdu ? 'دودھ کی تازہ فروخت' : 'Latest milk sales'}</ThemedText>
        <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]}>
          {entries?.length ?? 0} {isUrdu ? 'ترسیلات' : 'deliveries'}
        </ThemedText>
      </View>
    </View>
  );

  const listEmpty = loading ? (
    <ActivityIndicator color={theme.primary} style={styles.loader} />
  ) : (
    <AppCard variant="default" padding="md">
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        {isUrdu ? 'اس ہفتے کوئی فروخت نہیں' : 'No milk sales for this buyer this week.'}
      </ThemedText>
    </AppCard>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.rowTextWrap}>
          <ThemedText style={styles.headerTitle}>{isUrdu ? 'گاہک کا کھاتہ' : 'Buyer account'}</ThemedText>
          <ThemedText style={[styles.rowSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {buyer?.name ?? ' '}
          </ThemedText>
        </View>
      </View>

      <FlatList
        data={entries ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
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

      {buyer ? (
        <RecordPaymentModal
          visible={isPaymentModalOpen}
          onClose={closePayment}
          onSave={handleRecordPayment}
          preselectedBuyerId={buyer.id}
          buyers={[buyer]}
          outstandingBalance={outstanding}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...Typography.title3, fontWeight: '800' },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.35 },
  listContent: { padding: Spacing.lg, gap: Spacing.sm },
  listHeader: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  rowTextWrap: { flex: 1 },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { ...Typography.subhead, fontWeight: '700' },
  rowSub: { ...Typography.caption },
  rowAmount: { ...Typography.subhead, fontWeight: '800' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  buyerName: { ...Typography.bodyBold },
  callButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
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
  periodNav: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabelWrap: { flex: 1, alignItems: 'center' },
  periodLabel: { ...Typography.subhead, fontWeight: '700' },
  balanceCard: { borderRadius: BorderRadius.xl, gap: Spacing.xs },
  balanceLabel: { ...Typography.caption, fontWeight: '700' },
  balanceAmount: { ...Typography.display, fontWeight: '800' },
  breakdown: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  breakdownLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownLabel: { ...Typography.subhead },
  breakdownValue: { ...Typography.subhead, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: { flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  sectionTitle: { ...Typography.headline, fontWeight: '700' },
  paymentsCard: { gap: Spacing.xxs },
  milkCard: { paddingVertical: Spacing.sm },
  emptyText: { ...Typography.subhead, textAlign: 'center', paddingVertical: Spacing.sm },
  loader: { marginTop: Spacing.xl },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  notFoundTitle: { ...Typography.title2, fontWeight: '700' },
});
