import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import { ThemedText } from '@/components/themed-text';
import { AppButton, AppIcon, IconBubble, useToast } from '@/components/ui';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { markSettlementPaid, Settlement } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

interface SettlementPaymentModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  settlement: Settlement | null;
}

export function SettlementPaymentModal({
  visible,
  onClose,
  onSave,
  settlement,
}: SettlementPaymentModalProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const todayStr = new Date().toISOString().split('T')[0];
  const [paymentDate, setPaymentDate] = useState(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Mobile'>('Cash');
  const [saving, setSaving] = useState(false);

  if (!settlement) return null;

  const handlePay = async () => {
    setSaving(true);
    try {
      await markSettlementPaid(db, settlement.id, paymentDate, paymentMethod);
      toast.success(
        isUrdu
          ? `${settlement.target_name} دی رقم Rs ${settlement.net_amount.toLocaleString()} ادا ہو گئی!`
          : `Settlement payment of Rs ${settlement.net_amount.toLocaleString()} recorded for ${settlement.target_name}!`
      );
      onSave();
      onClose();
    } catch (err) {
      logger.error('Failed to mark settlement paid:', err);
      toast.error(isUrdu ? 'ادائیگی درج نہیں ہو سکی' : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.card }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.headerLeft}>
              <IconBubble icon="chart" variant="mint" size={38} iconSize={18} />
              <View>
                <ThemedText style={styles.modalTitle}>
                  {isUrdu ? 'ہفتہ وار ادائیگی درج کرو' : 'Record Settlement Payout'}
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {settlement.target_name} ({settlement.period_start} – {settlement.period_end})
                </ThemedText>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.closeButton, { backgroundColor: theme.backgroundElement }]}>
              <AppIcon name="close" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Calculation Breakdown Card */}
            <View style={[styles.breakdownCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <View style={styles.calcRow}>
                <ThemedText style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'دودھ دا کل بل (Gross Milk Bill):' : 'Gross Milk Total:'}
                </ThemedText>
                <ThemedText style={[styles.calcValue, { color: theme.text }]}>
                  Rs {settlement.gross_amount.toLocaleString()}
                </ThemedText>
              </View>

              {settlement.advance_deduction > 0 && (
                <View style={[styles.calcRow, { marginTop: 8 }]}>
                  <ThemedText style={[styles.calcLabel, { color: theme.danger }]}>
                    {isUrdu ? 'پیشگی کٹوتی (Advance Cut):' : 'Advance Deduction:'}
                  </ThemedText>
                  <ThemedText style={[styles.calcValue, { color: theme.danger }]}>
                    − Rs {settlement.advance_deduction.toLocaleString()}
                  </ThemedText>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.calcRow}>
                <ThemedText style={[styles.netLabel, { color: theme.text }]}>
                  {isUrdu ? 'خالص قابل ادائیگی (Net Payout):' : 'Net Payout:'}
                </ThemedText>
                <ThemedText style={[styles.netValue, { color: theme.primary }]}>
                  Rs {settlement.net_amount.toLocaleString()}
                </ThemedText>
              </View>
            </View>

            {/* Actual Payment Date */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'ادائیگی دی اصل تاریخ (Actual Payment Date)' : 'Actual Payment Date'}
              </ThemedText>
              <TextInput
                value={paymentDate}
                onChangeText={setPaymentDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
              />
              <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
                {isUrdu
                  ? 'جمعہ متوقع سی، لیکن جے اتوار یا پیر نوں ادائیگی ہوئی اے تے اوہی تاریخ درج کرو۔'
                  : 'Expected Friday, but actual payout can be Sunday/Monday.'}
              </ThemedText>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'ادائیگی دا ذریعہ (Payment Method)' : 'Payment Method'}
              </ThemedText>
              <View style={styles.methodsRow}>
                {[
                  { key: 'Cash', label: isUrdu ? 'نقد (Cash)' : 'Cash', icon: '💵' },
                  { key: 'Bank', label: isUrdu ? 'بینک ٹرانسفر' : 'Bank', icon: '🏦' },
                  { key: 'Mobile', label: isUrdu ? 'ایزی پیسہ / جاز کیش' : 'Mobile Pay', icon: '📱' },
                ].map((m) => {
                  const isSelected = paymentMethod === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => setPaymentMethod(m.key as 'Cash' | 'Bank' | 'Mobile')}
                      style={[
                        styles.methodChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}>
                      <ThemedText
                        style={[
                          styles.methodText,
                          { color: isSelected ? '#FFF' : theme.text },
                        ]}>
                        {m.icon} {m.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <AppButton
              title={isUrdu ? 'منسوخ (Cancel)' : 'Cancel'}
              variant="outline"
              onPress={onClose}
              style={styles.cancelBtn}
            />
            <AppButton
              title={saving ? (isUrdu ? 'درج ہو رہا ہے...' : 'Recording...') : (isUrdu ? 'ادائیگی درج کرو (Paid)' : 'Confirm Payment')}
              variant="primary"
              loading={saving}
              onPress={handlePay}
              style={styles.saveBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 11,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  breakdownCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcLabel: {
    fontSize: 13,
  },
  calcValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginVertical: Spacing.sm,
  },
  netLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  netValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  fieldSection: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: 15,
  },
  helperText: {
    fontSize: 10,
    marginTop: 4,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  methodChip: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 2,
  },
});
