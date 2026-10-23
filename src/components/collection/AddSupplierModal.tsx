import React, { useEffect, useState } from 'react';
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
  insertSupplier,
  NewSupplier,
  Supplier,
  SupplierRateType,
  updateSupplier,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { logger } from '@/utils/logger';

interface AddSupplierModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  supplierToEdit?: Supplier | null;
}

export function AddSupplierModal({
  visible,
  onClose,
  onSave,
  supplierToEdit,
}: AddSupplierModalProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [rateType, setRateType] = useState<SupplierRateType>('fat_based');
  const [flatRateText, setFlatRateText] = useState('200');
  const [fatPointRateText, setFatPointRateText] = useState('35');
  const [balanceText, setBalanceText] = useState('0');
  const [linkedFarmId, setLinkedFarmId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const next = supplierToEdit
      ? {
          name: supplierToEdit.name,
          phone: supplierToEdit.phone || '',
          village: supplierToEdit.village || '',
          rateType: supplierToEdit.rate_type,
          flatRate: supplierToEdit.flat_rate ? String(supplierToEdit.flat_rate) : '200',
          fatPoint: supplierToEdit.rate_per_fat_point ? String(supplierToEdit.rate_per_fat_point) : '35',
          balance: String(supplierToEdit.balance || 0),
          linked: supplierToEdit.linked_farm_id || '',
        }
      : {
          name: '',
          phone: '',
          village: '',
          rateType: 'fat_based' as const,
          flatRate: '200',
          fatPoint: '35',
          balance: '0',
          linked: '',
        };
    queueMicrotask(() => {
      setName(next.name);
      setPhone(next.phone);
      setVillage(next.village);
      setRateType(next.rateType);
      setFlatRateText(next.flatRate);
      setFatPointRateText(next.fatPoint);
      setBalanceText(next.balance);
      setLinkedFarmId(next.linked);
    });
  }, [visible, supplierToEdit]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.info(isUrdu ? 'مہربانی کر کے سپلائر دا ناں درج کرو' : 'Please enter supplier name');
      return;
    }

    setSaving(true);
    try {
      const payload: NewSupplier = {
        name: trimmedName,
        phone: phone.trim() || null,
        village: village.trim() || null,
        rate_type: rateType,
        flat_rate: rateType === 'flat' ? parseFloat(flatRateText) || 200 : null,
        base_fat: 6.0,
        rate_per_fat_point: rateType === 'fat_based' ? parseFloat(fatPointRateText) || 35 : null,
        balance: parseFloat(balanceText) || 0,
        linked_farm_id: linkedFarmId.trim() || null,
        status: 'active',
      };

      if (supplierToEdit) {
        await updateSupplier(db, supplierToEdit.id, payload);
        toast.success(isUrdu ? 'سپلائر اپڈیٹ ہو گیا' : 'Supplier updated successfully');
      } else {
        await insertSupplier(db, payload);
        toast.success(isUrdu ? 'نیا سپلائر شامل ہو گیا' : 'New supplier added successfully');
      }
      onSave();
      onClose();
    } catch (err) {
      logger.error('Failed to save supplier:', err);
      toast.error(isUrdu ? 'سپلائر محفوظ نہیں ہو سکیا' : 'Failed to save supplier');
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
              <IconBubble icon="users" variant="mint" size={38} iconSize={18} />
              <ThemedText style={styles.modalTitle}>
                {supplierToEdit
                  ? isUrdu
                    ? 'سپلائر درست کرو'
                    : 'Edit Supplier'
                  : isUrdu
                  ? 'نواں سپلائر شامل کرو'
                  : 'Add New Supplier'}
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
            {/* Supplier Name */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'سپلائر دا ناں (Supplier Name) *' : 'Supplier Name *'}
              </ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={isUrdu ? 'مثلاً: چوہدری اصغر، رانا بشیر...' : 'e.g. Asghar Ali'}
                placeholderTextColor={theme.textMuted}
                style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
              />
            </View>

            {/* Phone & Village Row */}
            <View style={styles.twoColumnRow}>
              <View style={[styles.fieldSection, { flex: 1 }]}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'فون نمبر (Phone)' : 'Phone Number'}
                </ThemedText>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="03001234567"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
                />
              </View>

              <View style={[styles.fieldSection, { flex: 1 }]}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'پنڈ / تھاں (Village)' : 'Village / Area'}
                </ThemedText>
                <TextInput
                  value={village}
                  onChangeText={setVillage}
                  placeholder={isUrdu ? 'مثلاً: چک 24' : 'e.g. Chak 24'}
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
                />
              </View>
            </View>

            {/* Rate Type Selector */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'ریٹ دی قسم (Pricing Model)' : 'Pricing Model'}
              </ThemedText>
              <View style={[styles.toggleRow, { backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  onPress={() => setRateType('fat_based')}
                  style={[
                    styles.toggleTab,
                    rateType === 'fat_based' && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText
                    style={[
                      styles.toggleTabText,
                      { color: rateType === 'fat_based' ? '#FFF' : theme.textSecondary },
                    ]}>
                    🥛 {isUrdu ? 'فیٹ فارمولا (Fat-based)' : 'Fat-based'}
                  </ThemedText>
                </Pressable>

                <Pressable
                  onPress={() => setRateType('flat')}
                  style={[
                    styles.toggleTab,
                    rateType === 'flat' && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText
                    style={[
                      styles.toggleTabText,
                      { color: rateType === 'flat' ? '#FFF' : theme.textSecondary },
                    ]}>
                    🏷️ {isUrdu ? 'مقررہ ریٹ (Flat Rate)' : 'Flat Rate'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Rate Details depending on selection */}
            {rateType === 'fat_based' ? (
              <View style={styles.fieldSection}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'فی فیٹ پوائنٹ ریٹ (Rs per Fat Point)' : 'Rs per Fat Point (e.g. Rs 35)'}
                </ThemedText>
                <View style={[styles.inputWithSuffix, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <TextInput
                    value={fatPointRateText}
                    onChangeText={setFatPointRateText}
                    keyboardType="numeric"
                    placeholder="35"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.suffixInput, { color: theme.text }]}
                  />
                  <ThemedText style={[styles.suffixText, { color: theme.textSecondary }]}>
                    Rs / point
                  </ThemedText>
                </View>
                <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
                  {isUrdu
                    ? 'مثال: 6.0% فیٹ تے 6.0 × 35 = Rs 210/لیٹر بنے گا'
                    : 'Formula: Fat % × Rate = Rs/L (e.g. 6.0% × 35 = Rs 210/L)'}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.fieldSection}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'مقررہ ریٹ فی لیٹر (Flat Rate Rs/Liter)' : 'Flat Rate per Liter (Rs)'}
                </ThemedText>
                <View style={[styles.inputWithSuffix, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <TextInput
                    value={flatRateText}
                    onChangeText={setFlatRateText}
                    keyboardType="numeric"
                    placeholder="200"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.suffixInput, { color: theme.text }]}
                  />
                  <ThemedText style={[styles.suffixText, { color: theme.textSecondary }]}>
                    Rs / L
                  </ThemedText>
                </View>
              </View>
            )}

            {/* Opening Balance (only on creation) */}
            {!supplierToEdit && (
              <View style={styles.fieldSection}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'سابقہ بقایا / پیشگی رقم (Opening Balance Rs)' : 'Opening Balance (Rs)'}
                </ThemedText>
                <TextInput
                  value={balanceText}
                  onChangeText={setBalanceText}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
                />
              </View>
            )}

            {/* Optional Linked Farm ID / Code */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'منسلک فارم کوڈ (Linked Farm ID - اختیاری)' : 'Linked Farm ID / Code (Optional)'}
              </ThemedText>
              <TextInput
                value={linkedFarmId}
                onChangeText={setLinkedFarmId}
                placeholder={isUrdu ? 'مثلاً DF-4821' : 'e.g. DF-4821'}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                style={[styles.input, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
              />
              <ThemedText style={[styles.helperText, { color: theme.textMuted }]}>
                {isUrdu
                  ? 'اگر کسان DairyFlow فارم ایپ استعمال کردا اے تے اودا فارم کوڈ درج کرو'
                  : 'Link with farmer’s DairyFlow app to authorize synchronized collection receipts'}
              </ThemedText>
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
              title={saving ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : (isUrdu ? 'محفوظ کرو (Save)' : 'Save Supplier')}
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
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    fontSize: 15,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  toggleTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    height: 48,
    paddingHorizontal: Spacing.md,
  },
  suffixInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  suffixText: {
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 10,
    marginTop: 4,
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
