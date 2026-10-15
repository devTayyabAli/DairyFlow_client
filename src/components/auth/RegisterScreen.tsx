import React, { useState } from 'react';
import { router } from 'expo-router';
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

import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  IconBubble,
  LanguageToggleButton,
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

interface RegisterScreenProps {
  onSuccess?: () => void;
  onGoToLogin?: () => void;
}

export function RegisterScreen({ onSuccess, onGoToLogin }: RegisterScreenProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { registerFarm, setAuthScreen, skipRegistration } = useAdmin();

  // Form Fields
  const [farmName, setFarmName] = useState<string>('');
  const [ownerName, setOwnerName] = useState<string>('');
  const [ownerPhone, setOwnerPhone] = useState<string>('');
  const [defaultRate, setDefaultRate] = useState<string>('220');
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!farmName.trim()) {
      errs.farmName = isUrdu ? 'فارم دا ناں لکھنا ضروری اے۔' : 'Farm name is required.';
    }

    if (pin.trim() && pin.trim().length !== 4) {
      errs.pin = isUrdu ? 'پن ٹھیک 4 ہندسیاں دا ہونا چاہیدا اے۔' : 'PIN must be exactly 4 digits.';
    }

    if (pin.trim() && pin.trim() !== confirmPin.trim()) {
      errs.confirmPin = isUrdu ? 'دونوں پن آپس وچ نہیں مل رہے۔' : 'PINs do not match.';
    }

    const rateNum = parseFloat(defaultRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      errs.rate = isUrdu ? 'درست دودھ دا ریٹ درج کرو۔' : 'Enter a valid milk rate.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await registerFarm({
        farmName: farmName.trim(),
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        defaultMilkRate: defaultRate.trim() || '220',
        pin: pin.trim(),
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch {
      Alert.alert(
        isUrdu ? 'رجسٹریشن خرابی' : 'Registration Error',
        isUrdu ? 'فارم رجسٹر کرن وچ مسئلہ آیا، دوبارہ کوشش کرو۔' : 'Failed to register farm. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipDemo = async () => {
    try {
      setIsSubmitting(true);
      await skipRegistration();
      if (onSuccess) onSuccess();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <View style={styles.topLogoWrap}>
            <IconBubble icon="sprout" variant="mint" size={32} iconSize={16} />
            <ThemedText style={styles.topLogoText}>
              {isUrdu ? 'ڈیری فلو' : 'DairyFlow'}
            </ThemedText>
          </View>
          <LanguageToggleButton />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {/* Hero Welcome Card */}
          <View style={styles.heroSection}>
            <View style={[styles.badgeWrap, { backgroundColor: theme.primary + '14' }]}>
              <ThemedText style={[styles.badgeText, { color: theme.primary }]}>
                {isUrdu ? '✨ نواں فارم سیٹ اپ' : '✨ New Farm Setup'}
              </ThemedText>
            </View>
            <ThemedText style={styles.heroTitle}>
              {isUrdu ? 'اپنا ڈیری فارم رجسٹر کرو' : 'Register Your Dairy Farm'}
            </ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              {isUrdu
                ? 'فارم دا ناں، بنیادی ریٹ تے پن بناؤ تا کہ ڈیٹا محفوظ رہوے۔'
                : 'Enter your farm details, milk rate and PIN to secure your records.'}
            </ThemedText>
          </View>

          {/* Form Card */}
          <AppCard style={styles.formCard}>
            {/* 1. Farm Details */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.groupHeader}>
                {isUrdu ? '1. فارم دی معلومات' : '1. Farm Profile'}
              </ThemedText>

              <AppTextInput
                label={isUrdu ? 'فارم دا ناں *' : 'Farm Name *'}
                placeholder={isUrdu ? 'مثلاً الرحمان ڈیری فارم، علی کیٹل' : 'e.g. Rehman Dairy Farm'}
                value={farmName}
                onChangeText={(val) => {
                  setFarmName(val);
                  if (errors.farmName) setErrors((prev) => ({ ...prev, farmName: '' }));
                }}
                error={errors.farmName}
                leftIcon={<AppIcon name="home" size={18} color={theme.textMuted} />}
              />

              <AppTextInput
                label={isUrdu ? 'مالک / ایڈمن دا ناں' : 'Owner / Admin Name'}
                placeholder={isUrdu ? 'مثلاً چوہدری صاحب' : 'e.g. Farm Admin'}
                value={ownerName}
                onChangeText={setOwnerName}
                leftIcon={<AppIcon name="user" size={18} color={theme.textMuted} />}
              />

              <AppTextInput
                label={isUrdu ? 'موبائل فون نمبر' : 'Mobile Phone Number'}
                placeholder={isUrdu ? '0300-1234567' : '0300-1234567'}
                value={ownerPhone}
                onChangeText={setOwnerPhone}
                keyboardType="phone-pad"
                leftIcon={<AppIcon name="phone" size={18} color={theme.textMuted} />}
              />
            </View>

            {/* 2. Milk Rate */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.groupHeader}>
                {isUrdu ? '2. دودھ دا ریٹ' : '2. Standard Milk Rate'}
              </ThemedText>

              <AppTextInput
                label={isUrdu ? 'دودھ دا بنیادی ریٹ (روپے/لیٹر) *' : 'Default Milk Rate (PKR / Liter) *'}
                placeholder="220"
                value={defaultRate}
                onChangeText={(val) => {
                  setDefaultRate(val);
                  if (errors.rate) setErrors((prev) => ({ ...prev, rate: '' }));
                }}
                keyboardType="decimal-pad"
                error={errors.rate}
                unitSuffix={isUrdu ? 'روپے / L' : 'Rs / L'}
                leftIcon={<AppIcon name="milk" size={18} color={theme.textMuted} />}
              />
              <ThemedText style={[styles.inputHint, { color: theme.textMuted }]}>
                {isUrdu
                  ? 'ایہ ریٹ ہر نوی چوئی وچ خود بخود لگ جائے گا۔'
                  : 'This rate will automatically prefill when recording daily milk.'}
              </ThemedText>
            </View>

            {/* 3. Admin Security PIN */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.groupHeader}>
                {isUrdu ? '3. ایڈمن پن کوڈ (خفیہ لاگ ان)' : '3. 4-Digit Admin PIN (Security)'}
              </ThemedText>

              <AppTextInput
                label={isUrdu ? '4-ہندسی ایڈمن پن (اختیاری)' : '4-Digit Admin PIN (Optional)'}
                placeholder="****"
                value={pin}
                onChangeText={(val) => {
                  const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
                  setPin(cleaned);
                  if (errors.pin) setErrors((prev) => ({ ...prev, pin: '' }));
                }}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                error={errors.pin}
                leftIcon={<AppIcon name="wallet" size={18} color={theme.textMuted} />}
              />

              {pin.length > 0 && (
                <AppTextInput
                  label={isUrdu ? 'پن دی دوبارہ تصدیق *' : 'Confirm 4-Digit PIN *'}
                  placeholder="****"
                  value={confirmPin}
                  onChangeText={(val) => {
                    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 4);
                    setConfirmPin(cleaned);
                    if (errors.confirmPin) setErrors((prev) => ({ ...prev, confirmPin: '' }));
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  error={errors.confirmPin}
                  leftIcon={<AppIcon name="check" size={18} color={theme.textMuted} />}
                />
              )}

              <ThemedText style={[styles.inputHint, { color: theme.textMuted }]}>
                {isUrdu
                  ? 'پن لاؤ تاکہ کوئی ورکر دودھ دا ریٹ یا فارم دی سیٹنگز نہ بدل سکے۔'
                  : 'Protects milk rates and farm settings from unauthorized worker changes.'}
              </ThemedText>
            </View>

            {/* Submit Button */}
            <View style={{ marginTop: Spacing.sm }}>
              <AppButton
                variant="primary"
                size="lg"
                title={isUrdu ? 'فارم رجسٹر کرو تے داخل ہوو' : 'Register Farm & Get Started'}
                loading={isSubmitting}
                icon={<AppIcon name="check" size={18} color="#FFFFFF" />}
                onPress={handleRegister}
              />
            </View>

            {/* Switch to Login / Skip */}
            <View style={styles.alternateActions}>
              <Pressable
                onPress={() => {
                  if (onGoToLogin) {
                    onGoToLogin();
                  } else {
                    setAuthScreen('login');
                  }
                }}
                style={({ pressed }) => [styles.altBtn, pressed && styles.pressed]}>
                <ThemedText style={[styles.altBtnText, { color: theme.primary }]}>
                  {isUrdu ? 'پہلے توں فارم بنیا ہویا اے؟ لاگ ان کرو' : 'Already have a farm? Login here'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={() => router.push('/more/cloud-sync' as never)}
                style={({ pressed }) => [styles.cloudRestoreBtn, { borderColor: theme.border }, pressed && styles.pressed]}>
                <AppIcon name="sync" size={16} color={theme.primary} />
                <ThemedText style={[styles.cloudRestoreText, { color: theme.primary }]}>
                  {isUrdu ? 'کلاؤڈ اکاؤنٹ نال لاگ ان / بحال کرو' : 'Sign In with Cloud Account (Restore)'}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleSkipDemo}
                style={({ pressed }) => [styles.altBtn, pressed && styles.pressed]}>
                <ThemedText style={[styles.demoLinkText, { color: theme.textSecondary }]}>
                  {isUrdu ? 'یا ڈیمو فارم (الرحمان ڈیری) نال اگے چلو ➔' : 'Or explore with Sample Farm ➔'}
                </ThemedText>
              </Pressable>
            </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  topLogoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  topLogoText: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  heroSection: {
    alignItems: 'center',
    textAlign: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.xs,
  },
  badgeWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroTitle: {
    fontSize: Typography.title1.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: Typography.subhead.fontSize,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  formCard: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    ...Shadows.md,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  groupHeader: {
    fontSize: Typography.body.fontSize,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 2,
  },
  inputHint: {
    fontSize: Typography.caption.fontSize,
    marginTop: -2,
    lineHeight: 16,
  },
  alternateActions: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  altBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  altBtnText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  cloudRestoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginVertical: 2,
  },
  cloudRestoreText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  demoLinkText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
