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
import {
  insertAdvance,
  NewAdvance,
  RepaymentTerms,
  Supplier,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

interface AddAdvanceModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  suppliers: Supplier[];
  initialSupplierId?: number;
}

export function AddAdvanceModal({
  visible,
  onClose,
  onSave,
  suppliers,
  initialSupplierId,
}: AddAdvanceModalProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
    initialSupplierId ?? (suppliers[0]?.id || null)
  );
  const [amountText, setAmountText] = useState('');
  const [repaymentTerms, setRepaymentTerms] = useState<RepaymentTerms>('weekly_cut');
  const [deductionText, setDeductionText] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  const handleSave = async () => {
    if (!selectedSupplier) {
      toast.info(isUrdu ? 'سپلائر منتخب کرو' : 'Select a supplier');
      return;
    }
    const amount = parseFloat(amountText);
    if (!amount || amount <= 0) {
      toast.info(isUrdu ? 'درست رقم درج کرو' : 'Enter valid advance amount');
      return;
    }

    const deduction = parseFloat(deductionText) || (repaymentTerms === 'weekly_cut' ? Math.min(amount, 2000) : 0);

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const payload: NewAdvance = {
        target_type: 'supplier',
        target_id: selectedSupplier.id,
        target_name: selectedSupplier.name,
        amount,
        remaining_balance: amount,
        repayment_terms: repaymentTerms,
        deduction_per_settlement: deduction,
        status: 'active',
        date: today,
        notes: notes.trim() || null,
      };

      await insertAdvance(db, payload);
      toast.success(
        isUrdu
          ? `${selectedSupplier.name} نو Rs ${amount.toLocaleString()} پیشگی درج ہو گئی!`
          : `Issued Rs ${amount.toLocaleString()} advance to ${selectedSupplier.name}!`
      );
      onSave();
      onClose();
    } catch (err) {
      logger.error('Failed to issue advance:', err);
      toast.error(isUrdu ? 'پیشگی محفوظ نہیں ہو سکی' : 'Failed to save advance');
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
              <IconBubble icon="feed" variant="amber" size={38} iconSize={18} />
              <ThemedText style={styles.modalTitle}>
                {isUrdu ? 'پیشگی رقم جاری کرو (Issue Advance)' : 'Issue Cash Advance'}
              </ThemedText>
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
            {/* Supplier Selector */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'سپلائر منتخب کرو (Select Supplier)' : 'Select Supplier'}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suppliers.map((s) => {
                  const isSelected = s.id === selectedSupplierId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedSupplierId(s.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}>
                      <ThemedText
                        style={[
                          styles.chipText,
                          { color: isSelected ? '#FFF' : theme.text },
                        ]}>
                        {s.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Advance Amount */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'پیشگی رقم (Advance Amount Rs) *' : 'Advance Amount (Rs) *'}
              </ThemedText>
              <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <ThemedText style={[styles.currencyPrefix, { color: theme.textSecondary }]}>Rs</ThemedText>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="numeric"
                  placeholder="10000"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.amountInput, { color: theme.text }]}
                />
              </View>
              {/* Quick Amount Chips */}
              <View style={styles.quickChipsRow}>
                {[5000, 10000, 20000, 50000].map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => setAmountText(String(val))}
                    style={[styles.quickChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <ThemedText style={[styles.quickChipText, { color: theme.text }]}>
                      Rs {val.toLocaleString()}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Repayment Terms */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'واپسی دا طریقہ (Repayment Terms)' : 'Repayment Terms'}
              </ThemedText>
              <View style={[styles.termsToggle, { backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  onPress={() => setRepaymentTerms('weekly_cut')}
                  style={[
                    styles.termTab,
                    repaymentTerms === 'weekly_cut' && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText
                    style={[
                      styles.termTabText,
                      { color: repaymentTerms === 'weekly_cut' ? '#FFF' : theme.textSecondary },
                    ]}>
                    📅 {isUrdu ? 'ہفتہ وار کٹوتی' : 'Weekly Cut'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setRepaymentTerms('single_cut')}
                  style={[
                    styles.termTab,
                    repaymentTerms === 'single_cut' && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText
                    style={[
                      styles.termTabText,
                      { color: repaymentTerms === 'single_cut' ? '#FFF' : theme.textSecondary },
                    ]}>
                    ⚡ {isUrdu ? 'اکٹھی کٹوتی' : 'Full Next Bill'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Weekly Deduction Amount if weekly_cut */}
            {repaymentTerms === 'weekly_cut' && (
              <View style={styles.fieldSection}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'ہر جمعہ کٹوتی دی رقم (Deduction Per Friday Settlement)' : 'Deduction per Friday Settlement'}
                </ThemedText>
                <View style={[styles.inputBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={[styles.currencyPrefix, { color: theme.textSecondary }]}>Rs</ThemedText>
                  <TextInput
                    value={deductionText}
                    onChangeText={setDeductionText}
                    keyboardType="numeric"
                    placeholder="2000"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.amountInput, { color: theme.text }]}
                  />
                </View>
              </View>
            )}

            {/* Notes */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'نوٹس / وجہ (Notes)' : 'Notes'}
              </ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={isUrdu ? 'مثلاً: بھینس دی خریداری، گھریلو خرچ...' : 'e.g. Fodder / personal loan'}
                placeholderTextColor={theme.textMuted}
                style={[styles.notesInput, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
              />
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <AppButton
              title={isUrdu ? 'منسوخ (Cancel)' : 'Cancel'}
              variant="outline"
              onPress={onClose}
              style={styles.cancelBtn}
            />
            <AppButton
              title={saving ? (isUrdu ? 'جاری ہو رہا ہے...' : 'Issuing...') : (isUrdu ? 'پیشگی جاری کرو' : 'Issue Advance')}
              variant="primary"
              loading={saving}
              onPress={handleSave}
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
    maxHeight: '90%',
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
  fieldSection: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: 50,
    paddingHorizontal: Spacing.md,
  },
  currencyPrefix: {
    fontSize: 15,
    fontWeight: '700',
    marginRight: Spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  quickChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  termsToggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  termTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  termTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
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
