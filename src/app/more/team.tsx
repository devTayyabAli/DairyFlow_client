import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  EmptyState,
  IconBubble,
  SemanticIconName,
  useToast,
} from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { insertSupplier } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { getAuthToken } from '@/sync/sync-storage';
import { UserRole } from '@/sync/sync-types';
import { logger } from '@/utils/logger';

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  assignedRoutes: string[];
  status: string;
  createdAt: string;
}

const AVAILABLE_ROLES: {
  role: UserRole;
  labelUrdu: string;
  labelEn: string;
  descUrdu: string;
  descEn: string;
  icon: SemanticIconName;
}[] = [
  {
    role: 'collector',
    labelUrdu: 'دودھی',
    labelEn: 'Dodhi',
    descUrdu: 'دودھ لینے جاتا ہے۔ ڈیری چن کر لیٹر اور فیٹ لکھتا ہے۔',
    descEn: 'Goes out to collect milk. Picks a dairy and enters liters and fat.',
    icon: 'milk',
  },
  {
    role: 'farmer',
    labelUrdu: 'ڈیری',
    labelEn: 'Dairy',
    descUrdu: 'جس سے دودھ خریدا جاتا ہے۔ اپنی وصولی خود دیکھتا ہے۔',
    descEn: 'The dairy you buy milk from. They see their own collections.',
    icon: 'cow',
  },
];

export default function TeamManagementScreen() {
  const { role } = useSync();
  if (role && role !== 'owner' && role !== 'manager') return <Redirect href="/collection" />;
  return <TeamManagementBody />;
}

