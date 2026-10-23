import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton, IconBubble, useToast } from '@/components/ui';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { formatCountdown } from '@/utils/pin-security';
import { usePinCountdown } from '@/utils/use-pin-countdown';

interface AdminPinModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'verify' | 'setup';
  onPinConfigured?: (newPin: string) => Promise<void>;
}

export function AdminPinModal({
  visible,
  onClose,
  onSuccess,
  mode = 'verify',
  onPinConfigured,
}: AdminPinModalProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();
  const { verifyPin, setNewPin, pinLockedUntil, pinAttemptsRemaining } = useAdmin();

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showWrongPin, setShowWrongPin] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Lockout only applies when verifying an existing PIN, not when choosing a new one.
  const lockSeconds = usePinCountdown(mode === 'verify' ? pinLockedUntil : 0);
  const isLocked = lockSeconds > 0;
  const lockMessage = isUrdu
    ? `بہت زیادہ غلط کوششیں۔ ${formatCountdown(lockSeconds)} بعد دوبارہ کوشش کریں۔`
    : `Too many wrong attempts. Try again in ${formatCountdown(lockSeconds)}.`;
  const wrongPinMessage = isUrdu
    ? `غلط پن! لاک ہونے سے پہلے ${pinAttemptsRemaining} کوششیں باقی ہیں۔`
    : `Incorrect PIN! ${pinAttemptsRemaining} ${pinAttemptsRemaining === 1 ? 'attempt' : 'attempts'} left before lockout.`;
  const shownMessage = isLocked ? lockMessage : showWrongPin ? wrongPinMessage : errorMessage;

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the keypad each time the modal opens
      setEnteredPin('');
      setErrorMessage('');
      setShowWrongPin(false);
      setIsVerifying(false);
    }
  }, [visible]);

  const handleKeyPress = async (val: string) => {
    if (isLocked || enteredPin.length >= 4) return;
    const next = enteredPin + val;
    setEnteredPin(next);
    setErrorMessage('');
    setShowWrongPin(false);

    if (next.length === 4) {
      setIsVerifying(true);
      try {
        if (mode === 'setup') {
          if (onPinConfigured) {
            await onPinConfigured(next);
          } else {
            await setNewPin(next);
          }
          onClose();
          if (onSuccess) onSuccess();
        } else {
          const isValid = await verifyPin(next);
          if (isValid) {
            onClose();
            if (onSuccess) onSuccess();
          } else {
            setShowWrongPin(true);
            setEnteredPin('');
          }
        }
      } catch {
        const message = isUrdu ? 'پن تصدیق وچ خرابی آئی۔' : 'Error verifying PIN.';
        setErrorMessage(message);
        toast.error(message);
        setEnteredPin('');
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleClose = () => {
    if (isVerifying) return;
    onClose();
  };

  const handleBackspace = () => {
    if (enteredPin.length > 0) {
      setEnteredPin((prev) => prev.slice(0, -1));
      setErrorMessage('');
      setShowWrongPin(false);
    }
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMessage('');
    setShowWrongPin(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header Icon & Title */}
          <View style={styles.headerWrap}>
            <IconBubble icon="wallet" variant="mint" size={50} iconSize={26} />
            <ThemedText style={styles.titleText}>
              {mode === 'setup'
                ? isUrdu
                  ? 'نواں 4-ہندسی ایڈمن پن بناؤ'
                  : 'Set 4-Digit Admin PIN'
                : isUrdu
                  ? 'ایڈمن 4-ہندسی پن درج کرو'
                  : 'Enter 4-Digit Admin PIN'}
            </ThemedText>
            <ThemedText style={[styles.subtitleText, { color: theme.textSecondary }]}>
              {mode === 'setup'
                ? isUrdu
                  ? 'ایہ پن فارم دا ریٹ تے کھاتے تبدیل کرن لئی محفوظ رہے گا۔'
                  : 'This PIN secures farm rates, reports, and accounts.'
                : isUrdu
                  ? 'فارم دا ریٹ تے خفیہ کھاتے دیکھن لئی پن ضروری اے۔'
                  : 'Required to modify standard rate and view profits.'}
            </ThemedText>
          </View>

          {/* 4 Circular PIN Dots */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((index) => {
              const isFilled = index < enteredPin.length;
              return (
                <View
                  key={index}
                  style={[
                    styles.dotCircle,
                    {
                      borderColor: isFilled ? theme.primary : theme.border,
                      backgroundColor: isFilled ? theme.primary : theme.backgroundElement,
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* Error Message */}
          {shownMessage ? (
            <ThemedText style={[styles.errorText, { color: theme.danger }]}>
              {shownMessage}
            </ThemedText>
          ) : (
            <View style={{ height: 20 }} />
          )}

          {/* Keypad Grid (1-9, Backspace, 0, Clear) */}
          <View style={styles.keypadGrid}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
              ['C', '0', '⌫'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((btnKey) => {
                  const isAction = btnKey === 'C' || btnKey === '⌫';
                  return (
                    <Pressable
                      key={btnKey}
                      accessibilityRole="button"
                      accessibilityLabel={`Key ${btnKey}`}
                      disabled={isVerifying || isLocked}
                      onPress={() => {
                        if (btnKey === 'C') handleClear();
                        else if (btnKey === '⌫') handleBackspace();
                        else handleKeyPress(btnKey);
                      }}
                      style={({ pressed }) => [
                        styles.keypadBtn,
                        {
                          backgroundColor: isAction ? theme.backgroundElement : theme.card,
                          borderColor: theme.border,
                        },
                        pressed && styles.pressedKey,
                      ]}>
                      <ThemedText
                        style={[
                          styles.keypadText,
                          { color: isAction ? theme.textSecondary : theme.text },
                        ]}>
                        {btnKey}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Cancel Button */}
          <AppButton
            variant="ghost"
            size="sm"
            title={isUrdu ? 'بند کرو / منسوخ' : 'Cancel'}
            onPress={handleClose}
            disabled={isVerifying}
            style={styles.cancelBtn}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  headerWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  titleText: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  subtitleText: {
    fontSize: Typography.caption.fontSize,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginVertical: Spacing.md,
  },
  dotCircle: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
  },
  errorText: {
    fontSize: Typography.caption.fontSize,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 20,
  },
  keypadGrid: {
    width: '100%',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    justifyContent: 'center',
  },
  keypadBtn: {
    flex: 1,
    height: 54,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pressedKey: {
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  keypadText: {
    fontSize: 22,
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: Spacing.xs,
    width: '100%',
  },
});
