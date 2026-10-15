import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminPinModal } from './AdminPinModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  IconBubble,
} from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

interface FarmProfileModalProps {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function FarmProfileModal({
  visible,
  onClose,
  onSaved,
}: FarmProfileModalProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const {
    farmName,
    ownerName,
    ownerPhone,
    defaultMilkRate,
    hasPinSet,
    updateFarmProfile,
    setNewPin,
    lockApp,
  } = useAdmin();

  const [inputFarmName, setInputFarmName] = useState<string>(farmName);
  const [inputOwnerName, setInputOwnerName] = useState<string>(ownerName);
  const [inputOwnerPhone, setInputOwnerPhone] = useState<string>(ownerPhone);
  const [inputRate, setInputRate] = useState<string>(defaultMilkRate);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isPinSetupModalOpen, setIsPinSetupModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- re-sync the form with saved profile each time the modal opens
      setInputFarmName(farmName);
      setInputOwnerName(ownerName);
      setInputOwnerPhone(ownerPhone);
      setInputRate(defaultMilkRate);
    }
  }, [visible, farmName, ownerName, ownerPhone, defaultMilkRate]);

  const handleSave = async () => {
    if (!inputFarmName.trim()) {
      Alert.alert(
        isUrdu ? 'نام ضروری اے' : 'Required',
        isUrdu ? 'مہربانی کر کے فارم دا ناں درج کرو۔' : 'Please enter a farm name.'
      );
      return;
    }

    const parsedRate = parseFloat(inputRate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      Alert.alert(
        isUrdu ? 'ریٹ غلط اے' : 'Invalid Rate',
        isUrdu ? 'مہربانی کر کے دودھ دا درست فی لیٹر ریٹ درج کرو۔' : 'Please enter a valid milk rate per liter.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await updateFarmProfile({
        farmName: inputFarmName.trim(),
        ownerName: inputOwnerName.trim(),
        ownerPhone: inputOwnerPhone.trim(),
        defaultMilkRate: inputRate.trim(),
      });
      onClose();
      if (onSaved) onSaved();
    } catch {
      Alert.alert(
        isUrdu ? 'خرابی' : 'Error',
        isUrdu ? 'فارم دی معلومات محفوظ نہیں ہو سکی۔' : 'Could not save farm profile.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemovePin = () => {
    Alert.alert(
      isUrdu ? 'ایڈمن پن ختم کرو' : 'Remove PIN',
      isUrdu
        ? 'کی تسیں ایڈمن پن ختم کرنا چاہندے او؟ اس نال کوئی وی بندہ ریٹ تے سیٹنگز بدل سکے گا۔'
        : 'Are you sure you want to remove the admin PIN? Anyone using the app will be able to edit settings.',
      [
        { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
        {
          text: isUrdu ? 'ہاں، ختم کرو' : 'Yes, Remove',
          style: 'destructive',
          onPress: async () => {
            await setNewPin('');
          },
        },
      ]
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* Header */}
            <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                <AppIcon name="chevronLeft" size={24} color={theme.text} />
              </Pressable>

              <View style={styles.headerTitleWrap}>
                <ThemedText style={styles.modalTitle}>
                  {isUrdu ? 'فارم ایڈمن سیٹنگز' : 'Farm Admin Settings'}
                </ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  {isUrdu
                    ? 'فارم دا ناں، دودھ دا ریٹ تے ایڈمن پن'
                    : 'Farm name, standard rate & security PIN'}
                </ThemedText>
              </View>

              <View style={{ width: 36 }} />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}>
              {/* Highlight Hero Card */}
              <AppCard variant="mint" padding="lg" style={styles.heroCard}>
                <View style={styles.heroTopRow}>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.heroLabel}>
                      {isUrdu ? 'موجودہ فارم دا ناں' : 'Registered Farm'}
                    </ThemedText>
                    <ThemedText style={styles.heroFarmName} numberOfLines={1}>
                      {inputFarmName || (isUrdu ? 'الرحمان ڈیری فارم' : 'Rehman Dairy Farm')}
                    </ThemedText>
                    <ThemedText style={styles.heroSubtext}>
                      {isUrdu
                        ? `بنیادی ریٹ: Rs ${inputRate || '220'} فی لیٹر`
                        : `Default rate: Rs ${inputRate || '220'} / Liter`}
                    </ThemedText>
                  </View>
                  <IconBubble icon="sprout" variant="mint" size={44} iconSize={22} />
                </View>
              </AppCard>

              {/* Form Section 1: Farm & Owner Details */}
              <View style={styles.formSection}>
                <ThemedText style={styles.sectionHeader}>
                  {isUrdu ? 'فارم دی معلومات' : 'Farm Profile'}
                </ThemedText>

                <AppTextInput
                  label={isUrdu ? 'فارم دا ناں' : 'Farm Name'}
                  required
                  value={inputFarmName}
                  onChangeText={setInputFarmName}
                  placeholder={isUrdu ? 'مثلاً الرحمان ڈیری فارم' : 'e.g. Rehman Dairy Farm'}
                  leftIcon={<AppIcon name="sprout" size={16} color={theme.textMuted} />}
                />

                <AppTextInput
                  label={isUrdu ? 'فارم مالک / ایڈمن دا ناں' : 'Farm Owner / Admin Name'}
                  value={inputOwnerName}
                  onChangeText={setInputOwnerName}
                  placeholder={isUrdu ? 'مثلاً چوہدری صاحب' : 'e.g. Chaudhry Sahab'}
                  leftIcon={<AppIcon name="user" size={16} color={theme.textMuted} />}
                />

                <AppTextInput
                  label={isUrdu ? 'رابطہ فون نمبر' : 'Contact Phone'}
                  value={inputOwnerPhone}
                  onChangeText={setInputOwnerPhone}
                  placeholder="0300-1234567"
                  keyboardType="phone-pad"
                  leftIcon={<AppIcon name="phone" size={16} color={theme.textMuted} />}
                />
              </View>

              {/* Form Section 2: Standard Milk Rate */}
              <View style={styles.formSection}>
                <ThemedText style={styles.sectionHeader}>
                  {isUrdu ? 'دودھ دا بنیادی ریٹ' : 'Standard Milk Rate'}
                </ThemedText>

                <AppTextInput
                  label={isUrdu ? 'فی لیٹر بنیادی ریٹ (روپے)' : 'Standard Rate per Liter (PKR)'}
                  required
                  value={inputRate}
                  onChangeText={setInputRate}
                  placeholder="220"
                  keyboardType="decimal-pad"
                  unitSuffix={isUrdu ? 'روپے / لیٹر' : 'Rs / L'}
                  leftIcon={<AppIcon name="cash" size={16} color={theme.textMuted} />}
                />

                <ThemedText style={[styles.helpCaption, { color: theme.textSecondary }]}>
                  {isUrdu
                    ? 'جدوں وی تسی یا ملازم نیا دودھ درج کرو گے، ایہ ریٹ خود بخود لگ جاوے گا۔'
                    : 'This rate will automatically pre-fill on every new milk entry.'}
                </ThemedText>
              </View>

              {/* Form Section 3: Admin PIN Security */}
              <View style={styles.formSection}>
                <ThemedText style={styles.sectionHeader}>
                  {isUrdu ? 'ایڈمن لاک تے سیکیورٹی' : 'Admin Security & Lock'}
                </ThemedText>

                <AppCard variant="default" padding="md" style={styles.pinCard}>
                  <View style={styles.pinCardRow}>
                    <View style={styles.pinLeft}>
                      <IconBubble
                        icon="wallet"
                        variant={hasPinSet ? 'mint' : 'gray'}
                        size={36}
                        iconSize={18}
                      />
                      <View>
                        <ThemedText style={styles.pinStatusTitle}>
                          {hasPinSet
                            ? isUrdu
                              ? '4-ہندسی ایڈمن پن فعال اے'
                              : '4-Digit Admin PIN Active'
                            : isUrdu
                              ? 'کوئی ایڈمن پن سیٹ نہیں'
                              : 'No Admin PIN Set'}
                        </ThemedText>
                        <ThemedText style={[styles.pinStatusSub, { color: theme.textSecondary }]}>
                          {hasPinSet
                            ? isUrdu
                              ? 'ریٹ تے خفیا کھاتے پن نال محفوظ نے'
                              : 'Rates and finances are PIN-protected'
                            : isUrdu
                              ? 'ملازمین توں محفوظ کرن لئی پن بناؤ'
                              : 'Set a PIN so workers cannot alter rates'}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.pinActionsRow}>
                    <AppButton
                      variant={hasPinSet ? 'outline' : 'primary'}
                      size="sm"
                      title={
                        hasPinSet
                          ? isUrdu
                            ? 'پن تبدیل کرو'
                            : 'Change PIN'
                          : isUrdu
                            ? '+ نواں پن بناؤ'
                            : '+ Set Admin PIN'
                      }
                      onPress={() => setIsPinSetupModalOpen(true)}
                      style={{ flex: 1 }}
                    />

                    {hasPinSet ? (
                      <AppButton
                        variant="ghost"
                        size="sm"
                        title={isUrdu ? 'پن ختم کرو' : 'Remove PIN'}
                        onPress={handleRemovePin}
                        style={{ flex: 1 }}
                      />
                    ) : null}
                  </View>
                </AppCard>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionContainer}>
                <AppButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  title={
                    isSubmitting
                      ? isUrdu
                        ? 'محفوظ ہو رہیا اے...'
                        : 'Saving...'
                      : isUrdu
                        ? 'سیٹنگز محفوظ کرو'
                        : 'Save Farm Settings'
                  }
                  loading={isSubmitting}
                  icon={<AppIcon name="check" size={18} color="#FFFFFF" />}
                  onPress={handleSave}
                />

                <AppButton
                  variant="ghost"
                  size="md"
                  title={isUrdu ? 'منسوخ کرو' : 'Cancel'}
                  onPress={onClose}
                  style={styles.cancelGhostBtn}
                />

                <AppButton
                  variant="danger"
                  size="md"
                  fullWidth
                  title={isUrdu ? '🚪 فارم توں لاگ آؤٹ کرو' : '🚪 Log Out from Farm'}
                  icon={<AppIcon name="logout" size={16} color="#FFFFFF" />}
                  onPress={() => {
                    Alert.alert(
                      isUrdu ? 'لاگ آؤٹ' : 'Log Out',
                      isUrdu ? 'کی تسیں فارم توں لاگ آؤٹ ہونا چاہندے او؟' : 'Are you sure you want to log out?',
                      [
                        { text: isUrdu ? 'منسوخ' : 'Cancel', style: 'cancel' },
                        {
                          text: isUrdu ? 'لاگ آؤٹ کرو' : 'Log Out',
                          style: 'destructive',
                          onPress: () => {
                            onClose();
                            lockApp();
                          },
                        },
                      ]
                    );
                  }}
                  style={{ marginTop: Spacing.xs }}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* PIN Setup Modal */}
      <AdminPinModal
        visible={isPinSetupModalOpen}
        mode="setup"
        onClose={() => setIsPinSetupModalOpen(false)}
        onSuccess={() => {
          Alert.alert(
            isUrdu ? 'مبارک ہو!' : 'PIN Set',
            isUrdu
              ? 'تہاڈا ایڈمن پن کامیابی نال محفوظ ہو گیا۔'
              : 'Your Admin PIN has been configured successfully.'
          );
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: Typography.caption.fontSize,
    color: '#6B7280',
    marginTop: 2,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl * 2,
  },
  heroCard: {
    marginBottom: Spacing.xs,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontSize: Typography.tiny.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#064E3B',
    marginBottom: 4,
  },
  heroFarmName: {
    fontSize: Typography.title2.fontSize,
    fontWeight: '800',
    color: '#064E3B',
  },
  heroSubtext: {
    fontSize: Typography.footnote.fontSize,
    color: '#047857',
    marginTop: 4,
    fontWeight: '600',
  },
  formSection: {
    gap: Spacing.sm,
  },
  sectionHeader: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
    marginBottom: 4,
  },
  helpCaption: {
    fontSize: Typography.caption.fontSize,
    marginTop: 2,
    lineHeight: 16,
  },
  pinCard: {
    gap: Spacing.md,
  },
  pinCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pinLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  pinStatusTitle: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  pinStatusSub: {
    fontSize: Typography.caption.fontSize,
    marginTop: 2,
  },
  pinActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  actionContainer: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  cancelGhostBtn: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
