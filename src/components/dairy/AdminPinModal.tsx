import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton, IconBubble } from '@/components/ui';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

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
  const { verifyPin, setNewPin } = useAdmin();

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the keypad each time the modal opens
      setEnteredPin('');
      setErrorMessage('');
      setIsVerifying(false);
    }
  }, [visible]);

  const handleKeyPress = async (val: string) => {
    if (enteredPin.length >= 4) return;
    const next = enteredPin + val;
    setEnteredPin(next);
    setErrorMessage('');

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
            setErrorMessage(isUrdu ? 'غلط پن! دوبارہ کوشش کرو۔' : 'Incorrect PIN! Please try again.');
            setEnteredPin('');
          }
        }
      } catch {
        setErrorMessage(isUrdu ? 'پن تصدیق وچ خرابی آئی۔' : 'Error verifying PIN.');
        setEnteredPin('');
      } finally {
        setIsVerifying(false);
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

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}>
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
          {errorMessage ? (
            <ThemedText style={[styles.errorText, { color: theme.danger }]}>
              {errorMessage}
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
                      disabled={isVerifying}
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
            onPress={onClose}
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
    height: 20,
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
