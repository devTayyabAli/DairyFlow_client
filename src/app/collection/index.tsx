import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddMilkCollectionModal } from '@/components/collection/AddMilkCollectionModal';
import { AddSupplierModal } from '@/components/collection/AddSupplierModal';
import { OfflineStatusBadge } from '@/components/dairy/OfflineStatusBadge';
import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, IconBubble } from '@/components/ui';
import { BorderRadius, Layout, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  getMilkCollections,
  getSuppliers,
  MilkCollection,
  ShiftType,
  Supplier,
} from '@/db/database';
import { assignedSupplierIds } from '@/db/procurement';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { logger } from '@/utils/logger';

function getLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DodhiCollectionScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { syncNow, farm, role } = useSync();
  const userId = farm?.userId || '';
  const personName = farm?.accountName || farm?.ownerName || '';
  const isFarmer = role === 'farmer';
  const isCollector = role === 'collector';
  const canRecord = role === 'owner' || role === 'collector';
  const canAddDairy = role === 'owner';
  const roleLabel = isFarmer
    ? isUrdu ? 'ڈیری' : 'Dairy'
    : isCollector
      ? isUrdu ? 'دودھی' : 'Dodhi'
      : isUrdu ? 'مالک' : 'Owner';

  const todayStr = getLocalDateStr();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<ShiftType>('Morning');
  const [searchQuery, setSearchQuery] = useState('');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedSupplierForEntry, setSelectedSupplierForEntry] = useState<Supplier | null>(null);
  const [collectionToEdit, setCollectionToEdit] = useState<MilkCollection | null>(null);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const allSuppliers = await getSuppliers(db, 'active');
      const assigned = isCollector ? await assignedSupplierIds(db, userId) : null;
      const visibleSuppliers = isFarmer
        ? allSuppliers.filter((supplier) => supplier.linked_farm_id === userId)
        : isCollector
          ? allSuppliers.filter((supplier) => assigned?.has(supplier.id))
          : allSuppliers;
      const shiftCollections = await getMilkCollections(db, {
        startDate: selectedDate,
        endDate: selectedDate,
        shift: selectedShift,
        collectorId: isCollector ? userId : undefined,
      });
      const ownIds = new Set(visibleSuppliers.map((supplier) => supplier.id));
      setSuppliers(visibleSuppliers);
      setCollections(
        isFarmer ? shiftCollections.filter((entry) => ownIds.has(entry.supplier_id)) : shiftCollections
      );
    } catch (err) {
      logger.error('Failed to load Dodhi collection data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, isCollector, isFarmer, selectedDate, selectedShift, userId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
    syncNow().catch(() => {});
  }, [loadData, syncNow]);

  const handlePrevDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() - 1);
    setSelectedDate(getLocalDateStr(d));
  };

  const handleNextDay = () => {
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 1);
    setSelectedDate(getLocalDateStr(d));
  };

  // Map of collected entries by supplier_id for the current shift
  const collectionsBySupplierId = useMemo(() => {
    const map = new Map<number, MilkCollection>();
    for (const c of collections) {
      map.set(c.supplier_id, c);
    }
    return map;
  }, [collections]);

  // Route statistics
  const routeStats = useMemo(() => {
    let totalLiters = 0;
    let totalRevenue = 0;
    let fatSum = 0;

    for (const c of collections) {
      totalLiters += c.liters;
      totalRevenue += c.total_amount;
      fatSum += c.fat_percentage * c.liters;
    }

    const avgFat = totalLiters > 0 ? fatSum / totalLiters : 0;
    const completedCount = collections.length;
    const totalSuppliersCount = suppliers.length;

    return {
      totalLiters: Math.round(totalLiters * 10) / 10,
      totalRevenue: Math.round(totalRevenue),
      avgFat: Math.round(avgFat * 10) / 10,
      completedCount,
      totalSuppliersCount,
    };
  }, [collections, suppliers]);

  // Filtered suppliers by search
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase().trim();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.village && s.village.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q)) ||
        (s.linked_farm_id && s.linked_farm_id.toLowerCase().includes(q))
    );
  }, [suppliers, searchQuery]);

  const handleOpenRecordForSupplier = (supplier: Supplier) => {
    const existing = collectionsBySupplierId.get(supplier.id);
    if (existing) {
      setCollectionToEdit(existing);
    } else {
      setCollectionToEdit(null);
    }
    setSelectedSupplierForEntry(supplier);
    setIsRecordModalOpen(true);
  };

  const handleShareDeliverySlip = async (supplier: Supplier, entry: MilkCollection) => {
    const shiftLabel =
      entry.shift === 'Morning'
        ? isUrdu
          ? 'صبح'
          : 'Morning'
        : isUrdu
        ? 'شام'
        : 'Evening';

    const msg = [
      `🥛 *DairyFlow دودھ وصولی پرچی (Milk Slip)*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *کسان / سپلائر:* ${supplier.name}`,
      supplier.village ? `📍 *مقام / پنڈ:* ${supplier.village}` : '',
      `📅 *تاریخ:* ${entry.date} (${shiftLabel})`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🥛 *دودھ:* ${entry.liters} L`,
      `🧪 *فیٹ:* ${entry.fat_percentage}%`,
      `🏷️ *ریٹ:* Rs ${entry.rate_per_liter} / L`,
      `💵 *کل رقم:* Rs ${Math.round(entry.total_amount).toLocaleString()}`,
      `━━━━━━━━━━━━━━━━━━━━`,
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

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Header Bar */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerTitleRow}>
          <View style={styles.headerLeft}>
            <IconBubble icon="milk" variant="mint" size={40} iconSize={20} />
            <View>
              <ThemedText style={styles.titleText}>
                {isUrdu ? 'دودھی پورٹل (Milk Collection)' : 'Dodhi Route Portal'}
              </ThemedText>
              <ThemedText style={[styles.subText, { color: theme.textSecondary }]}>
                {farm?.farmName || (isUrdu ? 'دودھ وصولی مرکز' : 'Collection Center')} · {roleLabel}
              </ThemedText>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Pressable
              onPress={() => router.push('/collection/reports' as never)}
              style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
              <AppIcon name="chart" size={18} color={theme.primary} />
            </Pressable>
            <OfflineStatusBadge compact />
            <Pressable
              onPress={() => router.back()}
              style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
              <AppIcon name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>
        {role === 'owner' && (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <Pressable onPress={() => router.push('/collection/fat-rates' as never)}>
              <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>{isUrdu ? 'فیٹ ریٹ' : 'Fat rates'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/collection/assignments' as never)}>
              <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>{isUrdu ? 'تفویض' : 'Assign'}</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push('/collection/pay' as never)}>
              <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>{isUrdu ? 'ادائیگی' : 'Pay'}</ThemedText>
            </Pressable>
          </View>
        )}

        {/* Shift and Quick Navigation Tabs */}
        <View style={styles.navigationRow}>
          <Pressable
            onPress={() => setSelectedShift('Morning')}
            style={[
              styles.navTab,
              selectedShift === 'Morning' && { backgroundColor: theme.primary },
            ]}>
            <ThemedText
              style={[
                styles.navTabText,
                { color: selectedShift === 'Morning' ? '#FFF' : theme.textSecondary },
              ]}>
              ☀️ {isUrdu ? 'صبح (Morning)' : 'Morning'}
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setSelectedShift('Evening')}
            style={[
              styles.navTab,
              selectedShift === 'Evening' && { backgroundColor: theme.primary },
            ]}>
            <ThemedText
              style={[
                styles.navTabText,
                { color: selectedShift === 'Evening' ? '#FFF' : theme.textSecondary },
              ]}>
              🌙 {isUrdu ? 'شام (Evening)' : 'Evening'}
            </ThemedText>
          </Pressable>
        </View>

        {/* Date Stepper Bar */}
        <View style={[styles.dateNavRow, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'پچھلا دن' : 'Previous day'}
            onPress={handlePrevDay}
            style={styles.dateNavArrow}
            hitSlop={8}>
            <AppIcon name="chevronLeft" size={16} color={theme.text} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'اج دا دن' : 'Today'}
            onPress={() => setSelectedDate(getLocalDateStr())}
            style={styles.dateLabelWrap}>
            <ThemedText style={styles.dateLabelText}>
              📅 {selectedDate} {selectedDate === getLocalDateStr() ? (isUrdu ? '· اج' : '· Today') : ''}
            </ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'اگلا دن' : 'Next day'}
            onPress={handleNextDay}
            style={styles.dateNavArrow}
            hitSlop={8}>
            <AppIcon name="chevronRight" size={16} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + 40 }]}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Live Route Summary Card */}
            <AppCard style={[styles.summaryCard, { backgroundColor: theme.primaryLight, borderColor: theme.primary }]}>
              <View style={styles.summaryTop}>
                <ThemedText style={[styles.summaryHeaderTitle, { color: theme.text }]}>
                  {selectedShift === 'Morning' ? (isUrdu ? 'صبح دی وصولی' : 'Morning Route') : (isUrdu ? 'شام دی وصولی' : 'Evening Route')} · {selectedDate}
                </ThemedText>
                <View style={[styles.progressBadge, { backgroundColor: theme.primary }]}>
                  <ThemedText style={styles.progressText}>
                    {routeStats.completedCount} / {routeStats.totalSuppliersCount} {isUrdu ? 'مکمل' : 'Done'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.summaryStatsRow}>
                <View style={styles.statCol}>
                  <ThemedText style={[styles.statNum, { color: theme.text }]}>
                    {routeStats.totalLiters} L
                  </ThemedText>
                  <ThemedText style={[styles.statTitle, { color: theme.textSecondary }]}>
                    {isUrdu ? 'کل دودھ' : 'Total Liters'}
                  </ThemedText>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statCol}>
                  <ThemedText style={[styles.statNum, { color: theme.primary }]}>
                    Rs {routeStats.totalRevenue.toLocaleString()}
                  </ThemedText>
                  <ThemedText style={[styles.statTitle, { color: theme.textSecondary }]}>
                    {isUrdu ? 'کل بل' : 'Total Value'}
                  </ThemedText>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statCol}>
                  <ThemedText style={[styles.statNum, { color: theme.text }]}>
                    {routeStats.avgFat}%
                  </ThemedText>
                  <ThemedText style={[styles.statTitle, { color: theme.textSecondary }]}>
                    {isUrdu ? 'اوسط فیٹ' : 'Avg Fat'}
                  </ThemedText>
                </View>
              </View>
            </AppCard>

            {/* Quick Action Shortcuts: Suppliers & Weekly Settlements */}
            <View style={styles.shortcutsRow}>
              <Pressable
                onPress={() => router.push('/collection/suppliers' as never)}
                style={[styles.shortcutBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <AppIcon name="users" size={18} color={theme.primary} />
                <ThemedText style={[styles.shortcutText, { color: theme.text }]}>
                  {isUrdu ? 'سپلائرز لسٹ' : 'Suppliers Directory'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.push('/collection/settlements' as never)}
                style={[styles.shortcutBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <AppIcon name="chart" size={18} color={theme.primary} />
                <ThemedText style={[styles.shortcutText, { color: theme.text }]}>
                  {isUrdu ? 'ہفتہ وار حساب (Friday)' : 'Weekly Settlements'}
                </ThemedText>
              </Pressable>
            </View>

            {/* Search and Filter Bar */}
            <View style={[styles.searchContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <AppIcon name="search" size={18} color={theme.textMuted} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={isUrdu ? 'سپلائر، پنڈ یا فارم کوڈ تلاش کرو...' : 'Search supplier, village, or farm code...'}
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <AppIcon name="close" size={16} color={theme.textSecondary} />
                </Pressable>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const entry = collectionsBySupplierId.get(item.id);
          const isCollected = !!entry;

          return (
            <AppCard
              style={[
                styles.supplierCard,
                {
                  backgroundColor: theme.card,
                  borderColor: isCollected ? theme.primary : theme.border,
                },
              ]}>
              <View style={styles.cardHeader}>
                <View style={styles.supplierDetails}>
                  <ThemedText style={styles.supplierName}>{item.name}</ThemedText>
                  <ThemedText style={[styles.villageText, { color: theme.textSecondary }]}>
                    📍 {item.village || (isUrdu ? 'مقام درج نہیں' : 'Location not set')}
                    {item.rate_type === 'fat_based'
                      ? ` · 🧪 Fat × Rs ${item.rate_per_fat_point || 35}`
                      : ` · 🏷️ Rs ${item.flat_rate || 200}/L`}
                    {item.linked_farm_id ? ` · 🔗 ${item.linked_farm_id}` : ''}
                  </ThemedText>
                </View>

                {isCollected ? (
                  <View style={[styles.collectedBadge, { backgroundColor: theme.primaryLight }]}>
                    <ThemedText style={[styles.collectedBadgeText, { color: theme.primary }]}>
                      ✓ {isUrdu ? 'وصول شدہ' : 'Collected'}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.pendingBadge, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={[styles.pendingBadgeText, { color: theme.textMuted }]}>
                      ⏳ {isUrdu ? 'باقی' : 'Pending'}
                    </ThemedText>
                  </View>
                )}
              </View>

              {isCollected ? (
                /* Collected Summary & Edit Row */
                <View style={styles.collectedRow}>
                  <View style={styles.entryMetrics}>
                    <ThemedText style={styles.metricBig}>
                      {entry.liters} L
                    </ThemedText>
                    <ThemedText style={[styles.metricSub, { color: theme.textSecondary }]}>
                      🧪 {entry.fat_percentage}% · Rs {entry.rate_per_liter}/L
                    </ThemedText>
                  </View>

                  <View style={styles.entryActionGroup}>
                    <ThemedText style={[styles.metricTotal, { color: theme.primary }]}>
                      Rs {entry.total_amount.toLocaleString()}
                    </ThemedText>
                    <View style={styles.entryActionsRow}>
                      <Pressable
                        onPress={() => handleShareDeliverySlip(item, entry)}
                        style={styles.slipButton}>
                        <ThemedText style={styles.slipButtonText}>
                          💬 {isUrdu ? 'پرچی' : 'Slip'}
                        </ThemedText>
                      </Pressable>
                      {canRecord && (
                      <Pressable
                        onPress={() => handleOpenRecordForSupplier(item)}
                        style={[styles.editButton, { borderColor: theme.border }]}>
                        <ThemedText style={[styles.editButtonText, { color: theme.textSecondary }]}>
                          ✏️ {isUrdu ? 'درست' : 'Edit'}
                        </ThemedText>
                      </Pressable>
                      )}
                    </View>
                  </View>
                </View>
              ) : (
                /* Not Collected: Fast 1-Tap Entry Button */
                <View style={styles.actionRow}>
                  <ThemedText style={[styles.balanceDueText, { color: theme.textMuted }]}>
                    {isUrdu ? 'بقایا:' : 'Balance:'} Rs {Math.round(item.balance || 0).toLocaleString()}
                  </ThemedText>
                  {canRecord ? (
                  <AppButton
                    title={isUrdu ? '+ دودھ درج کرو' : '+ Record Milk'}
                    variant="primary"
                    size="sm"
                    onPress={() => handleOpenRecordForSupplier(item)}
                    style={styles.recordActionBtn}
                  />
                  ) : (
                    <ThemedText style={[styles.balanceDueText, { color: theme.textMuted }]}>
                      {isUrdu ? 'ابھی درج نہیں' : 'Not entered yet'}
                    </ThemedText>
                  )}
                </View>
              )}
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconBubble icon="users" variant="gray" size={56} iconSize={26} />
            <ThemedText style={styles.emptyTitle}>
              {searchQuery ? (isUrdu ? 'کوئی سپلائر نہیں ملیا' : 'No suppliers found') : (isUrdu ? 'کوئی سپلائر درج نہیں ہے' : 'No suppliers added yet')}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {isCollector
                ? isUrdu
                  ? 'مالک نے ابھی کوئی ڈیری آپ کو نہیں دی'
                  : 'The owner has not assigned a dairy to you yet.'
                : isUrdu
                  ? 'دودھ وصولی شروع کرن لئی نواں سپلائر شامل کرو'
                  : 'Add suppliers to begin recording milk collection'}
            </ThemedText>
            {canAddDairy && (
            <AppButton
              title={isUrdu ? '+ نواں سپلائر شامل کرو' : '+ Add New Supplier'}
              variant="primary"
              onPress={() => setIsAddSupplierModalOpen(true)}
              style={styles.emptyAddBtn}
            />
            )}
          </View>
        }
      />

      {/* Floating Add Supplier Button */}
      {canAddDairy && (
      <Pressable
        onPress={() => setIsAddSupplierModalOpen(true)}
        style={[styles.fab, { backgroundColor: theme.primary }]}>
        <AppIcon name="add" size={24} color="#FFF" />
        <ThemedText style={styles.fabText}>
          {isUrdu ? 'نواں سپلائر' : 'Add Supplier'}
        </ThemedText>
      </Pressable>
      )}

      {/* Modals */}
      <AddMilkCollectionModal
        visible={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSave={loadData}
        initialSupplier={selectedSupplierForEntry}
        suppliers={suppliers}
        selectedDate={selectedDate}
        selectedShift={selectedShift}
        collectionToEdit={collectionToEdit}
        collectorUserId={userId}
        collectorName={personName}
      />

      <AddSupplierModal
        visible={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        onSave={loadData}
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  subText: {
    fontSize: 11,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  navTab: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  navTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dateNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  dateNavArrow: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
  },
  dateLabelWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  listHeader: {
    marginBottom: Spacing.sm,
  },
  summaryCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  summaryHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  progressText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 18,
    fontWeight: '800',
  },
  statTitle: {
    fontSize: 10,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  shortcutBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  shortcutText: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  supplierCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierDetails: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
  },
  villageText: {
    fontSize: 11,
    marginTop: 2,
  },
  collectedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  collectedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pendingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  collectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  entryMetrics: {
    flex: 1,
  },
  metricBig: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricSub: {
    fontSize: 10,
    marginTop: 2,
  },
  entryActionGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  metricTotal: {
    fontSize: 18,
    fontWeight: '800',
  },
  entryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  slipButton: {
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  slipButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  editButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  editButtonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  balanceDueText: {
    fontSize: 11,
  },
  recordActionBtn: {
    minWidth: 120,
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
  emptyAddBtn: {
    marginTop: Spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: Layout.bottomTabInset + 16,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
