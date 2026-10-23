import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddAdvanceModal } from '@/components/collection/AddAdvanceModal';
import { AddMilkCollectionModal } from '@/components/collection/AddMilkCollectionModal';
import { AddSupplierModal } from '@/components/collection/AddSupplierModal';
import { SettlementPaymentModal } from '@/components/collection/SettlementPaymentModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  EmptyState,
  FilterChip,
  ShiftBadge,
  useToast,
} from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  Advance,
  getAdvances,
  getMilkCollections,
  getSettlements,
  getSupplierById,
  getSuppliers,
  MilkCollection,
  Settlement,
  ShiftType,
  Supplier,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

type LedgerTab = 'collections' | 'advances' | 'settlements';

type LedgerListItem =
  | { kind: 'collection'; item: MilkCollection }
  | { kind: 'advance'; item: Advance }
  | { kind: 'settlement'; item: Settlement };

function getTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function SupplierLedgerScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const supplierId = Number(id);

  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<LedgerTab>('collections');

  // Modals
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  const loadData = useCallback(async () => {
    if (!supplierId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [supp, allSupps, cols, advs, setts] = await Promise.all([
        getSupplierById(db, supplierId),
        getSuppliers(db, 'active'),
        getMilkCollections(db, { supplierId }),
        getAdvances(db, { targetType: 'supplier', targetId: supplierId }),
        getSettlements(db, { targetType: 'supplier', targetId: supplierId }),
      ]);
      setSupplier(supp);
      setAllSuppliers(allSupps);
      setCollections(cols);
      setAdvances(advs);
      setSettlements(setts);
    } catch (err) {
      logger.error('Failed to load supplier ledger:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, supplierId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Statistics
  const stats = useMemo(() => {
    let totalLiters = 0;
    let totalFatWeighted = 0;
    let totalGross = 0;

    for (const c of collections) {
      totalLiters += c.liters;
      totalFatWeighted += c.fat_percentage * c.liters;
      totalGross += c.total_amount;
    }

    const avgFat = totalLiters > 0 ? totalFatWeighted / totalLiters : 0;

    let activeAdvanceBalance = 0;
    for (const a of advances) {
      if (a.status === 'active') {
        activeAdvanceBalance += a.remaining_balance;
      }
    }

    let totalPaidOut = 0;
    for (const s of settlements) {
      if (s.status === 'paid') {
        totalPaidOut += s.net_amount;
      }
    }

    return {
      totalLiters: Math.round(totalLiters * 10) / 10,
      avgFat: Math.round(avgFat * 10) / 10,
      totalGross: Math.round(totalGross),
      activeAdvanceBalance: Math.round(activeAdvanceBalance),
      totalPaidOut: Math.round(totalPaidOut),
      currentBalance: Math.round(supplier?.balance || 0),
    };
  }, [collections, advances, settlements, supplier?.balance]);

  const listData: LedgerListItem[] = useMemo(() => {
    if (activeTab === 'collections') {
      return collections.map((item) => ({ kind: 'collection' as const, item }));
    }
    if (activeTab === 'advances') {
      return advances.map((item) => ({ kind: 'advance' as const, item }));
    }
    return settlements.map((item) => ({ kind: 'settlement' as const, item }));
  }, [activeTab, collections, advances, settlements]);

  const handleCall = () => {
    if (!supplier?.phone) {
      toast.info(isUrdu ? 'فون نمبر موجود نہیں' : 'No phone number available');
      return;
    }
    Linking.openURL(`tel:${supplier.phone}`).catch(() => {
      toast.error(isUrdu ? 'کال نہیں ہو سکی' : 'Cannot make call');
    });
  };

  const handleShareWhatsAppStatement = async () => {
    if (!supplier) return;

    const recentDeliveries = collections.slice(0, 5);
    const deliveriesText = recentDeliveries.length > 0
      ? [
          `📋 *حالیہ دودھ وصولی:*`,
          ...recentDeliveries.map(
            (c) =>
              `• ${c.date} (${c.shift === 'Morning' ? 'صبح' : 'شام'}): ${c.liters} L (فیٹ: ${c.fat_percentage}%) = Rs ${Math.round(c.total_amount).toLocaleString()}`
          ),
        ].join('\n')
      : '';

    const msg = [
      `🥛 *DairyFlow دودھ کھاتہ تفصیل (Supplier Statement)*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *سپلائر نام:* ${supplier.name}`,
      supplier.village ? `📍 *مقام / پنڈ:* ${supplier.village}` : '',
      `📅 *تاریخ:* ${getTodayYmd()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🥛 *کل سپلائی شدہ دودھ:* ${stats.totalLiters} لیٹر`,
      `🧪 *اوسط فیٹ:* ${stats.avgFat}%`,
      `💵 *کل دودھ بل:* Rs ${stats.totalGross.toLocaleString()}`,
      stats.activeAdvanceBalance > 0
        ? `✂️ *باقی پیشگی رقم (Advance):* Rs ${stats.activeAdvanceBalance.toLocaleString()}`
        : '',
      `💰 *موجودہ واجب الادا بقایا:* Rs ${stats.currentBalance.toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      deliveriesText,
      deliveriesText ? `━━━━━━━━━━━━━━━━━━━━` : '',
      `_DairyFlow Dodhi Route Portal_`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const cleanPhone = supplier.phone ? supplier.phone.replace(/[^0-9]/g, '') : '';
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

  const handleOpenPayment = (s: Settlement) => {
    setSelectedSettlement(s);
    setIsPaymentModalOpen(true);
  };

  if (!supplier && !loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.errorWrap}>
          <ThemedText style={styles.errorText}>
            {isUrdu ? 'سپلائر نہیں ملیا' : 'Supplier not found'}
          </ThemedText>
          <AppButton
            title={isUrdu ? 'واپس جاؤ' : 'Go Back'}
            variant="outline"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'واپس' : 'Back'}
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              pressed && styles.pressed,
            ]}>
            <AppIcon name="chevronLeft" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.headerTitleWrap}>
            <ThemedText style={styles.headerTitle}>{supplier?.name || '...'}</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              📍 {supplier?.village || (isUrdu ? 'مقام درج نہیں' : 'No village')}
              {supplier?.phone ? ` · 📞 ${supplier.phone}` : ''}
              {supplier?.linked_farm_id ? ` · 🔗 ${supplier.linked_farm_id}` : ''}
            </ThemedText>
          </View>

          <View style={styles.headerActions}>
            {supplier?.phone && (
              <Pressable
                onPress={handleCall}
                style={[styles.headerActionBtn, { backgroundColor: theme.primaryLight }]}>
                <ThemedText style={{ fontSize: 16 }}>📞</ThemedText>
              </Pressable>
            )}
            <Pressable
              onPress={() => setIsEditSupplierOpen(true)}
              style={[styles.headerActionBtn, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={{ fontSize: 16 }}>✏️</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>

      <FlatList<LedgerListItem>
        data={listData}
        keyExtractor={(row) => `${row.kind}-${row.item.id}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={[styles.content, { paddingBottom: Layout.bottomTabInset + 80 }]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Hero Financial Highlights Card */}
            <AppCard
              style={[
                styles.heroCard,
                { backgroundColor: theme.primaryLight, borderColor: theme.primary },
              ]}>
              <View style={styles.heroTop}>
                <View>
                  <ThemedText style={[styles.heroLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'موجودہ واجب الادا رقم (Payable Balance):' : 'Current Outstanding Balance:'}
                  </ThemedText>
                  <ThemedText style={[styles.heroBalance, { color: theme.primary }]}>
                    Rs {stats.currentBalance.toLocaleString()}
                  </ThemedText>
                </View>

                <View style={styles.rateBadge}>
                  <ThemedText style={[styles.rateBadgeText, { color: theme.primaryDark }]}>
                    {supplier?.rate_type === 'fat_based'
                      ? `🧪 Fat × Rs ${supplier.rate_per_fat_point || 35}`
                      : `🏷️ Rs ${supplier?.flat_rate || 200}/L Flat`}
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.heroDivider, { backgroundColor: theme.border }]} />

              <View style={styles.heroStatsRow}>
                <View style={styles.heroStatCol}>
                  <ThemedText style={[styles.heroStatNum, { color: theme.text }]}>
                    {stats.totalLiters} L
                  </ThemedText>
                  <ThemedText style={[styles.heroStatLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'کل دودھ' : 'Total Liters'}
                  </ThemedText>
                </View>

                <View style={styles.heroStatDivider} />

                <View style={styles.heroStatCol}>
                  <ThemedText style={[styles.heroStatNum, { color: theme.text }]}>
                    {stats.avgFat}%
                  </ThemedText>
                  <ThemedText style={[styles.heroStatLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'اوسط فیٹ' : 'Avg Fat'}
                  </ThemedText>
                </View>

                <View style={styles.heroStatDivider} />

                <View style={styles.heroStatCol}>
                  <ThemedText style={[styles.heroStatNum, { color: theme.danger }]}>
                    Rs {stats.activeAdvanceBalance.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.heroStatLabel, { color: theme.textSecondary }]}>
                    {isUrdu ? 'پیشگی باقی' : 'Advance Due'}
                  </ThemedText>
                </View>
              </View>
            </AppCard>

            {/* Quick WhatsApp Statement Button */}
            <Pressable
              onPress={handleShareWhatsAppStatement}
              style={[styles.whatsappBanner, { backgroundColor: '#128C7E' }]}>
              <ThemedText style={styles.whatsappBannerText}>
                💬 {isUrdu ? 'مکمل کھاتہ رسید واٹس ایپ کرو' : 'Share WhatsApp Statement Slip'}
              </ThemedText>
            </Pressable>

            {/* Tab Switcher */}
            <View style={styles.tabBar}>
              <FilterChip
                label={isUrdu ? `دودھ وصولی (${collections.length})` : `Deliveries (${collections.length})`}
                selected={activeTab === 'collections'}
                onPress={() => setActiveTab('collections')}
                style={styles.tabChip}
              />
              <FilterChip
                label={isUrdu ? `پیشگی رقم (${advances.length})` : `Advances (${advances.length})`}
                selected={activeTab === 'advances'}
                onPress={() => setActiveTab('advances')}
                style={styles.tabChip}
              />
              <FilterChip
                label={isUrdu ? `سیٹلمنٹس (${settlements.length})` : `Settlements (${settlements.length})`}
                selected={activeTab === 'settlements'}
                onPress={() => setActiveTab('settlements')}
                style={styles.tabChip}
              />
            </View>
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'collection') {
            const col = row.item;
            return (
              <AppCard
                variant="default"
                padding="md"
                style={[styles.rowCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.rowTop}>
                  <View style={styles.rowDateShift}>
                    <ThemedText style={styles.rowDate}>{col.date}</ThemedText>
                    <ShiftBadge shift={col.shift as ShiftType} />
                  </View>
                  <ThemedText style={[styles.rowAmount, { color: theme.primary }]}>
                    Rs {Math.round(col.total_amount).toLocaleString()}
                  </ThemedText>
                </View>

                <View style={styles.rowMetrics}>
                  <ThemedText style={[styles.metricText, { color: theme.textSecondary }]}>
                    🥛 {col.liters} L · 🧪 {col.fat_percentage}% Fat · 🏷️ Rs {col.rate_per_liter}/L
                  </ThemedText>
                  {col.notes && (
                    <ThemedText style={[styles.metricNotes, { color: theme.textMuted }]}>
                      📝 {col.notes}
                    </ThemedText>
                  )}
                </View>
              </AppCard>
            );
          }

          if (row.kind === 'advance') {
            const adv = row.item;
            const isRepaid = adv.status === 'repaid';
            return (
              <AppCard
                variant="default"
                padding="md"
                style={[styles.rowCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.rowTop}>
                  <View>
                    <ThemedText style={styles.rowDate}>{adv.date}</ThemedText>
                    <ThemedText style={[styles.metricNotes, { color: theme.textSecondary }]}>
                      {adv.repayment_terms === 'weekly_cut'
                        ? isUrdu ? 'ہفتہ وار کٹوتی' : 'Weekly Deduction'
                        : isUrdu ? 'ایک مشت' : 'Lump Sum'}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <ThemedText style={[styles.rowAmount, { color: theme.danger }]}>
                      Rs {adv.amount.toLocaleString()}
                    </ThemedText>
                    <ThemedText style={[styles.metricNotes, { color: isRepaid ? theme.primary : theme.danger }]}>
                      {isRepaid
                        ? isUrdu ? '✓ ادا شدہ' : 'Repaid'
                        : `${isUrdu ? 'باقی:' : 'Bal:'} Rs ${adv.remaining_balance.toLocaleString()}`}
                    </ThemedText>
                  </View>
                </View>
                {adv.notes && (
                  <ThemedText style={[styles.metricNotes, { color: theme.textMuted, marginTop: 4 }]}>
                    📝 {adv.notes}
                  </ThemedText>
                )}
              </AppCard>
            );
          }

          // Settlements Tab
          const sett = row.item;
          const isPaid = sett.status === 'paid';
          return (
            <AppCard
              variant="default"
              padding="md"
              style={[styles.rowCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.rowTop}>
                <View>
                  <ThemedText style={styles.rowDate}>
                    📅 {sett.period_start} → {sett.period_end}
                  </ThemedText>
                  <ThemedText style={[styles.metricNotes, { color: theme.textSecondary }]}>
                    {sett.notes || (isUrdu ? 'جمعہ سیٹلمنٹ' : 'Friday Settlement')}
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: isPaid ? theme.primaryLight : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    style={[
                      styles.statusPillText,
                      { color: isPaid ? theme.primary : theme.accent },
                    ]}>
                    {isPaid ? (isUrdu ? '✓ ادا شدہ' : 'Paid') : (isUrdu ? '⏳ واجب الادا' : 'Due')}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.settlementMetricsRow}>
                <ThemedText style={[styles.metricText, { color: theme.textSecondary }]}>
                  {isUrdu ? 'بل:' : 'Gross:'} Rs {sett.gross_amount.toLocaleString()}
                  {sett.advance_deduction > 0
                    ? ` · ${isUrdu ? 'کٹوتی:' : 'Cut:'} −Rs ${sett.advance_deduction.toLocaleString()}`
                    : ''}
                </ThemedText>
                <ThemedText style={[styles.settlementNet, { color: theme.primary }]}>
                  {isUrdu ? 'خالص:' : 'Net:'} Rs {sett.net_amount.toLocaleString()}
                </ThemedText>
              </View>

              {!isPaid && (
                <View style={styles.settlementActionRow}>
                  <AppButton
                    title={isUrdu ? '✓ ادائیگی درج کرو' : 'Mark Paid'}
                    variant="primary"
                    size="sm"
                    onPress={() => handleOpenPayment(sett)}
                  />
                </View>
              )}
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={activeTab === 'collections' ? 'milk' : activeTab === 'advances' ? 'cash' : 'chart'}
            title={
              activeTab === 'collections'
                ? isUrdu ? 'کوئی دودھ وصولی نہیں مل سکی' : 'No milk deliveries recorded'
                : activeTab === 'advances'
                ? isUrdu ? 'کوئی پیشگی رقم نہیں' : 'No advances recorded'
                : isUrdu ? 'کوئی سیٹلمنٹ ریکارڈ نہیں' : 'No settlements recorded'
            }
            message={
              isUrdu
                ? 'تھلے دتے بٹن نال نواں اندراج کرو۔'
                : 'Use the action buttons below to record a transaction.'
            }
          />
        }
      />

      {/* Sticky Bottom Action Row */}
      <View style={[styles.bottomBar, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
        <AppButton
          title={isUrdu ? '+ دودھ وصولی درج کرو' : '+ Record Delivery'}
          variant="primary"
          onPress={() => setIsCollectionModalOpen(true)}
          style={styles.bottomBarBtn}
        />
        <AppButton
          title={isUrdu ? '+ پیشگی رقم' : '+ Advance'}
          variant="outline"
          onPress={() => setIsAdvanceModalOpen(true)}
          style={styles.bottomBarBtn}
        />
      </View>

      {/* Modals */}
      {supplier && (
        <>
          <AddMilkCollectionModal
            visible={isCollectionModalOpen}
            onClose={() => setIsCollectionModalOpen(false)}
            onSave={loadData}
            initialSupplier={supplier}
            suppliers={allSuppliers}
            selectedDate={getTodayYmd()}
            selectedShift="Morning"
          />

          <AddAdvanceModal
            visible={isAdvanceModalOpen}
            onClose={() => setIsAdvanceModalOpen(false)}
            onSave={loadData}
            suppliers={allSuppliers}
            initialSupplierId={supplier.id}
          />

          <AddSupplierModal
            visible={isEditSupplierOpen}
            onClose={() => setIsEditSupplierOpen(false)}
            onSave={loadData}
            supplierToEdit={supplier}
          />
        </>
      )}

      <SettlementPaymentModal
        visible={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onSave={loadData}
        settlement={selectedSettlement}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700' },
  headerSubtitle: { fontSize: Typography.footnote.fontSize, marginTop: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  listHeader: {
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  heroCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: { fontSize: Typography.caption.fontSize },
  heroBalance: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  rateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF80',
  },
  rateBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatNum: {
    fontSize: 16,
    fontWeight: '800',
  },
  heroStatLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  whatsappBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  whatsappBannerText: {
    color: '#FFFFFF',
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCard: {
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDateShift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rowDate: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
  },
  rowAmount: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '800',
  },
  rowMetrics: { gap: 2 },
  metricText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '500',
  },
  metricNotes: {
    fontSize: Typography.caption.fontSize,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  settlementMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  settlementNet: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '800',
  },
  settlementActionRow: {
    marginTop: Spacing.xs,
    alignItems: 'flex-end',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Layout.bottomTabInset + Spacing.sm,
    borderTopWidth: 1,
  },
  bottomBarBtn: { flex: 1 },
  errorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
});
