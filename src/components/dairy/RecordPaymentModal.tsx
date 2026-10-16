import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppIcon,
  AppTextInput,
  FilterChip,
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { Buyer, NewBuyerPayment } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface RecordPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (payment: NewBuyerPayment) => Promise<void>;
  preselectedBuyerId?: number;
  buyers?: Buyer[];
  outstandingBalance?: number;
}

const PAYMENT_METHODS = ['Cash', 'Bank transfer', 'JazzCash', 'Easypaisa'];
const METHOD_LABELS_UR: Record<string, string> = {
  Cash: 'نقد',
  'Bank transfer': 'بینک ٹرانسفر',
  JazzCash: 'جیز کیش',
  Easypaisa: 'ایزی پیسہ',
};
const QUICK_AMOUNTS = [5000, 10000, 20000, 25000];
const todayYMD = () => new Date().toISOString().split('T')[0];

export function RecordPaymentModal({
  visible,
  onClose,
  onSave,
  preselectedBuyerId,
  buyers = [],
  outstandingBalance,
}: RecordPaymentModalProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const activeBuyerId = preselectedBuyerId ?? (selectedBuyerId ?? (buyers.length > 0 ? buyers[0].id : 0));

  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [receivedBy, setReceivedBy] = useState('');
  const [date, setDate] = useState(todayYMD());
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setSelectedBuyerId(null);
    setAmount('');
    setPaymentMethod('Cash');
    setReceivedBy('');
    setDate(todayYMD());
    setNotes('');
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleQuickAmount = useCallback((val: number) => {
    setAmount(String(val));
  }, []);

  const handleSubmit = async () => {
    if (!activeBuyerId) {
      setError('Please select a buyer.');
      return;
    }

    const numericAmount = parseFloat(amount.trim());
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setError('Please enter a valid payment amount greater than 0.');
      return;
    }

    if (!date.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError('Please enter a valid date in YYYY-MM-DD format.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        buyer_id: activeBuyerId,
        amount: Math.round(numericAmount),
        date: date.trim(),
        payment_method: paymentMethod,
        received_by: receivedBy.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const currentBuyer = buyers.find((b) => b.id === activeBuyerId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={styles.headerTitleWrap}>
              <View style={[styles.headerIconBg, { backgroundColor: theme.successBg }]}>
                <AppIcon name="wallet" size={20} color={theme.success} />
              </View>
              <View>
                <ThemedText style={[styles.title, { color: theme.text }]}>
                  {isUrdu ? 'ادائیگی درج کریں' : 'Record payment'}
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
                  {currentBuyer
                    ? currentBuyer.name
                    : isUrdu
                      ? 'نقد، ٹرانسفر یا موبائل منی'
                      : 'Log cash, transfer or mobile money'}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
              <AppIcon name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Form Body */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Error Message */}
            {error && (
              <View style={[styles.errorBox, { backgroundColor: theme.dangerBg }]}>
                <AppIcon name="alert" size={16} color={theme.danger} />
                <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                  {error}
                </ThemedText>
              </View>
            )}

            {/* Buyer Selector (if not preselected) */}
            {!preselectedBuyerId && buyers.length > 1 && (
              <View style={styles.section}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  {isUrdu ? 'گاہک منتخب کریں *' : 'Select buyer *'}
                </ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {buyers.map((b) => (
                    <FilterChip
                      key={b.id}
                      label={b.name}
                      selected={activeBuyerId === b.id}
                      onPress={() => setSelectedBuyerId(b.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Outstanding Balance Banner if known */}
            {outstandingBalance !== undefined && outstandingBalance > 0 && (
              <View style={[styles.balanceCard, { backgroundColor: theme.cardMint, borderColor: theme.cardMintBorder }]}>
                <View>
                  <ThemedText style={[styles.balanceLabel, { color: theme.cardMintText }]}>
                    {isUrdu ? 'موجودہ بقایا' : 'Current balance due'}
                  </ThemedText>
                  <ThemedText style={[styles.balanceValue, { color: theme.cardDark }]}>
                    Rs {outstandingBalance.toLocaleString()}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => handleQuickAmount(outstandingBalance)}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[styles.fullPayBadge, { backgroundColor: theme.card }]}>
                  <ThemedText style={[styles.fullPayText, { color: theme.primary }]}>
                    {isUrdu ? 'پوری ادائیگی' : 'Pay full'}
                  </ThemedText>
                </Pressable>
              </View>
            )}

            {/* Payment Amount */}
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                {isUrdu ? 'وصول شدہ رقم (روپے) *' : 'Amount received (Rs) *'}
              </ThemedText>
              <AppTextInput
                placeholder="e.g. 25000"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                leftIcon={<AppIcon name="cash" size={18} color={theme.textMuted} />}
              />

              {/* Quick amount suggestion chips */}
              <View style={styles.quickChipsWrap}>
                {QUICK_AMOUNTS.map((val) => (
                  <Pressable
                    key={val}
                    accessibilityRole="button"
                    accessibilityState={{ selected: amount === String(val) }}
                    onPress={() => handleQuickAmount(val)}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: amount === String(val) ? theme.primary : theme.backgroundElement,
                        borderColor: amount === String(val) ? theme.primary : theme.border,
                      },
                    ]}>
                    <ThemedText
                      style={[
                        styles.quickChipText,
                        { color: amount === String(val) ? theme.textInverse : theme.textSecondary },
                      ]}>
                      Rs {val.toLocaleString()}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                {isUrdu ? 'ادائیگی کا طریقہ' : 'Payment method'}
              </ThemedText>
              <View style={styles.methodsGrid}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = paymentMethod === method;
                  let iconName: 'cash' | 'wallet' = 'cash';
                  if (method === 'Bank transfer') iconName = 'wallet';

                  return (
                    <Pressable
                      key={method}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setPaymentMethod(method)}
                      style={[
                        styles.methodCard,
                        {
                          backgroundColor: isSelected ? theme.backgroundSelected : theme.backgroundElement,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}>
                      <AppIcon
                        name={iconName}
                        size={16}
                        color={isSelected ? theme.primary : theme.textSecondary}
                      />
                      <ThemedText
                        style={[
                          styles.methodText,
                          {
                            color: isSelected ? theme.primary : theme.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}>
                        {isUrdu ? (METHOD_LABELS_UR[method] ?? method) : method}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Payment Date & Receiver */}
            <View style={styles.row}>
              <View style={styles.col}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  {isUrdu ? 'تاریخ *' : 'Payment date *'}
                </ThemedText>
                <AppTextInput
                  placeholder="YYYY-MM-DD"
                  value={date}
                  onChangeText={setDate}
                  leftIcon={<AppIcon name="calendar" size={16} color={theme.textMuted} />}
                />
              </View>
              <View style={styles.col}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  {isUrdu ? 'وصول کنندہ / حوالہ' : 'Received by / ref'}
                </ThemedText>
                <AppTextInput
                  placeholder="e.g. Usman / HBL"
                  value={receivedBy}
                  onChangeText={setReceivedBy}
                  leftIcon={<AppIcon name="user" size={16} color={theme.textMuted} />}
                />
              </View>
            </View>

            {/* Optional Notes */}
            <View style={styles.section}>
              <ThemedText style={[styles.label, { color: theme.text }]}>
                {isUrdu ? 'نوٹس (اختیاری)' : 'Notes (optional)'}
              </ThemedText>
              <AppTextInput
                placeholder="e.g. Cleared via online transfer, cheque #, or receipt #..."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footer, { borderTopColor: theme.border }]}>
            <AppButton
              variant="secondary"
              title={isUrdu ? 'منسوخ' : 'Cancel'}
              onPress={handleClose}
              style={styles.cancelBtn}
            />
            <AppButton
              variant="primary"
              title={saving ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : isUrdu ? 'ادائیگی محفوظ کریں' : 'Save payment'}
              onPress={handleSubmit}
              disabled={saving}
              style={styles.submitBtn}
              icon={<AppIcon name="check" size={18} color="#FFFFFF" />}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '90%',
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconBg: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.headline,
    fontWeight: '700',
  },
  subtitle: {
    ...Typography.caption,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  errorText: {
    ...Typography.caption,
    flex: 1,
    fontWeight: '600',
  },
  section: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.caption,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  balanceLabel: {
    ...Typography.caption,
    fontWeight: '600',
  },
  balanceValue: {
    ...Typography.title2,
    fontWeight: '800',
    marginTop: 2,
  },
  fullPayBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  fullPayText: {
    ...Typography.caption,
    fontWeight: '700',
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  quickChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  quickChipText: {
    ...Typography.caption,
    fontWeight: '600',
  },
  methodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: '47%',
    flex: 1,
  },
  methodText: {
    ...Typography.caption,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
    gap: Spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    padding: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
});
