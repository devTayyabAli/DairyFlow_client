import React, { useState } from 'react';
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
import { AppButton, AppIcon, AppTextInput } from '@/components/ui';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

interface RegisterScreenProps {
  onSuccess?: () => void;
  onGoToLogin?: () => void;
}

export function RegisterScreen({ onSuccess, onGoToLogin }: RegisterScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isUrdu } = useLanguage();
  const { registerFarm, setAuthScreen, isRegistered } = useAdmin();

  const tr = (en: string, ur: string) => (isUrdu ? ur : en);

  // Form fields
  const [farmName, setFarmName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [defaultRate, setDefaultRate] = useState('220');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => {
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!farmName.trim()) {
      errs.farmName = tr('Farm name is required.', 'فارم کا نام لازمی ہے۔');
    }
    if (pin.trim().length !== 4) {
      errs.pin = tr('Create a 4-digit PIN.', '4 ہندسی پن بنائیں۔');
    } else if (pin.trim() !== confirmPin.trim()) {
      errs.confirmPin = tr('PINs do not match.', 'دونوں پن ایک جیسے نہیں ہیں۔');
    }
    const rateNum = parseFloat(defaultRate);
    if (isNaN(rateNum) || rateNum <= 0) {
      errs.rate = tr('Enter a valid milk rate.', 'درست ریٹ درج کریں۔');
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
      onSuccess?.();
    } catch {
      Alert.alert(
        tr('Setup failed', 'سیٹ اپ نہیں ہو سکا'),
        tr('Could not create your farm. Please try again.', 'فارم نہیں بن سکا۔ دوبارہ کوشش کریں۔')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    if (onGoToLogin) onGoToLogin();
    else setAuthScreen('login');
  };

  const SectionLabel = ({ step, title }: { step: string; title: string }) => (
    <View style={styles.sectionLabel}>
      <View style={[styles.stepBadge, { backgroundColor: theme.primaryLight }]}>
        <Text style={[styles.stepText, { color: theme.primaryDark }]}>{step}</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}>
          <AuthHero
            compact
            title={tr('Set up your farm', 'اپنا فارم سیٹ اپ کریں')}
            subtitle={tr(
              'It takes less than a minute. Your data stays on this device.',
              'صرف ایک منٹ لگے گا۔ آپ کا ڈیٹا اسی فون پر محفوظ رہے گا۔'
            )}
          />

          <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Farm details */}
            <View style={styles.group}>
              <SectionLabel step="1" title={tr('Farm details', 'فارم کی تفصیل')} />
              <AppTextInput
                label={tr('Farm name', 'فارم کا نام')}
                required
                placeholder={tr('e.g. Green Valley Dairy', 'مثلاً گرین ویلی ڈیری')}
                value={farmName}
                onChangeText={(val) => {
                  setFarmName(val);
                  clearError('farmName');
                }}
                error={errors.farmName}
                leftIcon={<AppIcon name="home" size={18} color={theme.textMuted} />}
              />
              <AppTextInput
                label={tr('Owner name', 'مالک کا نام')}
                placeholder={tr('Your full name', 'آپ کا پورا نام')}
                value={ownerName}
                onChangeText={setOwnerName}
                leftIcon={<AppIcon name="user" size={18} color={theme.textMuted} />}
              />
              <AppTextInput
                label={tr('Mobile number', 'موبائل نمبر')}
                placeholder="03XX-XXXXXXX"
                value={ownerPhone}
                onChangeText={setOwnerPhone}
                keyboardType="phone-pad"
                leftIcon={<AppIcon name="phone" size={18} color={theme.textMuted} />}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Milk rate */}
            <View style={styles.group}>
              <SectionLabel step="2" title={tr('Milk rate', 'دودھ کا ریٹ')} />
              <AppTextInput
                label={tr('Default rate per liter', 'فی لیٹر بنیادی ریٹ')}
                required
                placeholder="220"
                value={defaultRate}
                onChangeText={(val) => {
                  setDefaultRate(val);
                  clearError('rate');
                }}
                keyboardType="decimal-pad"
                error={errors.rate}
                unitSuffix={tr('Rs / L', 'روپے / L')}
                helperText={tr(
                  'Pre-filled on every new milk entry. You can change it anytime.',
                  'ہر نئے اندراج میں خود بخود لگے گا۔ بعد میں بدل سکتے ہیں۔'
                )}
                leftIcon={<AppIcon name="milk" size={18} color={theme.textMuted} />}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Security */}
            <View style={styles.group}>
              <SectionLabel step="3" title={tr('Secure your app', 'ایپ کو محفوظ کریں')} />
              <View style={styles.pinRow}>
                <AppTextInput
                  containerStyle={styles.pinField}
                  label={tr('4-digit PIN', '4 ہندسی پن')}
                  required
                  placeholder="••••"
                  value={pin}
                  onChangeText={(val) => {
                    setPin(val.replace(/[^0-9]/g, '').slice(0, 4));
                    clearError('pin');
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  error={errors.pin}
                  leftIcon={<AppIcon name="lock" size={18} color={theme.textMuted} />}
                />
                <AppTextInput
                  containerStyle={styles.pinField}
                  label={tr('Confirm PIN', 'پن دوبارہ')}
                  required
                  placeholder="••••"
                  value={confirmPin}
                  onChangeText={(val) => {
                    setConfirmPin(val.replace(/[^0-9]/g, '').slice(0, 4));
                    clearError('confirmPin');
                  }}
                  keyboardType="number-pad"
                  maxLength={4}
                  secureTextEntry
                  error={errors.confirmPin}
                  leftIcon={<AppIcon name="check" size={18} color={theme.textMuted} />}
                />
              </View>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {tr(
                  'You will use this PIN to sign in. Workers can still record milk without it.',
                  'لاگ ان کے لیے یہی پن استعمال ہوگا۔ ورکر اس کے بغیر بھی دودھ درج کر سکتے ہیں۔'
                )}
              </Text>
            </View>

            <AppButton
              variant="primary"
              size="lg"
              fullWidth
              title={tr('Create Farm', 'فارم بنائیں')}
              loading={isSubmitting}
              icon={<AppIcon name="chevronRight" size={18} color="#FFFFFF" />}
              iconPosition="right"
              onPress={handleRegister}
              style={styles.submit}
            />
          </View>

          {isRegistered ? (
            <Pressable onPress={goToLogin} style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}>
              <Text style={[styles.footerText, { color: theme.textSecondary }]}>
                {tr('Already set up? ', 'پہلے سے فارم موجود ہے؟ ')}
                <Text style={{ color: theme.primary, fontWeight: '700' }}>{tr('Sign in', 'لاگ ان کریں')}</Text>
              </Text>
            </Pressable>
          ) : null}

          <Text style={[styles.version, { color: theme.textMuted }]}>DairyFlow · v1.0.0</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheet: {
    marginHorizontal: Spacing.lg,
    marginTop: -28,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadows.md,
  },
  group: {
    gap: Spacing.md,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  pinRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pinField: {
    flex: 1,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
  },
  submit: {
    marginTop: Spacing.xs,
  },
  footerLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  footerText: {
    fontSize: 14,
  },
  version: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 0.3,
    marginTop: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
});
