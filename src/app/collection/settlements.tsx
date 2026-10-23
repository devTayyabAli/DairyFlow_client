import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettlementPaymentModal } from '@/components/collection/SettlementPaymentModal';
import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, IconBubble, useToast } from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  getAdvances,
  getMilkCollections,
  getSettlements,
  getSuppliers,
  insertSettlement,
  markSettlementPaid,
  Settlement,
  Supplier,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { getFridayToThursdayWeek } from '@/utils/week-cycle';
import { logger } from '@/utils/logger';

export default function SettlementsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bulkPaying, setBulkPaying] = useState(false);

  // Payment modal state
  const [selectedSettlementForPayment, setSelectedSettlementForPayment] = useState<Settlement | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const currentWeek = useMemo(() => {
    return getFridayToThursdayWeek(new Date(), weekOffset);
  }, [weekOffset]);

  const loadData = useCallback(async () => {
    try {
      const [allSettlements, allSuppliers] = await Promise.all([
        getSettlements(db, { targetType: 'supplier' }),
        getSuppliers(db, 'active'),
      ]);
      setSettlements(allSettlements);
      setSuppliers(allSuppliers);
    } catch (err) {
      logger.error('Failed to load settlements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Filter settlements for the currently selected Friday cycle
  const weekSettlements = useMemo(() => {
    return settlements.filter(
      (s) => s.period_start === currentWeek.startDate && s.period_end === currentWeek.endDate
    );
  }, [settlements, currentWeek]);

  // Overall totals for the week
  const weekTotals = useMemo(() => {
    let gross = 0;
    let advanceDeductions = 0;
    let net = 0;
    let paidCount = 0;

    for (const s of weekSettlements) {
      gross += s.gross_amount;
      advanceDeductions += s.advance_deduction;
      net += s.net_amount;
      if (s.status === 'paid') paidCount++;
    }

    return {
      gross: Math.round(gross),
      advanceDeductions: Math.round(advanceDeductions),
      net: Math.round(net),
      totalCount: weekSettlements.length,
      paidCount,
    };
  }, [weekSettlements]);

  // One-click settlement generator for all suppliers who delivered milk in this Friday cycle
  const generateWeekSettlements = async () => {
    setGenerating(true);
    try {
      const weekCollections = await getMilkCollections(db, {
        startDate: currentWeek.startDate,
        endDate: currentWeek.endDate,
      });

      // Group deliveries by supplier_id
      const bySupplier = new Map<number, { name: string; liters: number; gross: number }>();
      for (const col of weekCollections) {
        const cur = bySupplier.get(col.supplier_id) || {
          name: col.supplier_name,
          liters: 0,
          gross: 0,
        };
        cur.liters += col.liters;
        cur.gross += col.total_amount;
        bySupplier.set(col.supplier_id, cur);
      }

      if (bySupplier.size === 0) {
        toast.info(
          isUrdu ? 'اس ہفتے وچ کوئی دودھ وصولی درج نہیں ہے' : 'No milk collections recorded in this week cycle'
        );
        return;
      }

      // Check active advances for deduction
      const activeAdvances = await getAdvances(db, { targetType: 'supplier', status: 'active' });
      const advanceBySupplier = new Map<number, number>();
      for (const adv of activeAdvances) {
        const cut = adv.repayment_terms === 'weekly_cut'
          ? Math.min(adv.remaining_balance, adv.deduction_per_settlement || adv.remaining_balance)
          : adv.remaining_balance;
        advanceBySupplier.set(adv.target_id, (advanceBySupplier.get(adv.target_id) || 0) + cut);
      }

      // Insert settlement records
      let createdCount = 0;
      for (const [suppId, data] of bySupplier.entries()) {
        const existing = weekSettlements.find((s) => s.target_id === suppId);
        if (existing) continue; // Already created

        const deduction = Math.min(data.gross, advanceBySupplier.get(suppId) || 0);
        const netAmount = Math.max(0, data.gross - deduction);

        await insertSettlement(db, {
          target_type: 'supplier',
          target_id: suppId,
          target_name: data.name,
          period_start: currentWeek.startDate,
          period_end: currentWeek.endDate,
          gross_amount: Math.round(data.gross),
          advance_deduction: Math.round(deduction),
          net_amount: Math.round(netAmount),
          status: 'due',
          expected_payment_date: currentWeek.startDate, // Due Friday
          notes: `Weekly settlement (${data.liters.toFixed(1)} Liters)`,
        });
        createdCount++;
      }

      toast.success(
        isUrdu
          ? `${createdCount} سپلائرز دا ہفتہ وار حساب تیار ہو گیا!`
          : `Generated settlements for ${createdCount} supplier(s)!`
      );
      loadData();
    } catch (err) {
      logger.error('Failed to generate weekly settlements:', err);
      toast.error(isUrdu ? 'حساب تیار نہیں ہو سکیا' : 'Failed to generate settlements');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenPayment = (s: Settlement) => {
    setSelectedSettlementForPayment(s);
    setIsPaymentModalOpen(true);
  };

  const handleShareWhatsAppParchi = async (item: Settlement) => {
    const isPaid = item.status === 'paid';
    const msg = [
      `🥛 *حساب رسید (Dodhi Milk Statement)*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *سپلائر / کسان:* ${item.target_name}`,
      `📅 *دورانیہ:* ${item.period_start} توں ${item.period_end}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💵 *دودھ دا کل بل:* Rs ${item.gross_amount.toLocaleString()}`,
      item.advance_deduction > 0 ? `✂️ *پیشگی کٹوتی:* − Rs ${item.advance_deduction.toLocaleString()}` : '',
      `💰 *خالص رقم (Net Paid):* Rs ${item.net_amount.toLocaleString()}`,
      `✅ *حیثیت:* ${isPaid ? `ادا شدہ (Paid: ${item.actual_payment_date || item.expected_payment_date})` : 'واجب الادا (Due)'}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_DairyFlow Dodhi Route Portal_`,
    ].filter(Boolean).join('\n');

    const targetSupplier = suppliers.find((s) => s.id === item.target_id);
    const cleanPhone = targetSupplier?.phone ? targetSupplier.phone.replace(/[^0-9]/g, '') : '';

    try {
      const url = cleanPhone
        ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
        : `whatsapp://send?text=${encodeURIComponent(msg)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message: msg });
      }
    } catch {
      await Share.share({ message: msg });
    }
  };

  const handleShareWhatsAppCycleSummary = async () => {
    if (weekSettlements.length === 0) {
      toast.info(isUrdu ? 'اس دورانیہ دا کوئی حساب نہیں اے' : 'No settlements generated for this period');
      return;
    }

    const pendingCount = weekTotals.totalCount - weekTotals.paidCount;
    const msg = [
      `🥛 *DairyFlow ہفتہ وار جمعہ سیٹلمنٹ خلاصہ*`,
      `📅 *دورانیہ:* ${currentWeek.startDate} توں ${currentWeek.endDate}`,
      `👥 *کل سپلائرز:* ${weekTotals.totalCount}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `💵 *کل دودھ بل (Gross):* Rs ${weekTotals.gross.toLocaleString()}`,
      weekTotals.advanceDeductions > 0
        ? `✂️ *پیشگی کٹوتی (Advances Cut):* −Rs ${weekTotals.advanceDeductions.toLocaleString()}`
        : '',
      `💰 *خالص واجب الادا (Net Payout):* Rs ${weekTotals.net.toLocaleString()}`,
      `✅ *ادا شدہ (Paid):* ${weekTotals.paidCount} / ${weekTotals.totalCount}`,
      pendingCount > 0 ? `⏳ *باقی واجب الادا (Pending):* ${pendingCount}` : '',
      `━━━━━━━━━━━━━━━━━━━━`,
      `_DairyFlow Dodhi Route Portal_`,
    ]
      .filter(Boolean)
      .join('\n');

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
  };

  const handleBulkMarkAllPaid = () => {
    const dueList = weekSettlements.filter((s) => s.status !== 'paid');
    if (dueList.length === 0) {
      toast.info(isUrdu ? 'ساریاں ادائیگیاں پہلے ہی ادا شدہ نے' : 'All settlements are already paid');
      return;
    }

    Alert.alert(
      isUrdu ? 'ساریاں ادائیگیاں درج کرو؟' : 'Mark All Settlements as Paid?',
      isUrdu
        ? `کیا تسیں تمام ${dueList.length} سپلائرز نو نقدی ادائیگی (Cash Payout) درج کرنا چاہندے او؟`
        : `Do you want to mark all ${dueList.length} due settlements as paid via Cash?`,
      [
        { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
        {
          text: isUrdu ? 'ہاں، ادا کرو' : 'Confirm Payout',
          onPress: async () => {
            setBulkPaying(true);
            const todayStr = new Date().toISOString().split('T')[0];
            try {
              for (const s of dueList) {
                await markSettlementPaid(db, s.id, todayStr, 'Cash');
              }
              toast.success(
                isUrdu
                  ? `${dueList.length} سپلائرز دی ادائیگیاں درج ہو گئیاں!`
                  : `Marked ${dueList.length} settlements as paid!`
              );
              loadData();
            } catch (err) {
              logger.error('Bulk mark paid failed:', err);
              toast.error(isUrdu ? 'کجھ ادائیگیاں درج نہیں ہو سکیاں' : 'Failed to record all payments');
            } finally {
              setBulkPaying(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: theme.backgroundElement }]}>
            <AppIcon name="chevronLeft" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <ThemedText style={styles.headerTitle}>
              {isUrdu ? 'ہفتہ وار حساب (Friday Cycle)' : 'Weekly Friday Settlements'}
            </ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {currentWeek.label}
            </ThemedText>
          </View>
        </View>

        {/* Week Navigator */}
        <View style={[styles.weekNav, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Pressable
            onPress={() => setWeekOffset((prev) => prev - 1)}
            style={styles.weekArrowBtn}>
            <AppIcon name="chevronLeft" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.weekDatesWrap}>
            <ThemedText style={styles.weekDatesText}>
              📅 {currentWeek.startDate} → {currentWeek.endDate}
            </ThemedText>
            <ThemedText style={[styles.expectedFridayLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'متوقع ادائیگی: جمعہ (Due Friday)' : 'Payment Expected: Friday'}
            </ThemedText>
          </View>

          <Pressable
            onPress={() => setWeekOffset((prev) => prev + 1)}
            style={styles.weekArrowBtn}>
            <AppIcon name="chevronRight" size={20} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={weekSettlements}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + 40 }]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Week Summary Financial Banner */}
            <AppCard style={[styles.bannerCard, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
              <View style={styles.bannerHeader}>
                <ThemedText style={[styles.bannerTitle, { color: theme.text }]}>
                  {isUrdu ? 'ہفتے دا مجموعی خلاصہ' : 'Cycle Settlement Summary'}
                </ThemedText>
                <View style={[styles.paidStatusBadge, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.paidStatusText}>
                    {weekTotals.paidCount} / {weekTotals.totalCount} {isUrdu ? 'ادا شدہ' : 'Paid'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.bannerRow}>
                <View style={styles.bannerCol}>
                  <ThemedText style={[styles.bannerNum, { color: theme.text }]}>
                    Rs {weekTotals.gross.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.bannerSub, { color: theme.textSecondary }]}>
                    {isUrdu ? 'کل دودھ بل' : 'Gross Bill'}
                  </ThemedText>
                </View>

                {weekTotals.advanceDeductions > 0 && (
                  <>
                    <View style={styles.bannerDivider} />
                    <View style={styles.bannerCol}>
                      <ThemedText style={[styles.bannerNum, { color: theme.danger }]}>
                        − Rs {weekTotals.advanceDeductions.toLocaleString()}
                      </ThemedText>
                      <ThemedText style={[styles.bannerSub, { color: theme.textSecondary }]}>
                        {isUrdu ? 'پیشگی کٹوتی' : 'Advance Cut'}
                      </ThemedText>
                    </View>
                  </>
                )}

                <View style={styles.bannerDivider} />

                <View style={styles.bannerCol}>
                  <ThemedText style={[styles.bannerNum, { color: theme.primary }]}>
                    Rs {weekTotals.net.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.bannerSub, { color: theme.textSecondary }]}>
                    {isUrdu ? 'خالص ادائیگی' : 'Net Payout'}
                  </ThemedText>
                </View>
              </View>
            </AppCard>

            {/* Generate Button if not generated yet, or Header Action Row */}
            {weekSettlements.length === 0 ? (
              <AppButton
                title={generating ? (isUrdu ? 'حساب تیار ہو رہا ہے...' : 'Generating...') : (isUrdu ? '⚡ اس ہفتے دا حساب تیار کرو' : '⚡ Generate Friday Settlements')}
                variant="primary"
                loading={generating}
                onPress={generateWeekSettlements}
                style={styles.generateBtn}
              />
            ) : (
              <View style={styles.settlementHeaderActions}>
                <Pressable
                  onPress={handleShareWhatsAppCycleSummary}
                  style={[styles.headerWhatsAppBtn, { backgroundColor: '#128C7E' }]}>
                  <ThemedText style={styles.headerWhatsAppBtnText}>
                    💬 {isUrdu ? 'واٹس ایپ ہفتہ وار خلاصہ' : 'WhatsApp Cycle Summary'}
                  </ThemedText>
                </Pressable>

                {weekTotals.totalCount > weekTotals.paidCount && (
                  <AppButton
                    title={
                      bulkPaying
                        ? isUrdu
                          ? 'ادائیگیاں درج ہو رہیاں نے...'
                          : 'Processing...'
                        : isUrdu
                        ? `⚡ ساریاں ادا کرو (${weekTotals.totalCount - weekTotals.paidCount})`
                        : `⚡ Mark All Paid (${weekTotals.totalCount - weekTotals.paidCount})`
                    }
                    variant="outline"
                    size="sm"
                    loading={bulkPaying}
                    disabled={bulkPaying}
                    onPress={handleBulkMarkAllPaid}
                  />
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isPaid = item.status === 'paid';

          return (
            <AppCard style={[styles.settlementCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardTopRow}>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/collection/supplier-ledger' as never,
                      params: { id: String(item.target_id) },
                    })
                  }
                  hitSlop={6}>
                  <ThemedText style={styles.supplierTitle}>{item.target_name} ›</ThemedText>
                  <ThemedText style={[styles.cardSubText, { color: theme.textSecondary }]}>
                    {item.notes || (isUrdu ? 'ہفتہ وار دودھ وصولی' : 'Weekly Collection')} · {isUrdu ? 'کھاتہ دیکھو' : 'View Ledger'}
                  </ThemedText>
                </Pressable>

                {isPaid ? (
                  <View style={[styles.statusBadge, { backgroundColor: theme.primaryLight }]}>
                    <ThemedText style={[styles.statusText, { color: theme.primary }]}>
                      ✓ {isUrdu ? 'ادا شدہ (Paid)' : 'Paid'}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.statusBadge, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={[styles.statusText, { color: theme.accent }]}>
                      ⏳ {isUrdu ? 'واجب الادا (Due)' : 'Due'}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Settlement Metrics */}
              <View style={styles.metricsBox}>
                <View style={styles.metricItem}>
                  <ThemedText style={[styles.mLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'دودھ بل' : 'Gross'}
                  </ThemedText>
                  <ThemedText style={styles.mValue}>
                    Rs {item.gross_amount.toLocaleString()}
                  </ThemedText>
                </View>

                {item.advance_deduction > 0 && (
                  <View style={styles.metricItem}>
                    <ThemedText style={[styles.mLabel, { color: theme.danger }]}>
                      {isUrdu ? 'پیشگی کٹوتی' : 'Advance Cut'}
                    </ThemedText>
                    <ThemedText style={[styles.mValue, { color: theme.danger }]}>
                      − Rs {item.advance_deduction.toLocaleString()}
                    </ThemedText>
                  </View>
                )}

                <View style={styles.metricItem}>
                  <ThemedText style={[styles.mLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'خالص قابل ادا' : 'Net Payout'}
                  </ThemedText>
                  <ThemedText style={[styles.mValue, { color: theme.primary, fontWeight: '800' }]}>
                    Rs {item.net_amount.toLocaleString()}
                  </ThemedText>
                </View>
              </View>

              {/* Bottom Row / Payment Info */}
              <View style={[styles.bottomDivider, { backgroundColor: theme.border }]} />

              <View style={styles.cardBottomRow}>
                {isPaid ? (
                  <ThemedText style={[styles.paidInfoText, { color: theme.textSecondary }]}>
                    {isUrdu ? 'ادائیگی:' : 'Paid:'} {item.actual_payment_date || item.expected_payment_date} ({item.payment_method || 'Cash'})
                  </ThemedText>
                ) : (
                  <ThemedText style={[styles.paidInfoText, { color: theme.accent }]}>
                    {isUrdu ? 'جمعہ متوقع' : 'Expected Friday'}
                  </ThemedText>
                )}

                <View style={styles.actionButtonGroup}>
                  <Pressable
                    onPress={() => handleShareWhatsAppParchi(item)}
                    style={[styles.whatsappBtn, { backgroundColor: '#128C7E' }]}>
                    <ThemedText style={styles.whatsappBtnText}>
                      💬 {isUrdu ? 'رسید' : 'Slip'}
                    </ThemedText>
                  </Pressable>

                  {!isPaid && (
                    <AppButton
                      title={isUrdu ? '✓ ادا کرو' : 'Mark Paid'}
                      variant="primary"
                      size="sm"
                      onPress={() => handleOpenPayment(item)}
                    />
                  )}
                </View>
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconBubble icon="chart" variant="gray" size={56} iconSize={26} />
            <ThemedText style={styles.emptyTitle}>
              {isUrdu ? 'اس جمعہ دا کوئی حساب نہیں ملیا' : 'No settlements generated for this cycle'}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {isUrdu ? 'ہفتے دے تمام سپلائرز دا بل تیار کرن لئی بٹن دباؤ' : 'Click the button below to generate Friday statements'}
            </ThemedText>
          </View>
        }
      />

      {/* Payment Modal */}
      <SettlementPaymentModal
        visible={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSave={loadData}
        settlement={selectedSettlementForPayment}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: Spacing.sm,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 6,
  },
  weekArrowBtn: {
    padding: Spacing.xs,
  },
  weekDatesWrap: {
    alignItems: 'center',
  },
  weekDatesText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expectedFridayLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  listHeader: {
    marginBottom: Spacing.sm,
  },
  bannerCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  paidStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  paidStatusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerCol: {
    flex: 1,
    alignItems: 'center',
  },
  bannerNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  bannerSub: {
    fontSize: 10,
    marginTop: 2,
  },
  bannerDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  generateBtn: {
    marginBottom: Spacing.sm,
  },
  settlementHeaderActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerWhatsAppBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 40,
  },
  headerWhatsAppBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  settlementCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metricsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  metricItem: {
    flex: 1,
  },
  mLabel: {
    fontSize: 10,
  },
  mValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  bottomDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paidInfoText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  actionButtonGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  whatsappBtn: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
