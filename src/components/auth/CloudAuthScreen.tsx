import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHero } from './AuthHero';
import { AppButton, AppTextInput } from '@/components/ui';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

type Mode = 'login' | 'register' | 'forgot' | 'otp';
type OtpPurpose = 'register' | 'reset';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CloudAuthScreenProps {
  /** Shown only for phones that already hold a farm from before accounts existed (avoids lock-out). */
  canContinueOffline?: boolean;
  onContinueOffline?: () => void;
}

/**
 * Front door of the app: email + password sign in, registration with an emailed OTP,
 * and password reset. Everything after sign-in works offline; the PIN is a local quick lock.
 */
export function CloudAuthScreen({ canContinueOffline = false, onContinueOffline }: CloudAuthScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isUrdu } = useLanguage();
  const {
    signIn,
    register,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    pendingCount,
  } = useSync();

  const tr = (en: string, ur: string) => (isUrdu ? ur : en);

  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register
  const [farmName, setFarmName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [milkRate, setMilkRate] = useState('220');

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('');

  // OTP step (registration verification or password reset)
  const [otpEmail, setOtpEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<OtpPurpose>('register');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const goTo = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const startOtp = (email: string, purpose: OtpPurpose, resendAfter = 60) => {
    setOtpEmail(email);
    setOtpPurpose(purpose);
    setOtpCode('');
    setNewPassword('');
    setResendIn(resendAfter);
    setMode('otp');
    setError(null);
  };

  // The phone holds another farm's data: confirm before replacing it, then retry with consent.
  const confirmReplace = (retry: () => Promise<void>) => {
    const unsynced = pendingCount > 0;
    Alert.alert(
      tr('Data from another farm', 'ہور فارم دا ڈیٹا'),
      tr(
        `This phone has data from a different farm. Continuing removes it from this phone${
          unsynced ? ` and ${pendingCount} unsynced change(s) will be lost` : ''
        }. Anything already synced stays on that farm's account.`,
        `اس فون وچ کسی ہور فارم دا ڈیٹا اے۔ جاری رکھن نال ایہ فون توں مٹ جاوے گا${
          unsynced ? ` تے ${pendingCount} غیر سنک تبدیلیاں ضائع ہو جان گیاں` : ''
        }۔`
      ),
      [
        { text: tr('Cancel', 'منسوخ'), style: 'cancel' },
        {
          text: tr('Replace data', 'مٹا کے جاری رکھو'),
          style: 'destructive',
          onPress: () => {
            retry().catch(() => {});
          },
        },
      ]
    );
  };

  const run = async (work: () => Promise<void>) => {
    setError(null);
    setLoading(true);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : tr('Network error. Please try again.', 'نیٹ ورک خرابی۔ دوبارہ کوشش کریں۔'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (replaceLocalData = false): Promise<void> =>
    run(async () => {
      const email = loginEmail.trim();
      if (!email || !loginPassword) {
        setError(tr('Enter your email and password.', 'ای میل تے پاس ورڈ درج کرو۔'));
        return;
      }
      if (!EMAIL_RE.test(email)) {
        setError(tr('Enter a valid email address.', 'درست ای میل درج کرو۔'));
        return;
      }
      const res = await signIn(email, loginPassword, { replaceLocalData });
      if (res.needsVerification && res.email) {
        const sent = await resendOtp(res.email);
        startOtp(res.email, 'register', sent.success ? sent.resendAfterSeconds : sent.retryAfterSeconds ?? 60);
      } else if (res.needsConfirmation === 'other-farm') {
        confirmReplace(() => handleLogin(true));
      } else if (!res.success) {
        setError(res.error || tr('Sign in failed.', 'لاگ ان نہیں ہو سکیا۔'));
      }
      // On success the gate swaps this screen out automatically.
    });

  const handleRegister = (): Promise<void> =>
    run(async () => {
      const email = regEmail.trim();
      if (!farmName.trim() || !ownerName.trim() || !email || !regPassword) {
        setError(tr('Please fill in all required fields.', 'تمام ضروری خانے پر کرو۔'));
        return;
      }
      if (!EMAIL_RE.test(email)) {
        setError(tr('Enter a valid email address.', 'درست ای میل درج کرو۔'));
        return;
      }
      if (regPassword.length < 8) {
        setError(tr('Password must be at least 8 characters.', 'پاس ورڈ کم از کم 8 حروف دا ہووے۔'));
        return;
      }
      const rate = parseFloat(milkRate);
      if (milkRate.trim() && (Number.isNaN(rate) || rate <= 0)) {
        setError(tr('Enter a valid milk rate.', 'دودھ دا درست ریٹ درج کرو۔'));
        return;
      }
      const res = await register({
        farmName: farmName.trim(),
        ownerName: ownerName.trim(),
        email,
        password: regPassword,
        phone: regPhone.trim() || undefined,
        defaultMilkRate: milkRate.trim() ? rate : undefined,
      });
      if (res.otpRequired && res.email) startOtp(res.email, 'register', res.resendAfterSeconds ?? 60);
      else setError(res.error || tr('Registration failed.', 'رجسٹریشن نہیں ہو سکی۔'));
    });

  const handleForgot = (): Promise<void> =>
    run(async () => {
      const email = forgotEmail.trim();
      if (!EMAIL_RE.test(email)) {
        setError(tr('Enter a valid email address.', 'درست ای میل درج کرو۔'));
        return;
      }
      const res = await forgotPassword(email);
      if (res.otpRequired && res.email) startOtp(res.email, 'reset', res.resendAfterSeconds ?? 60);
      else {
        if (res.retryAfterSeconds) setResendIn(res.retryAfterSeconds);
        setError(res.error || tr('Could not send the code.', 'کوڈ نہیں بھیجیا جا سکیا۔'));
      }
    });

  const handleVerify = (replaceLocalData = false): Promise<void> =>
    run(async () => {
      const code = otpCode.trim();
      if (!/^\d{6}$/.test(code)) {
        setError(tr('Enter the 6-digit code.', '6 ہندسیاں دا کوڈ درج کرو۔'));
        return;
      }
      const isReset = otpPurpose === 'reset';
      if (isReset && newPassword.length < 8) {
        setError(tr('The new password must be at least 8 characters.', 'نواں پاس ورڈ کم از کم 8 حروف دا ہووے۔'));
        return;
      }
      const res = isReset
        ? await resetPassword(otpEmail, code, newPassword, { replaceLocalData })
        : await verifyOtp(otpEmail, code, { replaceLocalData });
      if (res.success) return; // the gate takes over

      if (res.needsConfirmation === 'other-farm') {
        confirmReplace(() => handleVerify(true));
      } else if (res.code === 'OTP_INVALID') {
        setError(
          res.attemptsLeft !== undefined
            ? tr(`Incorrect code (${res.attemptsLeft} attempts left).`, `کوڈ غلط اے (${res.attemptsLeft} کوششاں باقی)۔`)
            : tr('Incorrect code.', 'کوڈ غلط اے۔')
        );
      } else {
        if (res.code === 'OTP_EXPIRED' || res.code === 'OTP_LOCKED') setResendIn(0);
        setError(res.error || tr('Verification failed.', 'تصدیق نہیں ہو سکی۔'));
      }
    });

  const handleResend = (): Promise<void> =>
    run(async () => {
      if (resendIn > 0) return;
      const res = otpPurpose === 'reset' ? await forgotPassword(otpEmail) : await resendOtp(otpEmail);
      if (res.success) {
        setOtpCode('');
        setResendIn(res.resendAfterSeconds ?? 60);
      } else {
        if (res.retryAfterSeconds) setResendIn(res.retryAfterSeconds);
        setError(res.error || tr('Could not resend the code.', 'کوڈ دوبارہ نہیں بھیجیا جا سکیا۔'));
      }
    });

  const heroTitle =
    mode === 'register'
      ? tr('Create your farm account', 'اپنا فارم اکاؤنٹ بنائیں')
      : mode === 'forgot'
        ? tr('Reset your password', 'پاس ورڈ ری سیٹ کریں')
        : mode === 'otp'
          ? otpPurpose === 'reset'
            ? tr('Check your email', 'اپنی ای میل چیک کریں')
            : tr('Verify your email', 'ای میل کی تصدیق کریں')
          : tr('Welcome back', 'خوش آمدید');

  const heroSubtitle =
    mode === 'register'
      ? tr('Your records are backed up and available on any phone.', 'آپ کا ریکارڈ محفوظ رہے گا اور کسی بھی فون پر مل جائے گا۔')
      : mode === 'forgot'
        ? tr('We will email you a code to set a new password.', 'نواں پاس ورڈ بنان لئی اسیں تہانوں کوڈ بھیجاں گے۔')
        : mode === 'otp'
          ? otpPurpose === 'reset'
            ? tr('Enter the code and choose a new password.', 'کوڈ درج کرو تے نواں پاس ورڈ چنو۔')
            : tr('One last step to secure your account.', 'اکاؤنٹ محفوظ کرن دا آخری قدم۔')
          : tr('Sign in with your email and password.', 'اپنی ای میل اور پاس ورڈ سے لاگ ان کریں۔');

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}>
          <AuthHero title={heroTitle} subtitle={heroSubtitle} compact={mode === 'register'} />

          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {error ? (
              <View
                accessibilityRole="alert"
                style={[styles.banner, { backgroundColor: theme.dangerBg, borderColor: theme.danger + '40' }]}>
                <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
                <Text style={[styles.bannerText, { color: theme.danger }]}>{error}</Text>
              </View>
            ) : null}

            {mode === 'login' && (
              <>
                <AppTextInput
                  label={tr('Email', 'ای میل')}
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
                  label={tr('Password', 'پاس ورڈ')}
                  placeholder="••••••••"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setForgotEmail(loginEmail);
                    goTo('forgot');
                  }}
                  style={styles.linkEnd}>
                  <Text style={[styles.linkText, { color: theme.primary }]}>
                    {tr('Forgot password?', 'پاس ورڈ بھل گئے؟')}
                  </Text>
                </Pressable>
                <AppButton
                  title={tr('Sign in', 'لاگ ان کریں')}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  onPress={() => handleLogin()}
                />
              </>
            )}

            {mode === 'register' && (
              <>
                <AppTextInput
                  label={tr('Farm name', 'فارم کا نام')}
                  required
                  placeholder={tr('e.g. Green Valley Dairy', 'مثلاً گرین ویلی ڈیری')}
                  value={farmName}
                  onChangeText={setFarmName}
                />
                <AppTextInput
                  label={tr('Owner name', 'مالک کا نام')}
                  required
                  placeholder={tr('Your full name', 'آپ کا پورا نام')}
                  value={ownerName}
                  onChangeText={setOwnerName}
                />
                <AppTextInput
                  label={tr('Email', 'ای میل')}
                  required
                  placeholder="name@example.com"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  helperText={tr('We will email a 6-digit code to verify it.', 'تصدیق لئی اس تے 6 ہندسیاں دا کوڈ بھیجیا جاوے گا۔')}
                />
                <AppTextInput
                  label={tr('Password (min 8 characters)', 'پاس ورڈ (کم از کم 8 حروف)')}
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChangeText={setRegPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <AppTextInput
                  label={`${tr('Mobile number', 'موبائل نمبر')} (${tr('optional', 'اختیاری')})`}
                  placeholder="03XX-XXXXXXX"
                  value={regPhone}
                  onChangeText={setRegPhone}
                  keyboardType="phone-pad"
                />
                <AppTextInput
                  label={tr('Default milk rate per liter', 'فی لیٹر بنیادی ریٹ')}
                  placeholder="220"
                  value={milkRate}
                  onChangeText={setMilkRate}
                  keyboardType="decimal-pad"
                  unitSuffix={tr('Rs / L', 'روپے / L')}
                />
                <AppButton
                  title={tr('Create account', 'اکاؤنٹ بنائیں')}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  onPress={() => handleRegister()}
                />
              </>
            )}

            {mode === 'forgot' && (
              <>
                <Text style={[styles.body, { color: theme.textSecondary }]}>
                  {tr(
                    'Enter your account email. We will send a code to reset your password.',
                    'اپنی ای میل لکھو۔ اسیں پاس ورڈ ری سیٹ لئی کوڈ بھیجاں گے۔'
                  )}
                </Text>
                <AppTextInput
                  label={tr('Email', 'ای میل')}
                  placeholder="name@example.com"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                />
                <AppButton
                  title={tr('Send reset code', 'کوڈ بھیجو')}
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  onPress={() => handleForgot()}
                />
              </>
            )}

            {mode === 'otp' && (
              <>
                <Text style={[styles.body, { color: theme.textSecondary }]}>
                  {otpPurpose === 'reset'
                    ? tr(
                        `If an account exists for ${otpEmail}, we sent a 6-digit code. Enter it with your new password.`,
                        `جے ${otpEmail} دا اکاؤنٹ ہووے تے 6 ہندسیاں دا کوڈ بھیجیا گیا اے۔ نویں پاس ورڈ نال درج کرو۔`
                      )
                    : tr(
                        `We sent a 6-digit code to ${otpEmail}. Enter it below to finish.`,
                        `اسیں 6 ہندسیاں دا کوڈ ${otpEmail} تے بھیجیا اے۔`
                      )}
                </Text>
                <AppTextInput
                  label={tr('Verification code', 'تصدیقی کوڈ')}
                  placeholder="123456"
                  value={otpCode}
                  onChangeText={(text) => setOtpCode(text.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  inputStyle={styles.otpInput}
                />
                {otpPurpose === 'reset' && (
                  <AppTextInput
                    label={tr('New password (min 8 characters)', 'نواں پاس ورڈ (کم از کم 8 حروف)')}
                    placeholder="••••••••"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoComplete="new-password"
                    textContentType="newPassword"
                  />
                )}
                <AppButton
                  title={
                    otpPurpose === 'reset'
                      ? tr('Set new password', 'پاس ورڈ بدلو')
                      : tr('Verify & continue', 'تصدیق کرو')
                  }
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={loading}
                  onPress={() => handleVerify()}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={resendIn > 0 || loading}
                  onPress={() => handleResend()}
                  style={[styles.linkCenter, (resendIn > 0 || loading) && styles.dimmed]}>
                  <Text style={[styles.linkText, { color: theme.primary }]}>
                    {resendIn > 0
                      ? tr(`Resend code in ${resendIn}s`, `کوڈ دوبارہ بھیجو (${resendIn}s)`)
                      : tr('Resend code', 'کوڈ دوبارہ بھیجو')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Mode switching */}
          <View style={styles.footer}>
            {mode === 'login' && (
              <Pressable accessibilityRole="button" onPress={() => goTo('register')} style={styles.footerLink}>
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                  {tr('New to DairyFlow? ', 'ڈیری فلو تے نوان او؟ ')}
                  <Text style={{ color: theme.primary, fontWeight: '700' }}>{tr('Create account', 'اکاؤنٹ بنائیں')}</Text>
                </Text>
              </Pressable>
            )}
            {(mode === 'register' || mode === 'forgot' || mode === 'otp') && (
              <Pressable accessibilityRole="button" onPress={() => goTo('login')} style={styles.footerLink}>
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                  {mode === 'otp'
                    ? tr('Back / change email', 'واپس / ای میل بدلو')
                    : tr('Already have an account? ', 'پہلے توں اکاؤنٹ اے؟ ')}
                  {mode !== 'otp' && (
                    <Text style={{ color: theme.primary, fontWeight: '700' }}>{tr('Sign in', 'لاگ ان کریں')}</Text>
                  )}
                </Text>
              </Pressable>
            )}

            {canContinueOffline && mode === 'login' && (
              <Pressable accessibilityRole="button" onPress={onContinueOffline} style={styles.footerLink}>
                <Text style={[styles.footerText, { color: theme.textMuted }]}>
                  {tr('No internet? Continue offline for now', 'انٹرنیٹ نہیں؟ ہن آف لائن جاری رکھو')}
                </Text>
              </Pressable>
            )}
          </View>

          <Text style={[styles.version, { color: theme.textMuted }]}>DairyFlow · v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    marginHorizontal: Spacing.lg,
    marginTop: -32,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21 },
  otpInput: { letterSpacing: 8, fontSize: 22, textAlign: 'center' },
  linkEnd: { alignSelf: 'flex-end', paddingVertical: 4, minHeight: 32, justifyContent: 'center' },
  linkCenter: { alignSelf: 'center', paddingVertical: Spacing.sm, minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '700' },
  dimmed: { opacity: 0.5 },
  footer: { alignItems: 'center', marginTop: Spacing.md },
  footerLink: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, minHeight: 44, justifyContent: 'center' },
  footerText: { fontSize: 14, textAlign: 'center' },
  version: { textAlign: 'center', fontSize: 11, letterSpacing: 0.3, marginTop: Spacing.sm },
});
