import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/button';
import { AppCard } from '@/components/ui/card';
import { AppIcon, IconBubble } from '@/components/ui/icon';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { BuyerWithStats, getFilteredEntries, MilkEntry } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

interface BuyerDetailModalProps {
  visible: boolean;
  buyer: BuyerWithStats | null;
  onClose: () => void;
  onSetDefaultBuyer: (buyerId: number) => Promise<void>;
  onDeleteBuyer: (buyerId: number, force?: boolean) => Promise<void>;
}

export function BuyerDetailModal({
  visible,
  buyer,
  onClose,
  onSetDefaultBuyer,
  onDeleteBuyer,
}: BuyerDetailModalProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const [recentEntries, setRecentEntries] = useState<MilkEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);
  const [isSettingDefault, setIsSettingDefault] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Extract initials for buyer avatar
  const initials = useMemo(() => {
    if (!buyer) return 'BY';
    const clean = buyer.name.trim();
    const words = clean.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }, [buyer]);

  // Average rate per liter
  const avgRate = useMemo(() => {
    if (!buyer || buyer.totalLiters <= 0) return 0;
    return Math.round(buyer.totalRevenue / buyer.totalLiters);
  }, [buyer]);

  // Load recent sales for this buyer
  useEffect(() => {
    let isSubscribed = true;

    async function loadRecentSales() {
      if (!buyer || !visible) return;
      setLoadingEntries(true);
      try {
        const list = await getFilteredEntries(db, {
          buyerId: buyer.id,
          limit: 15,
        });
        if (isSubscribed) {
          setRecentEntries(list);
          setLoadingEntries(false);
        }
      } catch (err) {
        if (isSubscribed) {
          logger.error('Failed to load buyer recent entries:', err);
          setLoadingEntries(false);
        }
      }
    }

    loadRecentSales();

    return () => {
      isSubscribed = false;
    };
  }, [db, buyer, visible]);

  if (!buyer) return null;

  // Handle phone call
  const handleCall = () => {
    if (!buyer.phone) return;
    const cleanPhone = buyer.phone.replace(/[^0-9+]/g, '');
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert('Phone Call', `Unable to make phone call to ${buyer.phone}.`);
    });
  };

  // Handle setting as default buyer
  const handleMakeDefault = async () => {
    try {
      setIsSettingDefault(true);
      await onSetDefaultBuyer(buyer.id);
      setIsSettingDefault(false);
    } catch {
      setIsSettingDefault(false);
      Alert.alert('Error', 'Failed to update default buyer.');
    }
  };

  // Handle deletion with confirmation popup
  const handleDelete = () => {
    const message =
      buyer.entriesCount > 0
        ? isUrdu
          ? `کیا آپ واقعی "${buyer.name}" کو حذف کرنا چاہتے ہیں؟ اس خریدار کے تمام ${buyer.entriesCount} ریکارڈز، ادائیگیاں اور دودھ کی ترسیلات مستقل طور پر حذف ہو جائیں گی۔`
          : `Are you sure you want to delete "${buyer.name}"? This buyer has ${buyer.entriesCount} recorded transaction(s). All associated milk collections and payments will also be permanently deleted.`
        : isUrdu
        ? `کیا آپ واقعی "${buyer.name}" کو حذف کرنا چاہتے ہیں؟`
        : `Are you sure you want to delete "${buyer.name}"? This buyer will be removed permanently.`;

    Alert.alert(
      isUrdu ? 'گاہک حذف کریں؟' : 'Delete Buyer',
      message,
      [
        { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
        {
          text: isUrdu ? 'حذف کریں' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await onDeleteBuyer(buyer.id, true);
              setIsDeleting(false);
              onClose();
            } catch (e: any) {
              setIsDeleting(false);
              Alert.alert(isUrdu ? 'خرابی' : 'Error', e.message || 'Failed to delete buyer.');
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        {/* Header Bar */}
        <View style={[styles.headerBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close buyer account"
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>

          <View style={styles.headerTitleGroup}>
            <ThemedText style={styles.headerTitle}>Buyer account</ThemedText>
            <ThemedText style={styles.headerSubtitle} numberOfLines={1}>
              {buyer.name}
            </ThemedText>
          </View>

          <View style={styles.headerRightPlaceholder} />
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Layout.bottomTabInset + 40 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* 1. Profile Card */}
          <AppCard variant="default" padding="lg" style={styles.profileCard}>
            <View style={styles.profileTopRow}>
              <View style={[styles.avatarBubble, { backgroundColor: theme.primaryLight }]}>
                <ThemedText style={[styles.avatarText, { color: theme.primaryDark }]}>
                  {initials}
                </ThemedText>
              </View>

              <View style={styles.profileMeta}>
                <ThemedText style={styles.profileName}>{buyer.name}</ThemedText>
                {buyer.address ? (
                  <View style={styles.contactRow}>
                    <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                    <ThemedText style={styles.contactText} numberOfLines={1}>
                      {buyer.address}
                    </ThemedText>
                  </View>
                ) : null}
                {buyer.phone ? (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={14} color={theme.primary} />
                    <ThemedText style={[styles.contactText, { color: theme.primaryDark }]}>
                      {buyer.phone}
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {/* Quick Call Action (matching Screenshot 151353) */}
              {buyer.phone ? (
                <Pressable
                  onPress={handleCall}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${buyer.name}`}
                  style={({ pressed }) => [
                    styles.callActionBtn,
                    { backgroundColor: theme.primaryLight },
                    pressed && styles.pressed,
                  ]}>
                  <Ionicons name="call" size={18} color={theme.primaryDark} />
                </Pressable>
              ) : null}
            </View>

            {/* Default Status & Action */}
            <View style={[styles.defaultStatusRow, { borderColor: theme.border }]}>
              {buyer.is_default === 1 ? (
                <View style={[styles.defaultActiveBadge, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="star" size={13} color={theme.primaryDark} />
                  <ThemedText style={[styles.defaultActiveText, { color: theme.primaryDark }]}>
                    Primary Default Buyer (Preselected for new sales)
                  </ThemedText>
                </View>
              ) : (
                <AppButton
                  variant="outline"
                  size="sm"
                  title={isSettingDefault ? 'Setting...' : 'Set as Default Buyer'}
                  icon={<Ionicons name="star-outline" size={14} color={theme.primaryDark} />}
                  onPress={handleMakeDefault}
                  disabled={isSettingDefault}
                  style={styles.setDefaultBtn}
                />
              )}
            </View>
          </AppCard>

          {/* 2. Financial Highlights Card (matching Screenshot 151353) */}
          <AppCard variant="mint" padding="lg" style={styles.financialCard}>
            <View style={styles.financialTopRow}>
              <View>
                <ThemedText style={[styles.financialLabel, { color: theme.primaryDark }]}>
                  Total Milk Purchased
                </ThemedText>
                <ThemedText style={[styles.financialAmount, { color: theme.primaryDark }]}>
                  Rs {Math.round(buyer.totalRevenue).toLocaleString()}
                </ThemedText>
                <ThemedText style={[styles.financialVolume, { color: theme.primaryDark }]}>
                  {buyer.totalLiters.toFixed(1)} Liters total volume supplied
                </ThemedText>
              </View>
              <IconBubble icon="wallet" variant="mint" size={44} iconSize={22} />
            </View>

            <View style={[styles.financialDivider, { backgroundColor: '#C8E6D3' }]} />

            <View style={styles.financialStatsRow}>
              <View style={styles.financialStatCol}>
                <ThemedText style={styles.subStatLabel}>Total Collections</ThemedText>
                <ThemedText style={[styles.subStatValue, { color: theme.primaryDark }]}>
                  {buyer.entriesCount} {buyer.entriesCount === 1 ? 'record' : 'records'}
                </ThemedText>
              </View>

              <View style={styles.financialStatCol}>
                <ThemedText style={styles.subStatLabel}>Average Rate</ThemedText>
                <ThemedText style={[styles.subStatValue, { color: theme.primaryDark }]}>
                  {avgRate > 0 ? `Rs ${avgRate}/L` : '—'}
                </ThemedText>
              </View>
            </View>
          </AppCard>

          {/* 3. Latest Milk Sales Section */}
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <ThemedText style={styles.sectionTitle}>Latest milk sales</ThemedText>
              <View style={[styles.countPill, { backgroundColor: theme.primaryLight }]}>
                <ThemedText style={[styles.countPillText, { color: theme.primaryDark }]}>
                  {recentEntries.length}
                </ThemedText>
              </View>
            </View>
          </View>

          {loadingEntries ? (
            <View style={styles.salesLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText style={styles.loadingText}>Loading recent records...</ThemedText>
            </View>
          ) : recentEntries.length === 0 ? (
            <AppCard variant="default" padding="lg" style={styles.emptySalesCard}>
              <AppIcon name="milk" size={32} color={theme.textMuted} />
              <ThemedText style={styles.emptySalesTitle}>No milk entries recorded</ThemedText>
              <ThemedText style={styles.emptySalesSubtitle}>
                Add milk entries with {buyer.name} selected as the buyer.
              </ThemedText>
            </AppCard>
          ) : (
            <View style={styles.entriesList}>
              {recentEntries.map((entry) => (
                <AppCard key={entry.id} variant="default" padding="md" style={styles.entryRowCard}>
                  <View style={styles.entryTopRow}>
                    <View style={styles.entryDateGroup}>
                      <View
                        style={[
                          styles.shiftBadge,
                          {
                            backgroundColor:
                              entry.shift === 'Morning' ? theme.morningBg : theme.eveningBg,
                          },
                        ]}>
                        <ThemedText
                          style={[
                            styles.shiftBadgeText,
                            {
                              color: entry.shift === 'Morning' ? theme.morning : theme.evening,
                            },
                          ]}>
                          {entry.shift === 'Morning' ? '☀️ Morning' : '🌙 Evening'}
                        </ThemedText>
                      </View>
                      <ThemedText style={styles.entryDateText}>{entry.date}</ThemedText>
                    </View>

                    <ThemedText style={styles.entryTotalAmount}>
                      Rs {Math.round(entry.total_amount).toLocaleString()}
                    </ThemedText>
                  </View>

                  <View style={styles.entryDetailsRow}>
                    <ThemedText style={styles.entryMetricText}>
                      {entry.liters.toFixed(1)} L
                    </ThemedText>
                    <ThemedText style={styles.entryMetricDot}>·</ThemedText>
                    <ThemedText style={styles.entryMetricText}>
                      {entry.fat_percentage}% fat
                    </ThemedText>
                    <ThemedText style={styles.entryMetricDot}>·</ThemedText>
                    <ThemedText style={styles.entryMetricText}>
                      Rs {entry.rate_per_liter}/L
                    </ThemedText>
                  </View>
                </AppCard>
              ))}
            </View>
          )}

          {/* 4. Safety & Integrity Section */}
          <View style={styles.integritySection}>
            {buyer.entriesCount > 0 ? (
              <AppCard variant="default" padding="md" style={styles.protectedNoticeCard}>
                <View style={styles.protectedRow}>
                  <Ionicons name="shield-checkmark" size={20} color={theme.primary} />
                  <View style={styles.protectedMeta}>
                    <ThemedText style={styles.protectedTitle}>Records Protected</ThemedText>
                    <ThemedText style={styles.protectedText}>
                      This buyer has {buyer.entriesCount} recorded transaction(s). SQLite foreign keys
                      protect these records so your financial history remains accurate.
                    </ThemedText>
                  </View>
                </View>
              </AppCard>
            ) : (
              <View style={styles.deleteActionWrap}>
                <AppButton
                  variant="secondary"
                  size="md"
                  title={isDeleting ? 'Deleting...' : 'Delete Buyer'}
                  icon={<Ionicons name="trash-outline" size={16} color={theme.danger} />}
                  onPress={handleDelete}
                  disabled={isDeleting}
                  style={styles.deleteBtn}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.bodyBold.fontSize,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: Typography.footnote.fontSize,
    color: '#64748B',
  },
  headerRightPlaceholder: {
    width: 36,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  profileCard: {
    gap: Spacing.sm,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarBubble: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileMeta: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '500',
  },
  callActionBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultStatusRow: {
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    marginTop: Spacing.xs,
  },
  defaultActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  defaultActiveText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  setDefaultBtn: {
    alignSelf: 'flex-start',
  },
  financialCard: {
    gap: Spacing.sm,
  },
  financialTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  financialLabel: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  financialAmount: {
    fontSize: 26,
    fontWeight: '800',
    marginTop: 2,
  },
  financialVolume: {
    fontSize: Typography.footnote.fontSize,
    marginTop: 2,
    opacity: 0.85,
  },
  financialDivider: {
    height: 1,
    marginVertical: 4,
  },
  financialStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  financialStatCol: {
    gap: 2,
  },
  subStatLabel: {
    fontSize: 11,
    color: '#064E3B',
    opacity: 0.75,
  },
  subStatValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.bodyBold.fontSize,
    fontWeight: '700',
  },
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  salesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  loadingText: {
    fontSize: Typography.subhead.fontSize,
    color: '#64748B',
  },
  emptySalesCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xl,
  },
  emptySalesTitle: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
    marginTop: 4,
  },
  emptySalesSubtitle: {
    fontSize: Typography.footnote.fontSize,
    color: '#64748B',
    textAlign: 'center',
  },
  entriesList: {
    gap: Spacing.sm,
  },
  entryRowCard: {
    gap: 6,
  },
  entryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  shiftBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  shiftBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  entryDateText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },
  entryTotalAmount: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  entryDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  entryMetricText: {
    fontSize: Typography.footnote.fontSize,
    color: '#64748B',
  },
  entryMetricDot: {
    color: '#94A3B8',
    fontSize: 12,
  },
  integritySection: {
    marginTop: Spacing.xs,
  },
  protectedNoticeCard: {
    borderColor: '#E2E8F0',
  },
  protectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  protectedMeta: {
    flex: 1,
    gap: 2,
  },
  protectedTitle: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '700',
    color: '#0F172A',
  },
  protectedText: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  deleteActionWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  deleteBtn: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
});
