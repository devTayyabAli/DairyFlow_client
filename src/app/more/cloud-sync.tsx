import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OfflineStatusBadge } from '@/components/dairy/OfflineStatusBadge';
import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, AppTextInput, IconBubble } from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

/**
 * Account & sync status. Reached only while signed in: signing out returns to the sign-in screen
 * (the auth gate sits above the tabs), so this screen has no sign-in/registration forms.
 */
export default function CloudSyncScreen() {
  const theme = useTheme();
  const { t, isUrdu } = useLanguage();
  const {
    status,
    pendingCount,
    lastSyncedAt,
    syncNow,
    farm,
    isSignedIn,
    setOfflineMode,
    isSessionExpired,
    error,
    changePassword,
    signOut,
    apiUrl,
    updateApiUrl,
  } = useSync();

  const tr = (en: string, ur: string) => (isUrdu ? ur : en);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Change password
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');

  // Server address
  const [editingApiUrl, setEditingApiUrl] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(apiUrl);

  const formatSyncTime = (iso: string | null) => {
    if (!iso) return t('neverSynced');
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
  };

  const handleSaveApiUrl = async () => {
    try {
      await updateApiUrl(customUrlInput);
      setEditingApiUrl(false);
    } catch (err) {
      Alert.alert(tr('Error', 'خرابی'), err instanceof Error ? err.message : tr('Could not save the address', 'پتہ محفوظ نہیں ہو سکیا'));
    }
  };

  const handleManualSync = async () => {
    setLoading(true);
    try {
      const res = await syncNow();
      if (res.status === 'success') {
        const pulled = res.pulledCount ?? 0;
        const pushed = res.appliedCount ?? 0;
        Alert.alert(
          tr('Sync complete', 'سنک مکمل'),
          tr(`${pulled} pulled, ${pushed} pushed.`, `${pulled} تبدیلیاں آئیاں، ${pushed} گیاں۔`)
        );
      } else if (res.status === 'skipped') {
        Alert.alert(tr('Sync skipped', 'سنک نہیں ہو سکیا'), res.message || t('offlineNotice'));
      } else {
        Alert.alert(tr('Sync error', 'سنک وچ مسئلہ'), res.message || t('syncFailed'));
      }
    } catch (err) {
      Alert.alert(tr('Error', 'خرابی'), err instanceof Error ? err.message : t('syncFailed'));
    } finally {
      setLoading(false);
    }
  };

  const resetChangePasswordForm = () => {
    setChangingPassword(false);
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setErrorMessage(null);
  };

  const handleChangePassword = async () => {
    setErrorMessage(null);
    if (!currentPasswordInput || !newPasswordInput) {
      setErrorMessage(tr('Please fill in all fields.', 'تمام خانے پر کرو۔'));
      return;
    }
    if (newPasswordInput.length < 8) {
      setErrorMessage(tr('The new password must be at least 8 characters.', 'نواں پاس ورڈ کم از کم 8 حروف دا ہووے۔'));
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setErrorMessage(tr('The new passwords do not match.', 'دونوں نویں پاس ورڈ نہیں ملدے۔'));
      return;
    }

    setLoading(true);
    try {
      const res = await changePassword(currentPasswordInput, newPasswordInput);
      if (res.success) {
        resetChangePasswordForm();
        Alert.alert(
          tr('Password updated', 'پاس ورڈ بدل گیا'),
          tr('Your other devices will be asked to sign in again.', 'ہور فونز تے دوبارہ لاگ ان کرنا پئے گا۔')
        );
      } else if (res.code === 'INVALID_CREDENTIALS') {
        setErrorMessage(tr('Current password is incorrect.', 'موجودہ پاس ورڈ غلط اے۔'));
      } else {
        setErrorMessage(res.error || t('syncFailed'));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutConfirm = useCallback(() => {
    Alert.alert(
      t('signOutBtn'),
      pendingCount > 0
        ? tr(
            `${pendingCount} change(s) have not synced yet. They stay on this phone and sync when you sign in again.`,
            `${pendingCount} تبدیلیاں ابھی سنک نہیں ہوئیاں۔ اوہ فون تے رہن گیاں تے دوبارہ لاگ ان تے سنک ہو جان گیاں۔`
          )
        : t('confirmSignOut'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('signOutBtn'),
          style: 'destructive',
          onPress: () => {
            // The auth gate swaps in the sign-in screen as soon as the session is cleared.
            signOut().catch(() => {});
          },
        },
      ]
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tr only reads isUrdu
  }, [signOut, t, pendingCount, isUrdu]);

  // Phones that predate accounts can run offline without signing in (see AuthGate).
  if (!isSignedIn) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Back', 'واپس')}
            onPress={() => router.back()}
            hitSlop={6}
            style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <AppIcon name="chevronLeft" size={20} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <ThemedText style={styles.headerTitle}>{t('cloudSyncTitle')}</ThemedText>
          </View>
        </View>
        <View style={styles.content}>
          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <IconBubble icon="sync" variant="mint" size={40} iconSize={20} />
              <View style={styles.flex}>
                <ThemedText style={styles.cardTitle}>{tr('Working offline', 'آف لائن کم ہو رہیا اے')}</ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  {tr(
                    'Sign in to back up your records and use them on any phone.',
                    'ریکارڈ محفوظ کرن تے کسے وی فون تے ویکھن لئی لاگ ان کرو۔'
                  )}
                </ThemedText>
              </View>
            </View>
            <AppButton
              title={tr('Sign in or create account', 'لاگ ان یا اکاؤنٹ بنائیں')}
              variant="primary"
              size="lg"
              onPress={() => setOfflineMode(false)}
            />
          </AppCard>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('Back', 'واپس')}
            onPress={() => router.back()}
            hitSlop={6}
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: theme.card, borderColor: theme.border },
              pressed && { opacity: 0.7 },
            ]}>
            <AppIcon name="chevronLeft" size={20} color={theme.text} />
          </Pressable>

          <View style={styles.headerText}>
            <ThemedText style={styles.headerTitle} numberOfLines={1}>
              {t('cloudSyncTitle')}
            </ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {t('cloudSyncSubtitle')}
            </ThemedText>
          </View>

          <OfflineStatusBadge compact />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Layout.bottomTabInset + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {isSessionExpired && (
            <View style={[styles.banner, { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' }]}>
              <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
              <ThemedText style={[styles.bannerText, { color: theme.danger }]}>{t('sessionExpired')}</ThemedText>
              <AppButton
                title={tr('Sign in again', 'دوبارہ لاگ ان')}
                variant="outline"
                size="sm"
                onPress={() => signOut().catch(() => {})}
              />
            </View>
          )}

          {!isSessionExpired && status === 'error' && error ? (
            <View style={[styles.banner, { backgroundColor: theme.accentBg, borderColor: theme.accent + '40' }]}>
              <Ionicons name="warning-outline" size={20} color={theme.accent} />
              <ThemedText style={[styles.bannerText, { color: theme.accent }]}>{error}</ThemedText>
            </View>
          ) : null}

          {/* Account */}
          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <IconBubble icon="sprout" variant="mint" size={40} iconSize={20} />
              <View style={styles.flex}>
                <ThemedText style={styles.cardTitle}>{t('farmProfileHeading')}</ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  {farm?.farmName || t('appName')}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.infoList, { borderTopColor: theme.border }]}>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  {t('ownerNameLabel')}
                </ThemedText>
                <ThemedText style={styles.infoValue}>{farm?.ownerName || '—'}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                  {tr('Email', 'ای میل')}
                </ThemedText>
                <ThemedText style={styles.infoValue} numberOfLines={1}>
                  {farm?.email || '—'}
                </ThemedText>
              </View>
              {farm?.defaultMilkRate ? (
                <View style={styles.infoRow}>
                  <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                    {t('defaultMilkRateLabel')}
                  </ThemedText>
                  <ThemedText style={styles.infoValue}>Rs {farm.defaultMilkRate}</ThemedText>
                </View>
              ) : null}
            </View>
          </AppCard>

          {/* Sync status */}
          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <IconBubble icon="sync" variant="mint" size={40} iconSize={20} />
              <View style={styles.flex}>
                <ThemedText style={styles.cardTitle}>{t('moreSync')}</ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                  {status === 'syncing'
                    ? t('syncStatusSyncing')
                    : pendingCount > 0
                      ? `${pendingCount} ${t('pendingChangesNotice')}`
                      : t('noPendingChanges')}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.metricsGrid, { borderTopColor: theme.border }]}>
              <View style={styles.metricItem}>
                <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                  {t('lastSyncedLabel')}
                </ThemedText>
                <ThemedText style={styles.metricValue}>{formatSyncTime(lastSyncedAt)}</ThemedText>
              </View>
              <View style={styles.metricItem}>
                <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                  {t('pendingChangesLabel')}
                </ThemedText>
                <ThemedText
                  style={[styles.metricValue, { color: pendingCount > 0 ? theme.morning : theme.primary }]}>
                  {pendingCount} {t('syncStatusPending')}
                </ThemedText>
              </View>
            </View>

            <AppButton
              title={status === 'syncing' || loading ? t('syncStatusSyncing') : t('syncNowBtn')}
              variant="primary"
              size="lg"
              loading={status === 'syncing' || loading}
              onPress={handleManualSync}
              icon={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
            />
          </AppCard>

          <View style={[styles.noteBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
            <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>{t('adminPinCloudNotice')}</ThemedText>
          </View>

          {/* Change password */}
          <AppCard style={styles.card}>
            {changingPassword ? (
              <View style={styles.form}>
                <ThemedText style={styles.cardTitle}>{tr('Change password', 'پاس ورڈ بدلو')}</ThemedText>

                {errorMessage ? (
                  <View
                    accessibilityRole="alert"
                    style={[styles.banner, { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' }]}>
                    <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                    <ThemedText style={[styles.bannerText, { color: theme.danger }]}>{errorMessage}</ThemedText>
                  </View>
                ) : null}

                <AppTextInput
                  label={tr('Current password', 'موجودہ پاس ورڈ')}
                  placeholder="••••••••"
                  value={currentPasswordInput}
                  onChangeText={setCurrentPasswordInput}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                />
                <AppTextInput
                  label={tr('New password (min 8 characters)', 'نواں پاس ورڈ (کم از کم 8 حروف)')}
                  placeholder="••••••••"
                  value={newPasswordInput}
                  onChangeText={setNewPasswordInput}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <AppTextInput
                  label={tr('Confirm new password', 'نواں پاس ورڈ دوبارہ')}
                  placeholder="••••••••"
                  value={confirmPasswordInput}
                  onChangeText={setConfirmPasswordInput}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />

                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AppButton title={tr('Cancel', 'منسوخ')} variant="outline" size="md" onPress={resetChangePasswordForm} />
                  </View>
                  <View style={styles.flex}>
                    <AppButton
                      title={tr('Update', 'محفوظ کرو')}
                      variant="primary"
                      size="md"
                      loading={loading}
                      onPress={handleChangePassword}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr('Change password', 'پاس ورڈ بدلو')}
                onPress={() => {
                  setErrorMessage(null);
                  setChangingPassword(true);
                }}
                style={styles.cardHeader}>
                <IconBubble icon="lock" variant="mint" size={40} iconSize={20} />
                <View style={styles.flex}>
                  <ThemedText style={styles.cardTitle}>{tr('Change password', 'پاس ورڈ بدلو')}</ThemedText>
                  <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                    {tr('Signs out your other devices', 'ہور فونز تے دوبارہ لاگ ان کرنا پئے گا')}
                  </ThemedText>
                </View>
                <AppIcon name="chevronRight" size={18} color={theme.textMuted} />
              </Pressable>
            )}
          </AppCard>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('signOutBtn')}
            onPress={handleSignOutConfirm}
            style={({ pressed }) => [
              styles.signOutBtn,
              { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' },
              pressed && { opacity: 0.8 },
            ]}>
            <AppIcon name="logout" size={18} color={theme.danger} />
            <ThemedText style={[styles.signOutText, { color: theme.danger }]}>{t('signOutBtn')}</ThemedText>
          </Pressable>

          {/* Server address: developer setting, never shown to farmers in release builds */}
          {__DEV__ ? (
          <AppCard style={styles.card}>
            <View style={styles.serverHeader}>
              <View style={styles.serverTitleRow}>
                <Ionicons name="server-outline" size={18} color={theme.primary} />
                <ThemedText style={styles.cardTitle}>{tr('Server', 'سرور')}</ThemedText>
              </View>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  setEditingApiUrl(!editingApiUrl);
                  setCustomUrlInput(apiUrl);
                }}>
                <ThemedText style={[styles.serverAction, { color: theme.primary }]}>
                  {editingApiUrl ? tr('Cancel', 'منسوخ') : tr('Change', 'تبدیل کرو')}
                </ThemedText>
              </Pressable>
            </View>

            {editingApiUrl ? (
              <View style={styles.form}>
                <AppTextInput
                  label={tr('Server address', 'سرور دا پتہ')}
                  value={customUrlInput}
                  onChangeText={setCustomUrlInput}
                  placeholder="https://api.example.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <View style={styles.row}>
                  <AppButton title={tr('Save', 'محفوظ کرو')} variant="primary" size="sm" onPress={handleSaveApiUrl} />
                  <AppButton
                    title={tr('Reset default', 'ڈیفالٹ')}
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setCustomUrlInput('');
                      updateApiUrl('').catch(() => {});
                      setEditingApiUrl(false);
                    }}
                  />
                </View>
              </View>
            ) : (
              <ThemedText style={[styles.serverUrl, { color: theme.textSecondary }]} numberOfLines={1}>
                {apiUrl}
              </ThemedText>
            )}
          </AppCard>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: Typography.title3.fontSize, fontWeight: '700', letterSpacing: -0.2 },
  headerSubtitle: { fontSize: Typography.footnote.fontSize, marginTop: 2 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  cardTitle: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  cardSubtitle: { fontSize: Typography.subhead.fontSize, marginTop: 2 },
  form: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.sm },
  infoList: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md, gap: Spacing.sm },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  infoLabel: { fontSize: Typography.subhead.fontSize },
  infoValue: { fontSize: Typography.subhead.fontSize, fontWeight: '600', flexShrink: 1 },
  metricsGrid: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md, flexDirection: 'row', gap: Spacing.md },
  metricItem: { flex: 1, gap: 4 },
  metricLabel: { fontSize: Typography.caption.fontSize, textTransform: 'uppercase', letterSpacing: 0.5 },
  metricValue: { fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: Typography.footnote.fontSize, fontWeight: '600' },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  noteText: { flex: 1, fontSize: Typography.footnote.fontSize, lineHeight: 18 },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  signOutText: { fontSize: Typography.headline.fontSize, fontWeight: '700' },
  serverHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  serverTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  serverAction: { fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  serverUrl: { fontSize: Typography.footnote.fontSize },
});
