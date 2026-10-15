import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordPaymentModal } from '@/components/dairy/RecordPaymentModal';
import { ThemedText } from '@/components/themed-text';
import { AppButton, AppIcon } from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  BuyerLedgerSummary,
  getBuyerLedger,
  MilkEntry,
  NewBuyerPayment,
  recordBuyerPayment,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-12" -> "Mon 12 Oct" (or with year). */
function formatDay(ymd: string, withYear = false): string {
  const [y, m, d] = ymd.split('-').map((v) => parseInt(v, 10));
  if (!y || !m || !d) return ymd;
  const weekday = WEEKDAYS[new Date(y, m - 1, d, 12).getDay()];
  return `${weekday} ${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ''}`;
}

const keyExtractor = (item: MilkEntry) => String(item.id);

const BillRow = React.memo(function BillRow({ entry }: { entry: MilkEntry }) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  return (
    <View
      style={[
        styles.docSide,
        styles.tableRow,
        { backgroundColor: theme.card, borderColor: theme.border, borderBottomColor: theme.borderSubtle },
      ]}>
      <View style={styles.colDate}>
        <ThemedText style={styles.cellMain}>{formatDay(entry.date)}</ThemedText>
        <ThemedText style={[styles.cellSub, { color: theme.textSecondary }]}>
          {entry.shift === 'Morning' ? (isUrdu ? 'صبح' : 'Morning') : isUrdu ? 'شام' : 'Evening'}
          {entry.fat_percentage ? ` · ${entry.fat_percentage}% fat` : ''}
        </ThemedText>
      </View>
      <View style={styles.colLiters}>
        <ThemedText style={styles.cellMain}>{entry.liters} L</ThemedText>
        <ThemedText style={[styles.cellSub, { color: theme.textSecondary }]}>Rs {entry.rate_per_liter}/L</ThemedText>
      </View>
      <ThemedText style={[styles.colAmount, styles.cellMain]}>Rs {entry.total_amount.toLocaleString()}</ThemedText>
    </View>
  );
});

