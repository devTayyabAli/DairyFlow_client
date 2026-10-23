import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHero } from './AuthHero';
import { StatusBarCover } from './StatusBarCover';
import { AppButton, AppIcon } from '@/components/ui';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { formatCountdown } from '@/utils/pin-security';
import { usePinCountdown } from '@/utils/use-pin-countdown';

interface LoginScreenProps {
  onSuccess?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Local PIN quick-lock shown after the account session is restored. */
export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isUrdu } = useLanguage();
  const { hasPinSet, loginAdmin, loginWorker, pinLockedUntil, pinAttemptsRemaining } = useAdmin();
  const { isSignedIn, signOut, pendingCount } = useSync();

  const [enteredPin, setEnteredPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showWrongPin, setShowWrongPin] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const tr = (en: string, ur: string) => (isUrdu ? ur : en);

  const lockSeconds = usePinCountdown(pinLockedUntil);
  const isLocked = lockSeconds > 0;
  const shownMessage = isLocked
    ? tr(
        `Too many wrong attempts. Try again in ${formatCountdown(lockSeconds)}.`,
        `بہت زیادہ غلط کوششیں۔ ${formatCountdown(lockSeconds)} بعد دوبارہ کوشش کریں۔`
      )
    : showWrongPin
      ? tr(
          `Incorrect PIN. ${pinAttemptsRemaining} ${pinAttemptsRemaining === 1 ? 'attempt' : 'attempts'} left before lockout.`,
          `غلط پن کوڈ۔ لاک ہونے سے پہلے ${pinAttemptsRemaining} کوششیں باقی ہیں۔`
        )
      : errorMessage;

  const handleKeyPress = async (val: string) => {
    if (isChecking || isLocked || enteredPin.length >= 4) return;
    const next = enteredPin + val;
    setEnteredPin(next);
    setErrorMessage('');
    setShowWrongPin(false);

    if (next.length === 4) {
      setIsChecking(true);
      try {
        const success = await loginAdmin(next);
        if (success) {
          onSuccess?.();
        } else {
          setShowWrongPin(true);
          setEnteredPin('');
        }
      } catch {
        setErrorMessage(tr('Sign in failed. Please try again.', 'لاگ ان نہیں ہو سکا۔ دوبارہ کوشش کریں۔'));
        setEnteredPin('');
      } finally {
        setIsChecking(false);
      }
    }
  };

  const handleBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMessage('');
    setShowWrongPin(false);
  };

  const handleOpenDashboard = async () => {
    await loginAdmin('');
    onSuccess?.();
  };

  const handleWorkerLogin = () => {
    loginWorker();
    onSuccess?.();
  };

  const confirmSignOut = () => {
    Alert.alert(
      tr('Sign out?', 'سائن آؤٹ کریں؟'),
      pendingCount > 0
        ? tr(
            `${pendingCount} change(s) have not synced yet. They stay on this phone and sync when you sign in again.`,
            `${pendingCount} تبدیلیاں ابھی سنک نہیں ہوئیاں۔ اوہ فون تے رہن گیاں تے دوبارہ لاگ ان تے سنک ہو جان گیاں۔`
          )
        : tr('You will need your email and password to sign in again.', 'دوبارہ لاگ ان لئی ای میل تے پاس ورڈ چاہیدا ہووے گا۔'),
      [
        { text: tr('Cancel', 'منسوخ'), style: 'cancel' },
        { text: tr('Sign out', 'سائن آؤٹ'), style: 'destructive', onPress: () => signOut().catch(() => {}) },
      ]
    );
  };

  const renderKey = (num: string) => (
    <Pressable
      key={num}
      accessibilityRole="button"
      accessibilityLabel={num}
      disabled={isLocked}
      onPress={() => handleKeyPress(num)}
      android_ripple={{ color: theme.backgroundSelected, borderless: true }}
      style={({ pressed }) => [
        styles.key,
        { backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement },
      ]}>
      <Text style={[styles.keyText, { color: theme.text }]}>{num}</Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xxl }}>
        <AuthHero
          title={tr('Welcome back', 'خوش آمدید')}
          subtitle={
            hasPinSet
              ? tr('Enter your 4-digit PIN to sign in', 'لاگ ان کرنے کے لیے اپنا 4 ہندسی پن درج کریں')
              : tr('Sign in to manage your dairy farm', 'اپنے ڈیری فارم کا انتظام کرنے کے لیے لاگ ان کریں')
          }
        />

        <View style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {hasPinSet ? (
            <>
              <View style={styles.sheetHeader}>
                <View style={[styles.lockBadge, { backgroundColor: theme.primaryLight }]}>
                  <AppIcon name="lock" size={18} color={theme.primary} />
                </View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {tr('Admin PIN', 'ایڈمن پن')}
                </Text>
              </View>

              <View style={styles.dotsRow}>
                {[0, 1, 2, 3].map((idx) => {
                  const filled = enteredPin.length > idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: filled ? theme.primary : 'transparent',
                          borderColor: shownMessage ? theme.danger : filled ? theme.primary : theme.inputBorder,
                        },
                      ]}
                    />
                  );
                })}
              </View>

              <Text
                style={[
                  styles.errorText,
                  { color: theme.danger, opacity: shownMessage ? 1 : 0 },
                ]}>
                {shownMessage || ' '}
              </Text>

              <View style={styles.keypad}>
                {[0, 1, 2].map((row) => (
                  <View key={row} style={styles.keyRow}>
                    {KEYS.slice(row * 3, row * 3 + 3).map(renderKey)}
                  </View>
                ))}
                <View style={styles.keyRow}>
                  <View style={styles.keySpacer} />
                  {renderKey('0')}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={tr('Delete', 'مٹائیں')}
                    disabled={isLocked}
                    onPress={handleBackspace}
                    onLongPress={() => setEnteredPin('')}
                    style={({ pressed }) => [styles.keySpacer, styles.keyAux, pressed && styles.pressed]}>
                    <Text style={[styles.auxText, { color: theme.textSecondary }]}>⌫</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: theme.border }]} />

              <AppButton
                variant="outline"
                size="md"
                fullWidth
                title={tr('Continue as Worker', 'ورکر کے طور پر جاری رکھیں')}
                icon={<AppIcon name="user" size={16} color={theme.primary} />}
                onPress={handleWorkerLogin}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {tr(
                  'Workers can record daily milk. Rates and settings stay protected.',
                  'ورکر روزانہ دودھ درج کر سکتے ہیں۔ ریٹ اور سیٹنگز محفوظ رہتی ہیں۔'
                )}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.sheetHeader}>
                <View style={[styles.lockBadge, { backgroundColor: theme.primaryLight }]}>
                  <AppIcon name="home" size={18} color={theme.primary} />
                </View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {tr('Your farm is ready', 'آپ کا فارم تیار ہے')}
                </Text>
              </View>
              <Text style={[styles.body, { color: theme.textSecondary }]}>
                {tr(
                  'For better security, set a 4-digit PIN from More → Farm Profile after signing in.',
                  'بہتر حفاظت کے لیے لاگ ان کے بعد مزید ← فارم پروفائل سے 4 ہندسی پن لگائیں۔'
                )}
              </Text>
              <AppButton
                variant="primary"
                size="lg"
                fullWidth
                title={tr('Sign In', 'لاگ ان کریں')}
                icon={<AppIcon name="chevronRight" size={18} color="#FFFFFF" />}
                iconPosition="right"
                onPress={handleOpenDashboard}
              />
            </>
          )}
        </View>

        {isSignedIn ? (
          <Pressable
            accessibilityRole="button"
            onPress={confirmSignOut}
            style={({ pressed }) => [styles.footerLink, pressed && styles.pressed]}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {tr('Not your farm? ', 'تہاڈا فارم نہیں؟ ')}
              <Text style={{ color: theme.primary, fontWeight: '700' }}>{tr('Sign out', 'سائن آؤٹ')}</Text>
            </Text>
          </Pressable>
        ) : null}

        <Text style={[styles.version, { color: theme.textMuted }]}>DairyFlow · v1.0.0</Text>
      </ScrollView>
      <StatusBarCover />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sheet: {
    marginHorizontal: Spacing.lg,
    marginTop: -32,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
    ...Shadows.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  lockBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: Spacing.sm,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    minHeight: 18,
  },
  keypad: {
    gap: 12,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    flex: 1,
    height: 58,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
  keySpacer: {
    flex: 1,
    height: 58,
  },
  keyAux: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  auxText: {
    fontSize: 22,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
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
  },
});
