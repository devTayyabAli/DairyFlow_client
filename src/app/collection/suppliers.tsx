import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddAdvanceModal } from '@/components/collection/AddAdvanceModal';
import { AddSupplierModal } from '@/components/collection/AddSupplierModal';
import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, IconBubble, useToast } from '@/components/ui';
import { BorderRadius, Layout, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { getSuppliers, Supplier } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

export default function SuppliersScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [isAddAdvanceOpen, setIsAddAdvanceOpen] = useState(false);
  const [advanceSupplierId, setAdvanceSupplierId] = useState<number | undefined>();

  const loadSuppliers = useCallback(async () => {
    try {
      const list = await getSuppliers(db, 'active');
      setSuppliers(list);
    } catch (err) {
      logger.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadSuppliers();
    }, [loadSuppliers])
  );

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.village && s.village.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q)) ||
      (s.linked_farm_id && s.linked_farm_id.toLowerCase().includes(q))
    );
  });

  const handleCall = (phone: string | null | undefined) => {
    if (!phone) {
      toast.info(isUrdu ? 'فون نمبر موجود نہیں' : 'No phone number available');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      toast.error(isUrdu ? 'کال نہیں ہو سکی' : 'Cannot make call');
    });
  };

  const handleOpenAdvance = (supplierId: number) => {
    setAdvanceSupplierId(supplierId);
    setIsAddAdvanceOpen(true);
  };

  const totalOutstandingBalance = suppliers.reduce((acc, s) => acc + (s.balance || 0), 0);

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
              {isUrdu ? 'دودھ سپلائرز (Suppliers)' : 'Milk Suppliers'}
            </ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {suppliers.length} {isUrdu ? 'رجسٹرڈ سپلائرز' : 'Registered Suppliers'}
            </ThemedText>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setSupplierToEdit(null);
              setIsAddSupplierOpen(true);
            }}
            style={[styles.addBtn, { backgroundColor: theme.primary }]}>
            <AppIcon name="add" size={20} color="#FFF" />
          </Pressable>
        </View>

        {/* Total Outstanding Payable Banner */}
        <View style={[styles.totalBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <View>
            <ThemedText style={[styles.totalBannerLabel, { color: theme.textSecondary }]}>
              {isUrdu ? 'کل واجب الادا رقم (Total Payable):' : 'Total Outstanding Balance:'}
            </ThemedText>
            <ThemedText style={[styles.totalBannerAmount, { color: theme.primary }]}>
              Rs {Math.round(totalOutstandingBalance).toLocaleString()}
            </ThemedText>
          </View>
          <IconBubble icon="chart" variant="mint" size={36} iconSize={18} />
        </View>

        {/* Search Bar */}
        <View style={[styles.searchBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <AppIcon name="search" size={18} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={isUrdu ? 'سپلائر یا پنڈ تلاش کرو...' : 'Search supplier or village...'}
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

      {/* Supplier List */}
      <FlatList
        data={filteredSuppliers}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSuppliers();
            }}
            tintColor={theme.primary}
          />
        }
        contentContainerStyle={[styles.listContent, { paddingBottom: Layout.bottomTabInset + 40 }]}
        renderItem={({ item }) => (
          <AppCard
            onPress={() =>
              router.push({
                pathname: '/collection/supplier-ledger' as never,
                params: { id: String(item.id) },
              })
            }
            style={[styles.supplierCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardTop}>
              <View style={styles.supplierMain}>
                <ThemedText style={styles.supplierName}>{item.name}</ThemedText>
                <ThemedText style={[styles.supplierSub, { color: theme.textSecondary }]}>
                  📍 {item.village || (isUrdu ? 'مقام درج نہیں' : 'No village')}
                  {item.rate_type === 'fat_based'
                    ? ` · 🧪 Fat × Rs ${item.rate_per_fat_point || 35}`
                    : ` · 🏷️ Rs ${item.flat_rate || 200}/L Flat`}
                  {item.linked_farm_id ? ` · 🔗 ${item.linked_farm_id}` : ''}
                </ThemedText>
              </View>

              {item.phone && (
                <Pressable
                  onPress={() => handleCall(item.phone)}
                  style={[styles.callBtn, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText style={{ fontSize: 18 }}>📞</ThemedText>
                </Pressable>
              )}
            </View>

            {/* Balance Due & Quick Actions */}
            <View style={[styles.cardDivider, { backgroundColor: theme.border }]} />

            <View style={styles.cardBottom}>
              <View>
                <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'واجب الادا بقایا:' : 'Balance Due:'}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.balanceValue,
                    { color: item.balance > 0 ? theme.primary : theme.textMuted },
                  ]}>
                  Rs {Math.round(item.balance || 0).toLocaleString()}
                </ThemedText>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => handleOpenAdvance(item.id)}
                  style={[styles.smallActionBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={[styles.smallActionText, { color: theme.text }]}>
                    + {isUrdu ? 'پیشگی' : 'Advance'}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setSupplierToEdit(item);
                    setIsAddSupplierOpen(true);
                  }}
                  style={[styles.smallActionBtn, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={[styles.smallActionText, { color: theme.textSecondary }]}>
                    ✏️ {isUrdu ? 'تبدیل' : 'Edit'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </AppCard>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <IconBubble icon="users" variant="gray" size={56} iconSize={26} />
            <ThemedText style={styles.emptyTitle}>
              {searchQuery ? (isUrdu ? 'کوئی سپلائر نہیں ملیا' : 'No matching suppliers') : (isUrdu ? 'ابھی کوئی سپلائر نہیں ہے' : 'No suppliers added yet')}
            </ThemedText>
            <AppButton
              title={isUrdu ? '+ نواں سپلائر شامل کرو' : '+ Add Supplier'}
              variant="primary"
              onPress={() => {
                setSupplierToEdit(null);
                setIsAddSupplierOpen(true);
              }}
              style={styles.emptyAddBtn}
            />
          </View>
        }
      />

      {/* Modals */}
      <AddSupplierModal
        visible={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onSave={loadSuppliers}
        supplierToEdit={supplierToEdit}
      />

      <AddAdvanceModal
        visible={isAddAdvanceOpen}
        onClose={() => setIsAddAdvanceOpen(false)}
        onSave={loadSuppliers}
        suppliers={suppliers}
        initialSupplierId={advanceSupplierId}
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
    justifyContent: 'space-between',
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  totalBannerLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  totalBannerAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 42,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  supplierCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  supplierMain: {
    flex: 1,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
  },
  supplierSub: {
    fontSize: 11,
    marginTop: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.sm,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 10,
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  smallActionBtn: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  smallActionText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyWrap: {
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
  emptyAddBtn: {
    marginTop: Spacing.md,
  },
});
