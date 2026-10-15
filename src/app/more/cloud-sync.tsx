import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
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
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  IconBubble,
} from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

type AuthMode = 'signin' | 'register';

export default function CloudSyncScreen() {
  const theme = useTheme();
  const { t, isUrdu } = useLanguage();
  const {
    status,
    pendingCount,
    lastSyncedAt,
    syncNow,
    isSignedIn,
    farm,
    isSessionExpired,
    signIn,
    register,
    verifyOtp,
    resendOtp,
    signOut,
    apiUrl,
    updateApiUrl,
  } = useSync();

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingApiUrl, setEditingApiUrl] = useState<boolean>(false);
  const [customUrlInput, setCustomUrlInput] = useState<string>(apiUrl);

  const handleSaveApiUrl = async () => {
    try {
      await updateApiUrl(customUrlInput);
      setEditingApiUrl(false);
      Alert.alert(
        isUrdu ? 'سرور ایڈریس محفوظ' : 'Server URL Updated',
        isUrdu ? 'سرور دا پتہ کامیابی نال تبدیل ہو گیا۔' : `Backend API endpoint set to: ${customUrlInput.trim() || 'Default'}`
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save URL');
    }
  };

  // Sign In Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State
  const [regFarmName, setRegFarmName] = useState('');
  const [regOwnerName, setRegOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regMilkRate, setRegMilkRate] = useState('');

  // OTP (email verification) step: set once a code has been emailed
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const startOtpStep = (email: string, resendAfterSeconds = 60) => {
    setOtpEmail(email);
    setOtpCode('');
    setResendIn(resendAfterSeconds);
    setErrorMessage(null);
  };

  // Format timestamp nicely
  const formatSyncTime = (isoString: string | null) => {
    if (!isoString) return t('neverSynced');
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch {
      return isoString;
    }
  };

  // This phone holds a different farm's data: ask before replacing it, then retry with consent.
  const confirmReplaceLocalData = (retry: () => Promise<void>) => {
    const unsynced = pendingCount > 0;
    Alert.alert(
      isUrdu ? 'ہور فارم دا ڈیٹا' : 'Data from another farm',
      isUrdu
        ? `اس فون وچ کسی ہور فارم دا ڈیٹا اے۔ جاری رکھن نال ایہ فون توں مٹ جاوے گا${unsynced ? ` تے ${pendingCount} غیر سنک تبدیلیاں ضائع ہو جان گیاں` : ''}۔`
        : `This phone has data from a different farm. Continuing removes it from this phone${
            unsynced ? ` and ${pendingCount} unsynced change(s) will be lost` : ''
          }. Anything already synced stays on that farm's account.`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: isUrdu ? 'مٹا کے جاری رکھو' : 'Replace data',
          style: 'destructive',
          onPress: () => {
            retry().catch(() => {});
          },
        },
      ]
    );
  };

  // Sign in with email + password. An unverified account is sent to the OTP step.
  const handleSignIn = async (replaceLocalData = false): Promise<void> => {
    setErrorMessage(null);
    const email = loginEmail.trim();
    if (!email || !loginPassword) {
      setErrorMessage(
        isUrdu ? 'براہ کرم ای میل اور پاس ورڈ درج کریں' : 'Please enter your email and password'
      );
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage(isUrdu ? 'درست ای میل درج کریں' : 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await signIn(email, loginPassword, { replaceLocalData });
      if (res.needsVerification && res.email) {
        // Password was right but the email was never confirmed: send a fresh code and verify now.
        const sent = await resendOtp(res.email);
        startOtpStep(res.email, sent.success ? sent.resendAfterSeconds : sent.retryAfterSeconds ?? 60);
        return;
      }
      if (!res.success) {
        if (res.needsConfirmation === 'other-farm') {
          confirmReplaceLocalData(() => handleSignIn(true));
        } else {
          setErrorMessage(res.error || t('invalidCredentials'));
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  // Register: validates, creates a pending account and emails the OTP (no sign-in yet).
  const handleRegister = async (): Promise<void> => {
    setErrorMessage(null);
    const farmName = regFarmName.trim();
    const ownerName = regOwnerName.trim();
    const email = regEmail.trim();
    const phone = regPhone.trim();
    const password = regPassword;
    const milkRateNum = regMilkRate ? parseFloat(regMilkRate) : undefined;

    if (!farmName || !ownerName || !email || !password) {
      setErrorMessage(
        isUrdu ? 'تمام ضروری خانے پر کریں' : 'Please fill in all required fields'
      );
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMessage(isUrdu ? 'درست ای میل درج کریں' : 'Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setErrorMessage(
        isUrdu
          ? 'پاس ورڈ کم از کم 8 حروف کا ہونا چاہیے'
          : 'Password must be at least 8 characters long'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        farmName,
        ownerName,
        email,
        password,
        phone: phone || undefined,
        defaultMilkRate: milkRateNum,
      });

      if (res.otpRequired && res.email) {
        startOtpStep(res.email, res.resendAfterSeconds ?? 60);
      } else if (!res.success) {
        setErrorMessage(res.error || t('syncFailed'));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  // Confirm the emailed code. On success the context signs in and the screen switches to signed-in.
  const handleVerifyOtp = async (replaceLocalData = false): Promise<void> => {
    if (!otpEmail) return;
    setErrorMessage(null);
    const code = otpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setErrorMessage(isUrdu ? '6 ہندسیاں دا کوڈ درج کرو' : 'Enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(otpEmail, code, { replaceLocalData });
      if (res.success) {
        setOtpEmail(null);
        setOtpCode('');
        return;
      }
      if (res.needsConfirmation === 'other-farm') {
        confirmReplaceLocalData(() => handleVerifyOtp(true));
        return;
      }
      if (res.code === 'OTP_INVALID') {
        setErrorMessage(
          isUrdu
            ? `کوڈ غلط اے${res.attemptsLeft !== undefined ? ` (${res.attemptsLeft} کوششاں باقی)` : ''}`
            : `Incorrect code${res.attemptsLeft !== undefined ? ` (${res.attemptsLeft} attempts left)` : ''}`
        );
      } else if (res.code === 'OTP_EXPIRED' || res.code === 'OTP_LOCKED') {
        setResendIn(0); // a new code is the only way forward
        setErrorMessage(res.error || t('syncFailed'));
      } else {
        setErrorMessage(res.error || t('syncFailed'));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (): Promise<void> => {
    if (!otpEmail || resendIn > 0) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await resendOtp(otpEmail);
      if (res.success) {
        setOtpCode('');
        setResendIn(res.resendAfterSeconds ?? 60);
      } else {
        if (res.retryAfterSeconds) setResendIn(res.retryAfterSeconds);
        setErrorMessage(res.error || t('syncFailed'));
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t('networkError'));
    } finally {
      setLoading(false);
    }
  };

  // Handle Manual Sync
  const handleManualSync = async () => {
    setLoading(true);
    try {
      const res = await syncNow();
      if (res.status === 'success') {
        const pulled = res.pulledCount ?? 0;
        const pushed = res.appliedCount ?? 0;
        Alert.alert(
          isUrdu ? 'سنک کامیاب' : 'Sync Complete',
          isUrdu
            ? `کامیابی نال سنک ہو گیا (${pulled} تبدیلیاں آئیاں، ${pushed} گیاں)`
            : `Sync completed successfully (${pulled} pulled, ${pushed} pushed).`,
          [{ text: 'OK' }]
        );
      } else if (res.status === 'skipped') {
        Alert.alert(
          isUrdu ? 'سنک نہیں ہو سکیا' : 'Sync Skipped',
          res.message || t('offlineNotice'),
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          isUrdu ? 'سنک میں مسئلہ' : 'Sync Error',
          res.message || t('syncFailed'),
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      Alert.alert(
        isUrdu ? 'خرابی' : 'Error',
        err instanceof Error ? err.message : t('syncFailed'),
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle Sign Out confirmation
  const handleSignOutConfirm = useCallback(() => {
    Alert.alert(t('signOutBtn'), t('confirmSignOut'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('signOutBtn'),
        style: 'destructive',
        onPress: () => {
          signOut().catch(() => {});
        },
      },
    ]);
  }, [signOut, t]);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        {/* Navigation Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isUrdu ? 'واپس' : 'Back'}
            onPress={() => router.back()}
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
            <ThemedText
              style={[styles.headerSubtitle, { color: theme.textSecondary }]}
              numberOfLines={1}>
              {t('cloudSyncSubtitle')}
            </ThemedText>
          </View>

          <OfflineStatusBadge compact />
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Layout.bottomTabInset + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* ========================================================= */}
          {/* 1. SIGNED-IN STATE                                        */}
          {/* ========================================================= */}
          {isSignedIn ? (
            <View style={{ gap: Spacing.lg }}>
              {/* Session Expired Banner */}
              {isSessionExpired && (
                <View
                  style={[
                    styles.banner,
                    { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' },
                  ]}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                  <ThemedText style={[styles.bannerText, { color: theme.danger }]}>
                    {t('sessionExpired')}
                  </ThemedText>
                </View>
              )}

              {/* Farm Profile Card */}
              <AppCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <IconBubble icon="sprout" variant="mint" size={40} iconSize={20} />
                  <View style={{ flex: 1 }}>
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
                    <ThemedText style={styles.infoValue}>
                      {farm?.ownerName || '—'}
                    </ThemedText>
                  </View>

                  <View style={styles.infoRow}>
                    <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                      {isUrdu ? 'ای میل' : 'Email'}
                    </ThemedText>
                    <ThemedText style={styles.infoValue}>
                      {farm?.email || '—'}
                    </ThemedText>
                  </View>

                  {farm?.defaultMilkRate ? (
                    <View style={styles.infoRow}>
                      <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                        {t('defaultMilkRateLabel')}
                      </ThemedText>
                      <ThemedText style={styles.infoValue}>
                        Rs {farm.defaultMilkRate}
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
              </AppCard>

              {/* Sync Metrics Card */}
              <AppCard style={styles.card}>
                <View style={styles.cardHeader}>
                  <IconBubble icon="sync" variant="mint" size={40} iconSize={20} />
                  <View style={{ flex: 1 }}>
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
                    <ThemedText style={styles.metricValue}>
                      {formatSyncTime(lastSyncedAt)}
                    </ThemedText>
                  </View>

                  <View style={styles.metricItem}>
                    <ThemedText style={[styles.metricLabel, { color: theme.textSecondary }]}>
                      {t('pendingChangesLabel')}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.metricValue,
                        { color: pendingCount > 0 ? theme.morning : theme.primary },
                      ]}>
                      {pendingCount} {t('syncStatusPending')}
                    </ThemedText>
                  </View>
                </View>

                {/* Sync Action Button */}
                <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                  <AppButton
                    title={status === 'syncing' || loading ? t('syncStatusSyncing') : t('syncNowBtn')}
                    variant="primary"
                    size="lg"
                    loading={status === 'syncing' || loading}
                    onPress={handleManualSync}
                    icon={<Ionicons name="refresh" size={18} color="#FFFFFF" />}
                  />
                </View>
              </AppCard>

              {/* Local Security & Offline Note */}
              <View
                style={[
                  styles.noteBox,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
                <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
                  {t('adminPinCloudNotice')}
                </ThemedText>
              </View>

              {/* Sign Out Button */}
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
                <ThemedText style={[styles.signOutText, { color: theme.danger }]}>
                  {t('signOutBtn')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            /* ========================================================= */
            /* 2. SIGNED-OUT STATE (Sign In or Register Farm)             */
            /* ========================================================= */
            <View style={{ gap: Spacing.lg }}>
              {/* Feature Intro */}
              <AppCard style={styles.introCard}>
                <View style={styles.introIconRow}>
                  <IconBubble icon="sync" variant="mint" size={48} iconSize={24} />
                </View>
                <ThemedText style={styles.introTitle}>
                  {authMode === 'signin' ? t('signInBtn') : t('registerBtn')}
                </ThemedText>
                <ThemedText style={[styles.introDesc, { color: theme.textSecondary }]}>
                  {isUrdu
                    ? 'کلاؤڈ سنک نال تہاڈا فارم دا سارا ریکارڈ محفوظ رہے گا تے نویں فون تے وی بحال ہو جائے گا۔'
                    : 'Sync across devices, preserve continuous backups, and easily restore your farm records on any new phone.'}
                </ThemedText>
              </AppCard>

              {/* Segmented Mode Selector (hidden while verifying an emailed code) */}
              {!otpEmail && (
              <View
                style={[
                  styles.tabContainer,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <Pressable
                  onPress={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                  }}
                  style={[
                    styles.tabButton,
                    authMode === 'signin' && [
                      styles.tabButtonActive,
                      { backgroundColor: theme.card },
                    ],
                  ]}>
                  <ThemedText
                    style={[
                      styles.tabText,
                      authMode === 'signin' && { color: theme.primary, fontWeight: '700' },
                    ]}>
                    {t('signInBtn')}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => {
                    setAuthMode('register');
                    setErrorMessage(null);
                  }}
                  style={[
                    styles.tabButton,
                    authMode === 'register' && [
                      styles.tabButtonActive,
                      { backgroundColor: theme.card },
                    ],
                  ]}>
                  <ThemedText
                    style={[
                      styles.tabText,
                      authMode === 'register' && { color: theme.primary, fontWeight: '700' },
                    ]}>
                    {t('registerBtn')}
                  </ThemedText>
                </Pressable>
              </View>
              )}

              {/* Error Message Box */}
              {errorMessage && (
                <View
                  style={[
                    styles.banner,
                    { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' },
                  ]}>
                  <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
                  <ThemedText style={[styles.bannerText, { color: theme.danger }]}>
                    {errorMessage}
                  </ThemedText>
                </View>
              )}

              {/* Auth Forms */}
              <AppCard style={styles.card}>
                {otpEmail ? (
                  // OTP verification step
                  <View style={{ gap: Spacing.md }}>
                    <View style={{ gap: Spacing.xs }}>
                      <ThemedText style={styles.cardTitle}>
                        {isUrdu ? 'ای میل تصدیق کرو' : 'Verify your email'}
                      </ThemedText>
                      <ThemedText style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
                        {isUrdu
                          ? `اسیں 6 ہندسیاں دا کوڈ ${otpEmail} تے بھیجیا اے۔`
                          : `We sent a 6-digit code to ${otpEmail}. Enter it below to finish.`}
                      </ThemedText>
                    </View>

                    <AppTextInput
                      label={isUrdu ? 'تصدیقی کوڈ' : 'Verification code'}
                      placeholder="123456"
                      value={otpCode}
                      onChangeText={(text) => setOtpCode(text.replace(/\D/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      inputStyle={{ letterSpacing: 8, fontSize: 22, textAlign: 'center' }}
                    />

                    <AppButton
                      title={loading ? t('syncStatusSyncing') : isUrdu ? 'تصدیق کرو' : 'Verify & continue'}
                      variant="primary"
                      size="lg"
                      loading={loading}
                      onPress={() => handleVerifyOtp()}
                      icon={<Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />}
                    />

                    <Pressable
                      disabled={resendIn > 0 || loading}
                      onPress={handleResendOtp}
                      style={[styles.switchLink, (resendIn > 0 || loading) && { opacity: 0.5 }]}>
                      <ThemedText style={[styles.switchLinkText, { color: theme.primary }]}>
                        {resendIn > 0
                          ? isUrdu
                            ? `کوڈ دوبارہ بھیجو (${resendIn}s)`
                            : `Resend code in ${resendIn}s`
                          : isUrdu
                            ? 'کوڈ دوبارہ بھیجو'
                            : 'Resend code'}
                      </ThemedText>
                    </Pressable>

                    <Pressable
                      onPress={() => {
                        setOtpEmail(null);
                        setOtpCode('');
                        setErrorMessage(null);
                      }}
                      style={styles.switchLink}>
                      <ThemedText style={[styles.switchLinkText, { color: theme.textSecondary }]}>
                        {isUrdu ? 'واپس / ای میل بدلو' : 'Back / change email'}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : authMode === 'signin' ? (
                  // Sign In Form
                  <View style={{ gap: Spacing.md }}>
                    <AppTextInput
                      label={isUrdu ? 'ای میل' : 'Email'}
                      placeholder="name@example.com"
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                    />

                    <AppTextInput
                      label={t('passwordLabel')}
                      placeholder="••••••••"
                      value={loginPassword}
                      onChangeText={setLoginPassword}
                      secureTextEntry
                    />

                    <View style={{ marginTop: Spacing.sm }}>
                      <AppButton
                        title={loading ? t('syncStatusSyncing') : t('signInBtn')}
                        variant="primary"
                        size="lg"
                        loading={loading}
                        onPress={() => handleSignIn()}
                        icon={<Ionicons name="log-in-outline" size={20} color="#FFFFFF" />}
                      />
                    </View>

                    <Pressable
                      onPress={() => {
                        setAuthMode('register');
                        setErrorMessage(null);
                      }}
                      style={styles.switchLink}>
                      <ThemedText style={[styles.switchLinkText, { color: theme.primary }]}>
                        {t('switchToRegister')}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : (
                  // Register Form
                  <View style={{ gap: Spacing.md }}>
                    <AppTextInput
                      label={t('farmNameLabel')}
                      placeholder="e.g. Rehman Dairy Farm"
                      value={regFarmName}
                      onChangeText={setRegFarmName}
                    />

                    <AppTextInput
                      label={t('ownerNameLabel')}
                      placeholder="e.g. Haji Muhammad Rehman"
                      value={regOwnerName}
                      onChangeText={setRegOwnerName}
                    />

                    <AppTextInput
                      label={isUrdu ? 'ای میل' : 'Email'}
                      placeholder="name@example.com"
                      value={regEmail}
                      onChangeText={setRegEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      helperText={
                        isUrdu
                          ? 'اس ای میل تے 6 ہندسیاں دا کوڈ بھیجیا جاوے گا'
                          : 'We will email a 6-digit verification code to this address'
                      }
                    />

                    <AppTextInput
                      label={`${t('phoneLabel')} (${isUrdu ? 'اختیاری' : 'Optional'})`}
                      placeholder="e.g. 03001234567"
                      value={regPhone}
                      onChangeText={setRegPhone}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                    />

                    <AppTextInput
                      label={`${t('passwordLabel')} (min 8 chars)`}
                      placeholder="••••••••"
                      value={regPassword}
                      onChangeText={setRegPassword}
                      secureTextEntry
                    />

                    <AppTextInput
                      label={`${t('defaultMilkRateLabel')} (${isUrdu ? 'اختیاری' : 'Optional'})`}
                      placeholder="e.g. 210"
                      value={regMilkRate}
                      onChangeText={setRegMilkRate}
                      keyboardType="numeric"
                    />

                    <View style={{ marginTop: Spacing.sm }}>
                      <AppButton
                        title={loading ? t('syncStatusSyncing') : t('registerBtn')}
                        variant="primary"
                        size="lg"
                        loading={loading}
                        onPress={() => handleRegister()}
                        icon={<Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />}
                      />
                    </View>

                    <Pressable
                      onPress={() => {
                        setAuthMode('signin');
                        setErrorMessage(null);
                      }}
                      style={styles.switchLink}>
                      <ThemedText style={[styles.switchLinkText, { color: theme.primary }]}>
                        {t('switchToSignIn')}
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              </AppCard>

              {/* Local Security & Offline Guarantee */}
              <View
                style={[
                  styles.noteBox,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ]}>
                <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
                <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
                  {t('adminPinCloudNotice')}
                </ThemedText>
              </View>
            </View>
          )}

          {/* Server Connection URL Configuration */}
          <AppCard style={styles.serverCard}>
            <View style={styles.serverCardHeader}>
              <View style={styles.serverCardLeft}>
                <Ionicons name="server-outline" size={18} color={theme.primary} />
                <ThemedText style={styles.serverTitle}>
                  {isUrdu ? 'سرور کنکشن' : 'Backend Server'}
                </ThemedText>
              </View>
              <Pressable
                onPress={() => {
                  setEditingApiUrl(!editingApiUrl);
                  setCustomUrlInput(apiUrl);
                }}>
                <ThemedText style={[styles.serverActionText, { color: theme.primary }]}>
                  {editingApiUrl ? (isUrdu ? 'منسوخ' : 'Cancel') : isUrdu ? 'تبدیل کرو' : 'Change'}
                </ThemedText>
              </Pressable>
            </View>

            {editingApiUrl ? (
              <View style={{ gap: Spacing.sm, marginTop: Spacing.xs }}>
                <AppTextInput
                  label={isUrdu ? 'سرور API پتہ' : 'Server API URL'}
                  value={customUrlInput}
                  onChangeText={setCustomUrlInput}
                  placeholder="e.g. http://192.168.1.50:3000"
                  autoCapitalize="none"
                />
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <AppButton
                    title={isUrdu ? 'محفوظ کرو' : 'Save URL'}
                    variant="primary"
                    size="sm"
                    onPress={handleSaveApiUrl}
                  />
                  <AppButton
                    title={isUrdu ? 'ڈیفالٹ ری سیٹ' : 'Reset Default'}
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
              <ThemedText style={[styles.serverUrlText, { color: theme.textSecondary }]} numberOfLines={1}>
                {apiUrl}
              </ThemedText>
            )}
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: Typography.footnote.fontSize,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    gap: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardTitle: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: Typography.subhead.fontSize,
    marginTop: 2,
  },
  infoList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: Typography.subhead.fontSize,
  },
  infoValue: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
  },
  metricsGrid: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metricItem: {
    flex: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: Typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  noteText: {
    flex: 1,
    fontSize: Typography.footnote.fontSize,
    lineHeight: 18,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 50,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  signOutText: {
    fontSize: Typography.headline.fontSize,
    fontWeight: '700',
  },
  introCard: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
    textAlign: 'center',
  },
  introIconRow: {
    marginBottom: Spacing.xs,
  },
  introTitle: {
    fontSize: Typography.title2.fontSize,
    fontWeight: '700',
    textAlign: 'center',
  },
  introDesc: {
    fontSize: Typography.subhead.fontSize,
    textAlign: 'center',
    lineHeight: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  tabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '500',
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  switchLinkText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
  },
  serverCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  serverCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  serverTitle: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  serverActionText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },
  serverUrlText: {
    fontSize: Typography.caption.fontSize,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
