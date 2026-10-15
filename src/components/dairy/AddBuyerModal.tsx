import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/button';
import { AppCard } from '@/components/ui/card';
import { AppIcon, IconBubble } from '@/components/ui/icon';
import { AppTextInput } from '@/components/ui/text-input';
import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { Buyer } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

interface AddBuyerModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveBuyer: (
    name: string,
    phone?: string,
    address?: string,
    isDefault?: boolean
  ) => Promise<void>;
  existingBuyers?: Buyer[];
}

export function AddBuyerModal({
  visible,
  onClose,
  onSaveBuyer,
  existingBuyers = [],
}: AddBuyerModalProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setName('');
    setPhone('');
    setAddress('');
    setIsDefault(false);
    setErrorMessage('');
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(isUrdu ? 'براہ کرم گاہک کا نام درج کریں۔' : 'Please enter the buyer or company name.');
      return;
    }

    // Check for duplicate buyer name (case-insensitive)
    const isDuplicate = existingBuyers.some(
      (b) => b.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setErrorMessage(
        isUrdu
          ? `"${trimmedName}" نام کا گاہک پہلے سے موجود ہے۔`
          : `A buyer named "${trimmedName}" already exists.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onSaveBuyer(
        trimmedName,
        phone.trim() || undefined,
        address.trim() || undefined,
        isDefault
      );
      resetForm();
      onClose();
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to save buyer.');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <View style={[styles.dialog, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <IconBubble icon="users" variant="mint" size={36} iconSize={18} />
              <View>
                <ThemedText style={styles.modalTitle}>{isUrdu ? 'نیا گاہک شامل کریں' : 'Add buyer'}</ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {isUrdu ? 'دودھ سینٹر یا تھوک گاہک رجسٹر کریں' : 'Register milk center or wholesale customer'}
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Validation Error Box */}
          {errorMessage ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}>
              <View style={styles.noticeRow}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} />
                <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                  {errorMessage}
                </ThemedText>
              </View>
            </View>
          ) : null}

          {/* Form Scroll Area */}
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Buyer Name Input */}
            <AppTextInput
              label={isUrdu ? 'گاہک یا سینٹر کا نام *' : 'Buyer or center name *'}
              placeholder="e.g. Apex Milk Union or Bilal Dairy"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errorMessage) setErrorMessage('');
              }}
              leftIcon={<AppIcon name="user" size={16} color={theme.textMuted} />}
              autoCapitalize="words"
            />

            {/* Phone Number Input */}
            <AppTextInput
              label={isUrdu ? 'فون نمبر (اختیاری)' : 'Phone number (optional)'}
              placeholder="e.g. 0300 1234567"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon={<Ionicons name="call-outline" size={16} color={theme.textMuted} />}
            />

            {/* Address / Location Input */}
            <AppTextInput
              label={isUrdu ? 'پتہ (اختیاری)' : 'Address (optional)'}
              placeholder="e.g. Sheikhupura Road, Sector 4"
              value={address}
              onChangeText={setAddress}
              leftIcon={<Ionicons name="location-outline" size={16} color={theme.textMuted} />}
              autoCapitalize="sentences"
            />

            {/* Set as Default Buyer Switch */}
            <AppCard variant="default" padding="sm">
              <View style={styles.switchRow}>
                <View style={styles.switchMeta}>
                  <ThemedText style={styles.switchTitle}>
                    {isUrdu ? 'بنیادی گاہک بنائیں' : 'Set as default buyer'}
                  </ThemedText>
                  <ThemedText style={[styles.switchDesc, { color: theme.textSecondary }]}>
                    {isUrdu ? 'نئی فروخت میں خود بخود منتخب ہوگا' : 'Auto-selected when logging new milk sales'}
                  </ThemedText>
                </View>
                <Switch
                  value={isDefault}
                  onValueChange={setIsDefault}
                  thumbColor={isDefault ? theme.primary : theme.textMuted}
                  trackColor={{ false: theme.border, true: theme.primaryLight }}
                />
              </View>
            </AppCard>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actionsRow, { borderTopColor: theme.border }]}>
            <AppButton
              variant="secondary"
              size="md"
              title={isUrdu ? 'منسوخ' : 'Cancel'}
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.cancelBtn}
            />

            <AppButton
              variant="primary"
              size="md"
              title={isSubmitting ? (isUrdu ? 'محفوظ ہو رہا ہے...' : 'Saving...') : isUrdu ? 'گاہک محفوظ کریں' : 'Save buyer'}
              icon={<AppIcon name="check" size={16} color="#FFFFFF" />}
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={styles.saveBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '88%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  modalTitle: {
    fontSize: Typography.bodyBold.fontSize,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: Typography.footnote.fontSize,
  },
  closeBtn: {
    padding: 6,
    borderRadius: BorderRadius.full,
  },
  pressed: {
    opacity: 0.7,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorBox: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.sm,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    gap: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchMeta: {
    flex: 1,
    gap: 2,
    paddingRight: Spacing.md,
  },
  switchTitle: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1.6,
  },
});
