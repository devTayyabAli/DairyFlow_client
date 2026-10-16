import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminPinModal } from '@/components/dairy/AdminPinModal';
import { FarmProfileModal } from '@/components/dairy/FarmProfileModal';
import { ThemedText } from '@/components/themed-text';
import { AppCard, AppIcon, IconBubble, LanguageToggleButton, SemanticIconName } from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

interface MenuItem {
  key: string;
  icon: SemanticIconName;
  title: string;
  description: string;
  onPress: () => void;
}

export default function MoreScreen() {
  const theme = useTheme();
  const { t, isUrdu } = useLanguage();
  const { farmName, hasPinSet, isAdmin, lockApp, isPinModalOpen, openPinModal, closePinModal } =
    useAdmin();
  const { signOut, pendingCount } = useSync();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const openProfile = useCallback(() => {
    if (hasPinSet && !isAdmin) {
      openPinModal(() => setIsProfileOpen(true));
    } else {
      setIsProfileOpen(true);
    }
  }, [hasPinSet, isAdmin, openPinModal]);

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      t('signOutBtn'),
      pendingCount > 0
        ? isUrdu
          ? `${pendingCount} تبدیلیاں ابھی سنک نہیں ہوئیاں۔ اوہ فون تے رہن گیاں تے دوبارہ لاگ ان تے سنک ہو جان گیاں۔`
          : `${pendingCount} change(s) have not synced yet. They stay on this phone and sync when you sign in again.`
        : t('confirmSignOut'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('signOutBtn'), style: 'destructive', onPress: () => signOut().catch(() => {}) },
      ]
    );
  }, [isUrdu, pendingCount, signOut, t]);

  const items: MenuItem[] = [
    {
      key: 'cloud-sync',
      icon: 'sync',
      title: t('moreSync'),
      description: t('moreSyncDesc'),
      onPress: () => router.push('/more/cloud-sync' as never),
    },
    {
      key: 'expenses',
      icon: 'feed',
      title: t('moreExpenses'),
      description: t('moreExpensesDesc'),
      onPress: () => router.push('/more/expenses'),
    },
    {
      key: 'reports',
      icon: 'chart',
      title: t('moreReports'),
      description: t('moreReportsDesc'),
      onPress: () => router.push('/more/accounts'),
    },
    {
      key: 'backup',
      icon: 'share',
      title: t('moreBackup'),
      description: t('moreBackupDesc'),
      onPress: () => router.push('/more/backup'),
    },
    {
      key: 'profile',
      icon: 'settings',
      title: t('moreProfile'),
      description: t('moreProfileDesc'),
      onPress: openProfile,
    },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Layout.bottomTabInset + 32 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <IconBubble icon="sprout" variant="mint" size={44} iconSize={22} />
          <View style={styles.headerText}>
            <ThemedText style={styles.title}>{t('moreTitle')}</ThemedText>
            <ThemedText numberOfLines={1} style={[styles.subtitle, { color: theme.textSecondary }]}>
              {farmName}
            </ThemedText>
          </View>
          <LanguageToggleButton />
        </View>

        <AppCard variant="default" padding="none" style={styles.menuCard}>
          {items.map((item, index) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={item.onPress}
              android_ripple={{ color: theme.backgroundSelected }}
              style={({ pressed }) => [
                styles.row,
                index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                pressed && { backgroundColor: theme.backgroundElement },
              ]}>
              <IconBubble icon={item.icon} variant="mint" size={40} iconSize={20} />
              <View style={styles.rowText}>
                <ThemedText style={styles.rowTitle}>{item.title}</ThemedText>
                <ThemedText style={[styles.rowDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                  {item.description}
                </ThemedText>
              </View>
              <AppIcon name="chevronRight" size={18} color={theme.textMuted} />
            </Pressable>
          ))}
        </AppCard>

        {hasPinSet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'ایپ لاک کرو' : 'Lock app'}
            onPress={lockApp}
            style={({ pressed }) => [
              styles.logout,
              { backgroundColor: theme.card, borderColor: theme.border },
              pressed && { opacity: 0.8 },
            ]}>
            <AppIcon name="lock" size={18} color={theme.primary} />
            <ThemedText style={[styles.logoutText, { color: theme.primary }]}>
              {isUrdu ? 'ایپ لاک کرو' : 'Lock app'}
            </ThemedText>
          </Pressable>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('signOutBtn')}
          onPress={confirmSignOut}
          style={({ pressed }) => [
            styles.logout,
            { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' },
            pressed && { opacity: 0.8 },
          ]}>
          <AppIcon name="logout" size={18} color={theme.danger} />
          <ThemedText style={[styles.logoutText, { color: theme.danger }]}>{t('signOutBtn')}</ThemedText>
        </Pressable>
      </ScrollView>

      <FarmProfileModal visible={isProfileOpen} onClose={() => setIsProfileOpen(false)} onSaved={() => {}} />
      <AdminPinModal visible={isPinModalOpen} onClose={closePinModal} mode="verify" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1 },
  title: { fontSize: Typography.title1.fontSize, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { fontSize: Typography.subhead.fontSize, marginTop: 2 },
  menuCard: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 68,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: Typography.headline.fontSize, fontWeight: '600' },
  rowDesc: { fontSize: Typography.footnote.fontSize },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  logoutText: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
});
