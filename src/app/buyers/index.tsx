import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddBuyerModal } from '@/components/dairy/AddBuyerModal';
import { AdminPinModal } from '@/components/dairy/AdminPinModal';
import { BuyerOverviewCard } from '@/components/dairy/BuyerCard';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  FilterChip,
  LanguageToggleButton,
  ListSkeleton,
  useToast,
} from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { addBuyer, BuyerOverviewItem, deleteBuyer, getBuyersOverview } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

type BuyerFilter = 'all' | 'balance' | 'settled';

const SEARCH_DEBOUNCE_MS = 200;

const keyExtractor = (item: BuyerOverviewItem) => String(item.buyer.id);

export default function BuyersDirectoryScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [buyersOverview, setBuyersOverview] = useState<BuyerOverviewItem[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<BuyerFilter>('all');
  const [isAddBuyerModalOpen, setIsAddBuyerModalOpen] = useState(false);

  // Debounce the search text so filtering does not run on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadData = useCallback(async () => {
    try {
      const data = await getBuyersOverview(db);
      setBuyersOverview(data);
    } catch (err) {
      logger.error('Failed to load buyers overview:', err);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [db]);

  // Runs on mount and whenever the tab regains focus (single fetch path).
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleAddBuyer = useCallback(
    async (name: string, phone?: string, address?: string, isDefault?: boolean) => {
      await addBuyer(db, name, phone, address, isDefault);
      await loadData();
      toast.success(isUrdu ? `گاہک "${name}" شامل ہو گیا` : `Added buyer "${name}"`);
    },
    [db, isUrdu, loadData, toast]
  );

  const openBuyer = useCallback((id: number) => {
    router.push(`/buyers/${id}` as any);
  }, []);

  const openAddBuyer = useCallback(() => setIsAddBuyerModalOpen(true), []);
  const closeAddBuyer = useCallback(() => setIsAddBuyerModalOpen(false), []);
  const openWeeklyReport = useCallback(() => router.push('/more/accounts'), []);

  const { totalOutstanding, withBalanceCount, settledCount } = useMemo(() => {
    let total = 0;
    let withBalance = 0;
    for (const item of buyersOverview) {
      if (item.balanceDue > 0) {
        total += item.balanceDue;
        withBalance += 1;
      }
    }
    return {
      totalOutstanding: total,
      withBalanceCount: withBalance,
      settledCount: buyersOverview.length - withBalance,
    };
  }, [buyersOverview]);

  const filteredBuyers = useMemo(() => {
    return buyersOverview.filter((item) => {
      if (selectedFilter === 'balance' && item.balanceDue <= 0) return false;
      if (selectedFilter === 'settled' && item.balanceDue > 0) return false;
      if (!searchQuery) return true;
      const { name, phone, address } = item.buyer;
      return (
        name.toLowerCase().includes(searchQuery) ||
        (phone?.toLowerCase().includes(searchQuery) ?? false) ||
        (address?.toLowerCase().includes(searchQuery) ?? false)
      );
    });
  }, [buyersOverview, searchQuery, selectedFilter]);

  const existingBuyers = useMemo(() => buyersOverview.map((b) => b.buyer), [buyersOverview]);

  const { hasPinSet, isAdmin, isPinModalOpen, openPinModal, closePinModal } = useAdmin();

  const executeDeleteBuyer = useCallback(
    async (buyerId: number) => {
      try {
        await deleteBuyer(db, buyerId, true);
        await loadData();
        toast.success(isUrdu ? 'گاہک حذف کر دیا گیا' : 'Buyer deleted');
      } catch (err: any) {
        logger.error('Failed to delete buyer:', err);
        toast.error(isUrdu ? 'گاہک حذف نہیں ہو سکا' : err?.message || 'Failed to delete buyer');
      }
    },
    [db, isUrdu, loadData, toast]
  );

  const handleDeleteBuyer = useCallback(
    (item: BuyerOverviewItem) => {
      Alert.alert(
        isUrdu ? 'گاہک حذف کریں؟' : 'Delete Buyer?',
        isUrdu
          ? `کیا آپ واقعی "${item.buyer.name}" کو حذف کرنا چاہتے ہیں؟ اس گاہک کے تمام ریکارڈز، ادائیگیاں اور دودھ کی ترسیلات مستقل طور پر ختم ہو جائیں گی۔`
          : `Are you sure you want to delete "${item.buyer.name}"? All associated milk deliveries and payment records will be permanently deleted.`,
        [
          { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
          {
            text: isUrdu ? 'حذف کریں' : 'Delete',
            style: 'destructive',
            onPress: () => {
              if (hasPinSet && !isAdmin) {
                openPinModal(() => executeDeleteBuyer(item.buyer.id));
              } else {
                executeDeleteBuyer(item.buyer.id);
              }
            },
          },
        ]
      );
    },
    [executeDeleteBuyer, hasPinSet, isAdmin, isUrdu, openPinModal]
  );

  const renderItem = useCallback(
    ({ item }: { item: BuyerOverviewItem }) => (
      <BuyerOverviewCard item={item} onPress={openBuyer} onDelete={handleDeleteBuyer} />
    ),
    [handleDeleteBuyer, openBuyer]
  );

  const isFiltering = searchQuery.length > 0 || selectedFilter !== 'all';

  const listHeader = (
    <View style={styles.listHeader}>
      <AppCard variant="mint" padding="lg" style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.heroTextWrap}>
            <ThemedText style={[styles.heroLabel, { color: theme.cardMintText }]}>
              {isUrdu ? 'کل بقایا' : 'Total outstanding'}
            </ThemedText>
            <ThemedText style={[styles.heroAmount, { color: theme.cardMintText }]} numberOfLines={1}>
              Rs {totalOutstanding.toLocaleString()}
            </ThemedText>
            <ThemedText style={[styles.heroFootnote, { color: theme.textSecondary }]}>
              {isUrdu
                ? `${buyersOverview.length} میں سے ${withBalanceCount} گاہکوں کے ذمے بقایا`
                : `${withBalanceCount} of ${buyersOverview.length} buyers have a balance due`}
            </ThemedText>
          </View>
          <View style={[styles.heroIcon, { backgroundColor: theme.card }]}>
            <AppIcon name="wallet" size={20} color={theme.primary} />
          </View>
        </View>
      </AppCard>

      <AppTextInput
        placeholder={isUrdu ? 'گاہک کا نام یا فون تلاش کریں' : 'Search name or phone number'}
        value={searchInput}
        onChangeText={setSearchInput}
        leftIcon={<AppIcon name="search" size={16} color={theme.textMuted} />}
        clearButtonMode="while-editing"
        autoCorrect={false}
      />

      <View style={styles.chipsRow}>
        <FilterChip
          label={isUrdu ? `تمام گاہک · ${buyersOverview.length}` : `All buyers · ${buyersOverview.length}`}
          selected={selectedFilter === 'all'}
          onPress={() => setSelectedFilter('all')}
        />
        <FilterChip
          label={isUrdu ? `بقایا کے ساتھ · ${withBalanceCount}` : `With balance · ${withBalanceCount}`}
          selected={selectedFilter === 'balance'}
          onPress={() => setSelectedFilter('balance')}
        />
        <FilterChip
          label={isUrdu ? `صاف · ${settledCount}` : `Settled · ${settledCount}`}
          selected={selectedFilter === 'settled'}
          onPress={() => setSelectedFilter('settled')}
        />
      </View>
    </View>
  );

  const listEmpty = loaded ? (
    <AppCard variant="default" padding="lg" style={styles.emptyCard}>
      <AppIcon name="users" size={32} color={theme.textMuted} />
      <ThemedText style={styles.emptyTitle}>
        {isFiltering
          ? isUrdu ? 'کوئی گاہک نہیں ملا' : 'No matching buyers'
          : isUrdu ? 'ابھی کوئی گاہک نہیں' : 'No buyers yet'}
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        {isFiltering
          ? isUrdu ? 'تلاش یا فلٹر تبدیل کریں۔' : 'Try a different search or filter.'
          : isUrdu
            ? 'فروخت اور ادائیگیاں ٹریک کرنے کے لیے پہلا گاہک شامل کریں۔'
            : 'Add your first milk buyer to start tracking sales and payments.'}
      </ThemedText>
    </AppCard>
  ) : null;

  const listFooter = (
    <AppButton
      variant="primary"
      title={isUrdu ? 'گاہک شامل کریں' : 'Add buyer'}
      icon={<AppIcon name="add" size={18} color="#FFFFFF" />}
      onPress={openAddBuyer}
      style={styles.addButton}
    />
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.headerTextWrap}>
          <ThemedText style={styles.headerTitle}>{isUrdu ? 'گاہک' : 'Buyers'}</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {isUrdu ? 'کھاتے، بقایا اور وصولیاں' : 'Ledgers, balances & collections'}
          </ThemedText>
        </View>
        <View style={styles.headerActions}>
          <LanguageToggleButton />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'ہفتہ وار رپورٹ' : 'Weekly report'}
            onPress={openWeeklyReport}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <AppIcon name="chart" size={18} color={theme.primaryDark} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'گاہک شامل کریں' : 'Add buyer'}
            onPress={openAddBuyer}
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: theme.primaryLight },
              pressed && styles.pressed,
            ]}>
            <AppIcon name="add" size={18} color={theme.primaryDark} />
          </Pressable>
        </View>
      </View>

      {!loaded ? (
        <ListSkeleton />
      ) : (
      <FlatList
        data={filteredBuyers}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
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

      <AddBuyerModal
        visible={isAddBuyerModalOpen}
        onClose={closeAddBuyer}
        onSaveBuyer={handleAddBuyer}
        existingBuyers={existingBuyers}
      />
      <AdminPinModal visible={isPinModalOpen} onClose={closePinModal} mode="verify" />
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
  headerTextWrap: { flex: 1 },
  headerTitle: { ...Typography.title2, fontWeight: '800' },
  headerSubtitle: { ...Typography.caption, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
  listContent: { padding: Spacing.lg, gap: Spacing.md },
  listHeader: { gap: Spacing.md },
  heroCard: { borderRadius: BorderRadius.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  heroTextWrap: { flex: 1 },
  heroLabel: { ...Typography.caption, fontWeight: '700' },
  heroAmount: { ...Typography.display, fontWeight: '800', marginTop: 2 },
  heroFootnote: { ...Typography.caption, marginTop: 2 },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  emptyCard: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xxl },
  emptyTitle: { ...Typography.headline, fontWeight: '700' },
  emptySubtitle: { ...Typography.subhead, textAlign: 'center' },
  addButton: { marginTop: Spacing.xs },
});
