import React, { useState } from 'react';
import {
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
  IconBubble,
  LanguageToggleButton,
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

interface LoginScreenProps {
  onSuccess?: () => void;
  onGoToRegister?: () => void;
}

export function LoginScreen({ onSuccess, onGoToRegister }: LoginScreenProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const {
    farmName,
    ownerName,
    hasPinSet,
    loginAdmin,
    loginWorker,
    setAuthScreen,
  } = useAdmin();

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleKeyPress = async (val: string) => {
    if (enteredPin.length >= 4) return;
    const next = enteredPin + val;
    setEnteredPin(next);
    setErrorMessage('');

    if (next.length === 4) {
      try {
        const success = await loginAdmin(next);
        if (success) {
          if (onSuccess) onSuccess();
        } else {
          setErrorMessage(
            isUrdu
              ? 'غلط پن کوڈ! دوبارہ چیک کر کے ملاؤ۔'
              : 'Incorrect PIN! Please try again.'
          );
          setEnteredPin('');
        }
      } catch {
        setErrorMessage(
          isUrdu ? 'لاگ ان وچ خرابی آئی اے۔' : 'Login failed. Please try again.'
        );
        setEnteredPin('');
      }
    }
  };

  const handleBackspace = () => {
    if (enteredPin.length > 0) {
      setEnteredPin((prev) => prev.slice(0, -1));
      setErrorMessage('');
    }
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMessage('');
  };

  const handleWorkerLogin = () => {
    loginWorker();
    if (onSuccess) onSuccess();
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={styles.topLogoWrap}>
          <IconBubble icon="sprout" variant="mint" size={32} iconSize={16} />
          <ThemedText style={styles.topLogoText}>
            {isUrdu ? 'ڈیری فلو لاگ ان' : 'DairyFlow Login'}
          </ThemedText>
        </View>
        <LanguageToggleButton />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Farm Identity Card */}
        <AppCard style={styles.farmCard}>
          <View style={styles.farmHeaderRow}>
            <IconBubble icon="sprout" variant="mint" size={48} iconSize={24} />
            <View style={{ flexShrink: 1 }}>
              <ThemedText style={styles.farmTitle} numberOfLines={1}>
                {farmName}
              </ThemedText>
              <View style={styles.ownerBadgeRow}>
                <AppIcon name="user" size={13} color={theme.primary} />
                <ThemedText style={[styles.ownerName, { color: theme.primary }]}>
                  {ownerName || (isUrdu ? 'فارم ایڈمن' : 'Farm Admin')}
                </ThemedText>
              </View>
            </View>
          </View>

          <ThemedText style={[styles.loginPrompt, { color: theme.textSecondary }]}>
            {hasPinSet
              ? isUrdu
                ? 'ایڈمن لاگ ان واسطے 4-ہندسی پن کوڈ ملاؤ:'
                : 'Enter your 4-digit Admin PIN to unlock:'
              : isUrdu
                ? 'فارم وچ داخل ہوون واسطے بٹن دباؤ:'
                : 'Tap to enter your farm dashboard:'}
          </ThemedText>

          {/* 4 Dots PIN Display */}
          {hasPinSet && (
            <View style={styles.pinIndicatorWrap}>
              {[0, 1, 2, 3].map((idx) => {
                const filled = enteredPin.length > idx;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.pinDot,
                      {
                        backgroundColor: filled
                          ? theme.primary
                          : theme.backgroundElement,
                        borderColor: filled ? theme.primary : theme.border,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}

          {/* Error Message */}
          {errorMessage ? (
            <View style={[styles.errorBox, { backgroundColor: theme.danger + '14' }]}>
              <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                {errorMessage}
              </ThemedText>
            </View>
          ) : null}

          {/* Numeric Keypad (if PIN is configured) */}
          {hasPinSet ? (
            <View style={styles.keypadContainer}>
              <View style={styles.keypadRow}>
                {['1', '2', '3'].map((num) => (
                  <Pressable
                    key={num}
                    onPress={() => handleKeyPress(num)}
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      pressed && styles.keypadPressed,
                    ]}>
                    <ThemedText style={styles.keypadNum}>{num}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.keypadRow}>
                {['4', '5', '6'].map((num) => (
                  <Pressable
                    key={num}
                    onPress={() => handleKeyPress(num)}
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      pressed && styles.keypadPressed,
                    ]}>
                    <ThemedText style={styles.keypadNum}>{num}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.keypadRow}>
                {['7', '8', '9'].map((num) => (
                  <Pressable
                    key={num}
                    onPress={() => handleKeyPress(num)}
                    style={({ pressed }) => [
                      styles.keypadBtn,
                      { backgroundColor: theme.card, borderColor: theme.border },
                      pressed && styles.keypadPressed,
                    ]}>
                    <ThemedText style={styles.keypadNum}>{num}</ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.keypadRow}>
                <Pressable
                  onPress={handleClear}
                  style={({ pressed }) => [
                    styles.keypadAuxBtn,
                    pressed && styles.keypadPressed,
                  ]}>
                  <ThemedText style={[styles.keypadAuxText, { color: theme.textSecondary }]}>
                    {isUrdu ? 'صاف' : 'Clear'}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => handleKeyPress('0')}
                  style={({ pressed }) => [
                    styles.keypadBtn,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    pressed && styles.keypadPressed,
                  ]}>
                  <ThemedText style={styles.keypadNum}>0</ThemedText>
                </Pressable>

                <Pressable
                  onPress={handleBackspace}
                  style={({ pressed }) => [
                    styles.keypadAuxBtn,
                    pressed && styles.keypadPressed,
                  ]}>
                  <AppIcon name="close" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: Spacing.sm }}>
              <AppButton
                variant="primary"
                size="lg"
                title={isUrdu ? 'فارم ڈیش بورڈ وچ داخل ہوو' : 'Enter Farm Dashboard'}
                icon={<AppIcon name="check" size={18} color="#FFFFFF" />}
                onPress={() => {
                  loginWorker();
                  if (onSuccess) onSuccess();
                }}
              />
            </View>
          )}

          {/* Quick Worker Mode Option */}
          {hasPinSet && (
            <View style={styles.workerModeWrap}>
              <AppButton
                variant="outline"
                size="md"
                title={
                  isUrdu
                    ? 'ورکر موڈ نال چلو (بغیر پن اندراج)'
                    : 'Continue in Worker Mode (No PIN)'
                }
                icon={<AppIcon name="edit" size={16} color={theme.primary} />}
                onPress={handleWorkerLogin}
              />
              <ThemedText style={[styles.workerModeHint, { color: theme.textMuted }]}>
                {isUrdu
                  ? 'ورکر صرف روزانہ دودھ درج کر سکدے نے، سیٹنگز محفوظ رہندیاں نے۔'
                  : 'Workers can log daily milk entries while protecting financial rates.'}
              </ThemedText>
            </View>
          )}

          {/* Register New Farm Switch */}
          <View style={styles.registerSwitchWrap}>
            <Pressable
              onPress={() => {
                if (onGoToRegister) {
                  onGoToRegister();
                } else {
                  setAuthScreen('register');
                }
              }}
              style={({ pressed }) => [styles.regBtn, pressed && styles.keypadPressed]}>
              <ThemedText style={[styles.regBtnText, { color: theme.primary }]}>
                {isUrdu ? '+ نواں ڈیری فارم رجسٹر کرو' : '+ Register a Different Farm'}
              </ThemedText>
            </Pressable>
          </View>
        </AppCard>
      </ScrollView>
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
    justifyContent: 'center',
  },
  farmCard: {
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.md,
    marginTop: Spacing.sm,
  },
  farmHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  farmTitle: {
    fontSize: Typography.title2.fontSize,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ownerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  ownerName: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '700',
  },
  loginPrompt: {
    fontSize: Typography.body.fontSize,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  pinIndicatorWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  errorBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  errorText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  keypadContainer: {
    gap: 10,
    marginTop: Spacing.xs,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  keypadBtn: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    ...Shadows.subtle,
  },
  keypadNum: {
    fontSize: 22,
    fontWeight: '700',
  },
  keypadAuxBtn: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadAuxText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  keypadPressed: {
    opacity: 0.6,
  },
  workerModeWrap: {
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#E3EBE5',
  },
  workerModeHint: {
    fontSize: Typography.caption.fontSize,
    textAlign: 'center',
    lineHeight: 16,
  },
  registerSwitchWrap: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  regBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  regBtnText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
});