function TeamManagementBody() {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const db = useSQLiteContext();
  const { role: currentUserRole, farm, apiUrl, isSignedIn } = useSync();
  const toast = useToast();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('collector');
  const [formRoute, setFormRoute] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formVillage, setFormVillage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = currentUserRole === 'owner';

  const fetchMembers = useCallback(async () => {
    if (!isSignedIn) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await fetch(`${apiUrl}/tenants/members`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      } else if (res.status === 403) {
        logger.warn('Forbidden: Current role lacks permission to list members');
      }
    } catch (err) {
      logger.error('Failed to fetch team members:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl, isSignedIn]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) fetchMembers();
    });
    return () => {
      active = false;
    };
  }, [fetchMembers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMembers();
  }, [fetchMembers]);

  const handleOpenAddModal = () => {
    if (!canManage) {
      toast.info(
        isUrdu
          ? 'صرف مالک دودھی اور ڈیری کے اکاؤنٹ بنا سکتا ہے'
          : 'Only the owner can create dodhi and dairy accounts'
      );
      return;
    }
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('collector');
    setFormRoute('');
    setFormPhone('');
    setFormVillage('');
    setIsAddModalOpen(true);
  };

  const handleCreateMember = async () => {
    const trimmedEmail = formEmail.trim().toLowerCase();
    if (!formName.trim()) {
      toast.error(isUrdu ? 'نام لکھو' : 'Enter a name');
      return;
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      toast.error(isUrdu ? 'درست ای میل درج کرو' : 'Please provide a valid email');
      return;
    }
    if (!formPassword || formPassword.length < 8) {
      toast.error(
        isUrdu ? 'پاس ورڈ کم از کم 8 ہندسیاں دا ہونا چاہیدا اے' : 'Password must be at least 8 characters'
      );
      return;
    }

    setSubmitting(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error(isUrdu ? 'لاگ ان درکار اے' : 'Authentication required');
        return;
      }

      const payload = {
        name: formName.trim() || undefined,
        email: trimmedEmail,
        password: formPassword,
        role: formRole,
        assignedRoutes:
          formRole === 'collector' && formRoute.trim() ? [formRoute.trim()] : undefined,
      };

      const res = await fetch(`${apiUrl}/tenants/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        if (formRole === 'farmer' && data.member?.userId) {
          await insertSupplier(db, {
            name: formName.trim(),
            phone: formPhone.trim() || null,
            village: formVillage.trim() || null,
            linked_farm_id: data.member.userId,
            rate_type: 'fat_based',
          });
        }
        toast.success(
          isUrdu ? 'اکاؤنٹ بن گیا' : 'Account created'
        );
        setIsAddModalOpen(false);
        fetchMembers();
      } else {
        toast.error(data.error?.message || (isUrdu ? 'ممبر شامل نہیں ہو سکیا' : 'Failed to add member'));
      }
    } catch (err) {
      logger.error('Error adding member:', err);
      toast.error(isUrdu ? 'نیٹ ورک مسئلہ۔ دوبارہ کوشش کرو۔' : 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return { bg: '#8B5CF620', border: '#8B5CF6', text: '#7C3AED', label: isUrdu ? 'مالک' : 'Owner' };
      case 'manager':
        return { bg: '#3B82F620', border: '#3B82F6', text: '#2563EB', label: isUrdu ? 'منیجر' : 'Manager' };
      case 'collector':
        return { bg: '#10B98120', border: '#10B981', text: '#059669', label: isUrdu ? 'دودھی' : 'Dodhi' };
      case 'farmer':
        return { bg: '#F59E0B20', border: '#F59E0B', text: '#D97706', label: isUrdu ? 'ڈیری' : 'Dairy' };
      case 'accountant':
        return { bg: '#F59E0B20', border: '#F59E0B', text: '#D97706', label: isUrdu ? 'اکاؤنٹنٹ' : 'Accountant' };
      case 'auditor':
        return { bg: '#6B728020', border: '#6B7280', text: '#4B5563', label: isUrdu ? 'آڈیٹر' : 'Auditor' };
      default:
        return { bg: '#06B6D420', border: '#06B6D4', text: '#0891B2', label: isUrdu ? 'عملہ' : 'Staff' };
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'واپس' : 'Back'}
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText style={styles.headerTitle}>
            {isUrdu ? 'دودھی اور ڈیری' : 'Dodhi and dairies'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {farm?.farmName || (isUrdu ? 'ڈیری بزنس' : 'Dairy Business')} · {currentUserRole.toUpperCase()}
          </ThemedText>
        </View>
        {canManage && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'ممبر شامل کرو' : 'Add member'}
            onPress={handleOpenAddModal}
            hitSlop={8}
            style={({ pressed }) => [
              styles.addBtn,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <AppIcon name="add" size={16} color="#FFFFFF" />
            <ThemedText style={styles.addBtnText}>
              {isUrdu ? 'شامل کرو' : 'Add'}
            </ThemedText>
          </Pressable>
        )}
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
        {/* Permission Info Banner */}
        <AppCard variant="flat" padding="md" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <IconBubble icon="users" variant="mint" size={36} iconSize={18} />
            <View style={styles.infoText}>
              <ThemedText style={styles.infoTitle}>
                {isUrdu ? 'ایک کاروبار، تین اکاؤنٹ' : 'One business, three accounts'}
              </ThemedText>
              <ThemedText style={[styles.infoDesc, { color: theme.textSecondary }]}>
                {isUrdu
                  ? 'مالک سب دیکھتا ہے۔ دودھی ڈیری چن کر لیٹر اور فیٹ لکھتا ہے۔ وہی اندراج ڈیری اور مالک دونوں کو دکھائی دیتی ہے۔'
                  : 'The owner sees everything. A dodhi picks a dairy and enters liters and fat. That entry shows on the dodhi, the dairy, and the owner.'}
              </ThemedText>
            </View>
          </View>
        </AppCard>

        {/* Members List */}
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>
            {isUrdu ? 'اکاؤنٹس' : 'Accounts'} ({members.length})
          </ThemedText>
        </View>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : members.length === 0 ? (
          <EmptyState
            icon="users"
            title={isUrdu ? 'ابھی کوئی اکاؤنٹ نہیں' : 'No accounts yet'}
            message={
              isUrdu
                ? 'پہلے اپنے دودھی بناؤ، پھر جن ڈیریوں سے دودھ خریدتے ہو ان کے اکاؤنٹ۔'
                : 'Create your dodhis, then accounts for the dairies you buy milk from.'
            }
            actionLabel={canManage ? (isUrdu ? 'ممبر شامل کرو' : 'Add Member') : undefined}
            onAction={canManage ? handleOpenAddModal : undefined}
          />
        ) : (
          <View style={styles.memberList}>
            {members.map((member) => {
              const badge = getRoleBadgeColor(member.role);
              return (
                <AppCard key={member.id} variant="default" padding="md" style={styles.memberCard}>
                  <View style={styles.memberRow}>
                    <IconBubble icon="users" variant="mint" size={44} iconSize={22} />
                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <ThemedText style={styles.memberName}>
                          {member.name || member.email.split('@')[0]}
                        </ThemedText>
                        <View
                          style={[
                            styles.roleBadge,
                            { backgroundColor: badge.bg, borderColor: badge.border },
                          ]}>
                          <ThemedText style={[styles.roleBadgeText, { color: badge.text }]}>
                            {badge.label}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.memberEmail, { color: theme.textSecondary }]}>
                        {member.email}
                        {member.status === 'suspended' ? (isUrdu ? ' · بند' : ' · inactive') : ''}
                      </ThemedText>
                      {canManage && member.userId !== farm?.userId && (
                        <Pressable
                          onPress={async () => {
                            const token = await getAuthToken();
                            if (!token) return;
                            const next = member.status === 'suspended' ? 'active' : 'suspended';
                            const res = await fetch(`${apiUrl}/tenants/members/${member.userId}/status`, {
                              method: 'POST',
                              headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({ status: next }),
                            });
                            if (res.ok) fetchMembers();
                            else toast.error(isUrdu ? 'حالت نہیں بدلی' : 'Could not change the account');
                          }}>
                          <ThemedText style={{ color: theme.primary, fontWeight: '700', marginTop: 6 }}>
                            {member.status === 'suspended'
                              ? isUrdu
                                ? 'دوبارہ چالو کرو'
                                : 'Activate'
                              : isUrdu
                                ? 'بند کرو'
                                : 'Deactivate'}
                          </ThemedText>
                        </Pressable>
                      )}
                      {member.assignedRoutes && member.assignedRoutes.length > 0 && (
                        <View style={styles.routeWrap}>
                          <ThemedText style={[styles.routeText, { color: theme.primaryDark }]}>
                            📍 {isUrdu ? 'مقرر کردہ روٹ:' : 'Route:'} {member.assignedRoutes.join(', ')}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </View>
                </AppCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={isAddModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddModalOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsAddModalOpen(false)} />
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <View>
                <ThemedText style={styles.modalTitle}>
                  {isUrdu ? 'نیا اکاؤنٹ' : 'New account'}
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {isUrdu ? 'کردار منتخب کرو تے لاگ ان تفصیلات درج کرو' : 'Select role and provide login details'}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => setIsAddModalOpen(false)}
                style={[styles.modalCloseBtn, { backgroundColor: theme.backgroundElement }]}>
                <AppIcon name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              <AppTextInput
                label={isUrdu ? 'پورا نام (اختیاری)' : 'Full Name (Optional)'}
                placeholder={isUrdu ? 'مثلاً محمد بلال' : 'e.g. Muhammad Bilal'}
                value={formName}
                onChangeText={setFormName}
              />

              <AppTextInput
                label={isUrdu ? 'ای میل ایڈریس' : 'Email Address'}
                placeholder="collector@dairyflow.pk"
                value={formEmail}
                onChangeText={setFormEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <AppTextInput
                label={isUrdu ? 'پاس ورڈ (کم از کم 8 ہندسے)' : 'Password (Min 8 characters)'}
                placeholder="••••••••"
                value={formPassword}
                onChangeText={setFormPassword}
                secureTextEntry
              />

              {/* Role Selection */}
              <View style={styles.rolePickerSection}>
                <ThemedText style={styles.formLabel}>
                  {isUrdu ? 'کردار (Role)' : 'Select Role'}
                </ThemedText>
                <View style={styles.roleList}>
                  {AVAILABLE_ROLES.map((r) => {
                    const isSelected = formRole === r.role;
                    return (
                      <Pressable
                        key={r.role}
                        onPress={() => setFormRole(r.role)}
                        style={[
                          styles.roleOption,
                          {
                            backgroundColor: isSelected ? theme.primaryLight : theme.backgroundElement,
                            borderColor: isSelected ? theme.primary : theme.border,
                          },
                        ]}>
                        <IconBubble
                          icon={r.icon}
                          variant={isSelected ? 'mint' : 'gray'}
                          size={32}
                          iconSize={16}
                        />
                        <View style={styles.roleOptionText}>
                          <ThemedText
                            style={[
                              styles.roleOptionTitle,
                              isSelected && { color: theme.primaryDark, fontWeight: '700' },
                            ]}>
                            {isUrdu ? r.labelUrdu : r.labelEn}
                          </ThemedText>
                          <ThemedText style={[styles.roleOptionDesc, { color: theme.textSecondary }]}>
                            {isUrdu ? r.descUrdu : r.descEn}
                          </ThemedText>
                        </View>
                        {isSelected && <AppIcon name="check" size={18} color={theme.primary} />}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Assigned Route for Collector */}
              {formRole === 'farmer' && (
                <>
                  <AppTextInput
                    label={isUrdu ? 'فون' : 'Phone'}
                    placeholder="03xx"
                    value={formPhone}
                    onChangeText={setFormPhone}
                    keyboardType="phone-pad"
                  />
                  <AppTextInput
                    label={isUrdu ? 'گاؤں' : 'Village'}
                    placeholder={isUrdu ? 'مثلاً چک 34' : 'e.g. Chak 34'}
                    value={formVillage}
                    onChangeText={setFormVillage}
                  />
                </>
              )}

              {formRole === 'collector' && (
                <AppTextInput
                  label={isUrdu ? 'مقرر کردہ روٹ (اختیاری)' : 'Assigned Route (Optional)'}
                  placeholder={isUrdu ? 'مثلاً قصور روڈ، چوک اعظم' : 'e.g. Kasur Main Route'}
                  value={formRoute}
                  onChangeText={setFormRoute}
                />
              )}

              <View style={styles.modalActionRow}>
                <AppButton
                  title={isUrdu ? 'منسوخ کرو' : 'Cancel'}
                  variant="outline"
                  onPress={() => setIsAddModalOpen(false)}
                  style={styles.actionBtn}
                />
                <AppButton
                  title={isUrdu ? 'محفوظ کرو' : 'Add Member'}
                  variant="primary"
                  loading={submitting}
                  disabled={submitting}
                  onPress={handleCreateMember}
                  style={styles.actionBtn}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700' },
  headerSubtitle: { fontSize: Typography.footnote.fontSize, marginTop: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  infoCard: {
    borderRadius: BorderRadius.lg,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoText: { flex: 1 },
  infoTitle: { fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  infoDesc: { fontSize: Typography.caption.fontSize, marginTop: 2, lineHeight: 16 },
  sectionHeader: { marginTop: Spacing.xs },
  sectionTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  loaderWrap: { paddingVertical: Spacing.xl, alignItems: 'center' },
  memberList: { gap: Spacing.sm },
  memberCard: { borderRadius: BorderRadius.md },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  memberInfo: { flex: 1, gap: 2 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memberName: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  roleBadgeText: { fontSize: 11, fontWeight: '700' },
  memberEmail: { fontSize: Typography.footnote.fontSize },
  routeWrap: { marginTop: 4 },
  routeText: { fontSize: Typography.caption.fontSize, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: { flex: 1 },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700' },
  modalSubtitle: { fontSize: Typography.footnote.fontSize, marginTop: 2 },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: { gap: Spacing.md, paddingBottom: Spacing.xl },
  formLabel: { fontSize: Typography.subhead.fontSize, fontWeight: '700', marginBottom: 6 },
  rolePickerSection: { gap: 4 },
  roleList: { gap: Spacing.xs },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  roleOptionText: { flex: 1 },
  roleOptionTitle: { fontSize: Typography.subhead.fontSize, fontWeight: '600' },
  roleOptionDesc: { fontSize: Typography.caption.fontSize, marginTop: 1 },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionBtn: { flex: 1 },
});