export default function WeeklyBuyerBillScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();
  const params = useLocalSearchParams<{ buyerId?: string; startDate?: string; endDate?: string }>();

  const buyerId = parseInt(params.buyerId ?? '0', 10);
  const startDate = params.startDate ?? '2026-10-09';
  const endDate = params.endDate ?? '2026-10-15';

  const [ledger, setLedger] = useState<BuyerLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!buyerId) {
      setLoading(false);
      return;
    }
    try {
      setLedger(await getBuyerLedger(db, buyerId, startDate, endDate));
    } catch (err) {
      console.error('Failed to load bill data:', err);
    } finally {
      setLoading(false);
    }
  }, [db, buyerId, startDate, endDate]);

  // Single fetch path (mount + focus).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const buyer = ledger?.buyer;
  const buyerName = buyer?.name ?? '';
  const buyerInitials = useMemo(() => {
    if (!buyerName) return 'DF';
    return buyerName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [buyerName]);

  const billNumber = useMemo(
    () => `DF-${startDate.replace(/-/g, '').slice(2)}-${buyerInitials}`,
    [startDate, buyerInitials]
  );

  const grossPayable = (ledger?.openingBalance ?? 0) + (ledger?.totalSalesAmount ?? 0);
  const netDue = ledger?.outstandingBalance ?? 0;
  const isSettled = netDue <= 0;
  const periodText = `${formatDay(startDate)} – ${formatDay(endDate, true)}`;

  const handleShareBill = useCallback(async () => {
    if (!ledger) return;

    let itemsText = '';
    for (const entry of ledger.entries) {
      itemsText += `• ${entry.date} (${entry.shift}): ${entry.liters} L @ Rs ${entry.rate_per_liter} = Rs ${entry.total_amount.toLocaleString()}\n`;
    }

    const message = `*DAIRYFLOW FARM — WEEKLY MILK BILL*
Bill No: ${billNumber}
Period: ${startDate} to ${endDate}
Customer: ${ledger.buyer.name}
Phone: ${ledger.buyer.phone ?? 'N/A'}

*DELIVERIES SUMMARY:*
${itemsText || 'No milk deliveries recorded in this period.'}
Total Volume: ${ledger.totalSalesVolume} Liters
Weekly Sales: Rs ${ledger.totalSalesAmount.toLocaleString()}
Previous Balance: Rs ${ledger.openingBalance.toLocaleString()}
Gross Payable: Rs ${grossPayable.toLocaleString()}
Less Payments Received: Rs ${ledger.totalPaymentsReceived.toLocaleString()}

*NET BALANCE DUE: Rs ${netDue.toLocaleString()}*

Thank you for your business!`;

    try {
      await Share.share({ message, title: `Milk Bill ${billNumber} - ${ledger.buyer.name}` });
    } catch (err) {
      console.error('Failed to share bill:', err);
    }
  }, [ledger, billNumber, startDate, endDate, grossPayable, netDue]);

  const handleRecordPayment = useCallback(
    async (payment: NewBuyerPayment) => {
      await recordBuyerPayment(db, payment);
      await loadData();
      Alert.alert('Payment Recorded', `Payment of Rs ${payment.amount.toLocaleString()} logged on invoice.`);
    },
    [db, loadData]
  );

  const openPayment = useCallback(() => setIsPaymentModalOpen(true), []);
  const closePayment = useCallback(() => setIsPaymentModalOpen(false), []);
  const renderItem = useCallback(({ item }: { item: MilkEntry }) => <BillRow entry={item} />, []);

  if (!ledger && !loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.notFound}>
          <ThemedText style={styles.notFoundTitle}>{isUrdu ? 'بل نہیں ملا' : 'Bill not found'}</ThemedText>
          <AppButton title={isUrdu ? 'واپس' : 'Go back'} onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Period (fixed by the account screen) */}
      <View style={[styles.periodBar, { backgroundColor: theme.cardMint, borderColor: theme.cardMintBorder }]}>
        <AppIcon name="calendar" size={16} color={theme.cardMintText} />
        <View style={styles.flex}>
          <ThemedText style={[styles.periodText, { color: theme.cardMintText }]} numberOfLines={1}>
            {periodText}
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: isSettled ? theme.successBg : theme.accentBg }]}>
          <ThemedText style={[styles.statusText, { color: isSettled ? theme.success : theme.accent }]}>
            {isSettled ? (isUrdu ? 'صاف' : 'Settled') : isUrdu ? 'مسودہ' : 'Draft'}
          </ThemedText>
        </View>
      </View>

      {/* Document top: brand + billed to */}
      <View
        style={[
          styles.docSide,
          styles.docTop,
          { backgroundColor: theme.card, borderColor: theme.border, borderBottomColor: theme.border },
        ]}>
        <View style={styles.brandRow}>
          <View style={styles.flex}>
            <ThemedText style={[styles.brand, { color: theme.primaryDark }]}>DairyFlow</ThemedText>
            <ThemedText style={[styles.cellSub, { color: theme.textSecondary }]}>
              {isUrdu ? 'بل نمبر' : 'Bill no.'} {billNumber}
            </ThemedText>
          </View>
          <View style={styles.rightAlign}>
            <ThemedText style={[styles.cellSub, { color: theme.textMuted }]}>{isUrdu ? 'بل برائے' : 'BILLED TO'}</ThemedText>
            <ThemedText style={styles.billedName} numberOfLines={1}>
              {buyer?.name ?? ''}
            </ThemedText>
            {buyer?.phone || buyer?.address ? (
              <ThemedText style={[styles.cellSub, { color: theme.textSecondary }]} numberOfLines={1}>
                {[buyer?.address, buyer?.phone].filter(Boolean).join(' · ')}
              </ThemedText>
            ) : null}
          </View>
        </View>

        <View style={[styles.tableHeader, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText style={[styles.colDate, styles.thText, { color: theme.textSecondary }]}>
            {isUrdu ? 'تاریخ / شفٹ' : 'DATE / SESSION'}
          </ThemedText>
          <ThemedText style={[styles.colLiters, styles.thText, { color: theme.textSecondary }]}>
            {isUrdu ? 'لیٹر' : 'LITERS'}
          </ThemedText>
          <ThemedText style={[styles.colAmount, styles.thText, { color: theme.textSecondary }]}>
            {isUrdu ? 'رقم' : 'AMOUNT'}
          </ThemedText>
        </View>
      </View>
    </View>
  );

  const listFooter = (
    <View style={styles.listFooter}>
      <View
        style={[
          styles.docSide,
          styles.docBottom,
          { backgroundColor: theme.card, borderColor: theme.border },
        ]}>
        <SummaryLine
          label={`${isUrdu ? 'دودھ کی فروخت' : 'Milk sales'} · ${ledger?.totalSalesVolume ?? 0} L`}
          value={`Rs ${(ledger?.totalSalesAmount ?? 0).toLocaleString()}`}
          bold
        />
        <SummaryLine
          label={isUrdu ? 'سابقہ بقایا' : 'Opening balance'}
          value={`Rs ${(ledger?.openingBalance ?? 0).toLocaleString()}`}
        />
        <SummaryLine
          label={isUrdu ? 'وصول شدہ ادائیگیاں' : 'Payments received'}
          value={`− Rs ${(ledger?.totalPaymentsReceived ?? 0).toLocaleString()}`}
          valueColor={theme.success}
        />

        <View
          style={[
            styles.netBanner,
            { backgroundColor: isSettled ? theme.successBg : theme.cardMint },
          ]}>
          <ThemedText style={[styles.netLabel, { color: theme.cardMintText }]}>
            {isUrdu ? 'بقایا رقم' : 'Outstanding balance'}
          </ThemedText>
          <ThemedText
            style={[styles.netAmount, { color: isSettled ? theme.success : theme.cardMintText }]}
            numberOfLines={1}>
            Rs {netDue.toLocaleString()}
          </ThemedText>
        </View>
      </View>

      <View style={styles.ctaRow}>
        <AppButton
          variant="primary"
          title={isUrdu ? 'بل شیئر کریں' : 'Share bill'}
          icon={<AppIcon name="share" size={18} color="#FFFFFF" />}
          onPress={handleShareBill}
          disabled={!ledger}
          style={styles.flex}
        />
        {!isSettled ? (
          <AppButton
            variant="outline"
            title={isUrdu ? 'ادائیگی درج کریں' : 'Record payment'}
            icon={<AppIcon name="cash" size={18} color={theme.primaryDark} />}
            onPress={openPayment}
            style={styles.flex}
          />
        ) : null}
      </View>
    </View>
  );

  const listEmpty = loading ? (
    <ActivityIndicator color={theme.primary} style={styles.loader} />
  ) : (
    <View style={[styles.docSide, styles.emptyRow, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText style={[styles.cellSub, { color: theme.textMuted }]}>
        {isUrdu ? 'اس مدت میں کوئی ترسیل نہیں' : 'No milk entries in this billing period.'}
      </ThemedText>
    </View>
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
        <View style={styles.flex}>
          <ThemedText style={styles.headerTitle}>{isUrdu ? 'ہفتہ وار بل' : 'Weekly bill'}</ThemedText>
          <ThemedText style={[styles.cellSub, { color: theme.textSecondary }]} numberOfLines={1}>
            {buyer?.name ?? ' '}
          </ThemedText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'بل شیئر کریں' : 'Share bill'}
          onPress={handleShareBill}
          disabled={!ledger}
          style={({ pressed }) => [styles.backButton, { backgroundColor: theme.primaryLight }, pressed && styles.pressed]}>
          <AppIcon name="share" size={18} color={theme.primaryDark} />
        </Pressable>
      </View>

      <FlatList
        data={ledger?.entries ?? []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
      />

      {buyer ? (
        <RecordPaymentModal
          visible={isPaymentModalOpen}
          onClose={closePayment}
          onSave={handleRecordPayment}
          preselectedBuyerId={buyer.id}
          buyers={[buyer]}
          outstandingBalance={netDue}
        />
      ) : null}
    </SafeAreaView>
  );
}

function SummaryLine({
  label,
  value,
  valueColor,
  bold,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.summaryLine}>
      <ThemedText style={[styles.summaryLabel, { color: theme.textSecondary }, bold && { color: theme.text, fontWeight: '700' }]}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
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
  listContent: { padding: Spacing.lg },
  listHeader: { gap: Spacing.md },
  listFooter: { gap: Spacing.md },
  periodBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  periodText: { ...Typography.subhead, fontWeight: '700' },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusText: { ...Typography.tiny },
  // Invoice "document" pieces: header/rows/footer stitched together as one card
  docSide: { borderLeftWidth: 1, borderRightWidth: 1 },
  docTop: {
    borderTopWidth: 1,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  docBottom: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  brandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  rightAlign: { alignItems: 'flex-end', maxWidth: '55%' },
  brand: { ...Typography.title3, fontWeight: '800' },
  billedName: { ...Typography.headline, fontWeight: '700' },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  thText: { ...Typography.tiny },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg + Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colDate: { flex: 2 },
  colLiters: { flex: 1.4 },
  colAmount: { flex: 1.6, textAlign: 'right' },
  cellMain: { ...Typography.subhead, fontWeight: '700' },
  cellSub: { ...Typography.caption },
  emptyRow: { padding: Spacing.lg, alignItems: 'center' },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  summaryLabel: { ...Typography.subhead },
  summaryValue: { ...Typography.subhead, fontWeight: '700' },
  netBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  netLabel: { ...Typography.subhead, fontWeight: '800' },
  netAmount: { ...Typography.title1, fontWeight: '800' },
  ctaRow: { flexDirection: 'row', gap: Spacing.sm },
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
