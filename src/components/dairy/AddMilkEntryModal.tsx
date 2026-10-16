import { useSQLiteContext } from 'expo-sqlite';
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

import { AddBuyerModal } from './AddBuyerModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  IconBubble,
  ShiftSelector,
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { Buyer, getAppSetting, MilkEntry, NewMilkEntry, ShiftType } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface AddMilkEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveEntry: (entry: NewMilkEntry) => Promise<void>;
  buyers: Buyer[];
  defaultBuyer: Buyer | null;
  onAddBuyer: (name: string, phone?: string, address?: string, isDefault?: boolean) => Promise<void>;
  initialDate?: string;
  currencySymbol?: string;
  entryToEdit?: MilkEntry | null;
  onUpdateEntry?: (id: number, entry: NewMilkEntry) => Promise<void>;
}

export function AddMilkEntryModal({
  visible,
  onClose,
  onSaveEntry,
  buyers,
  defaultBuyer,
  onAddBuyer,
  initialDate,
  currencySymbol = 'Rs',
  entryToEdit,
  onUpdateEntry,
}: AddMilkEntryModalProps) {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { isUrdu } = useLanguage();

  // Helper for local calendar date (YYYY-MM-DD)
  const getTodayLocalDate = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = getTodayLocalDate();

  // Form states
  const [date, setDate] = useState(initialDate || todayStr);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [shift, setShift] = useState<ShiftType>('Morning');
  const [liters, setLiters] = useState('');
  const [fat, setFat] = useState('4.5');
  const [rate, setRate] = useState('220');

  // Load admin-configured standard milk rate when adding a new entry
  useEffect(() => {
    if (visible && !entryToEdit) {
      getAppSetting(db, 'default_milk_rate', '220')
        .then((savedRate) => {
          if (savedRate && savedRate.trim() !== '') {
            setRate(savedRate.trim());
          }
        })
        .catch(() => {});
    }
  }, [visible, entryToEdit, db]);

  // Buyer selection state
  const fallbackBuyerId = defaultBuyer?.id ?? (buyers.length > 0 ? buyers[0].id : null);
  const [userSelectedBuyerId, setUserSelectedBuyerId] = useState<number | null>(null);
  const selectedBuyerId = userSelectedBuyerId ?? fallbackBuyerId;
  const [isBuyerListOpen, setIsBuyerListOpen] = useState(false);

  // Notes state
  const [notes, setNotes] = useState('');

  // UI state
  const [isBuyerModalOpen, setIsBuyerModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState('');

  // Track prop changes to sync date and prefill when modal opens
  const [lastSync, setLastSync] = useState<{
    visible: boolean;
    initialDate?: string;
    entryId?: number;
  }>({
    visible: false,
    initialDate,
    entryId: entryToEdit?.id,
  });

  if (
    visible !== lastSync.visible ||
    initialDate !== lastSync.initialDate ||
    entryToEdit?.id !== lastSync.entryId
  ) {
    setLastSync({ visible, initialDate, entryId: entryToEdit?.id });
    if (visible && entryToEdit) {
      setDate(entryToEdit.date);
      setShift(entryToEdit.shift);
      setLiters(entryToEdit.liters.toString());
      setFat(entryToEdit.fat_percentage.toString());
      setRate(entryToEdit.rate_per_liter.toString());
      setUserSelectedBuyerId(entryToEdit.buyer_id);
      setNotes(entryToEdit.notes || '');
    } else if (visible && initialDate) {
      setDate(initialDate);
    }
  }

  // Real-time calculation of total amount
  const parsedLiters = parseFloat(liters);
  const parsedRate = parseFloat(rate);
  const liveTotalAmount =
    !isNaN(parsedLiters) && !isNaN(parsedRate) && parsedLiters > 0 && parsedRate > 0
      ? parsedLiters * parsedRate
      : 0;

  const chosenBuyer = buyers.find((b) => b.id === selectedBuyerId) ?? defaultBuyer ?? buyers[0];

  const resetForm = () => {
    setLiters('');
    setNotes('');
    setUserSelectedBuyerId(null);
    setIsBuyerListOpen(false);
    setIsDatePickerOpen(false);
    setErrors({});
    setGeneralError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    // If user entered significant data, warn before discarding
    if (liters.trim() && !isSubmitting) {
      Alert.alert(
        'Discard Entry?',
        'You have unsaved changes. Are you sure you want to discard this milk entry?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ]
      );
      return;
    }
    resetForm();
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Date
    if (!date.trim()) {
      newErrors.date = 'Date is required.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      newErrors.date = 'Date must be formatted as YYYY-MM-DD.';
    }

    // Liters
    const lVal = parseFloat(liters);
    if (!liters.trim() || isNaN(lVal)) {
      newErrors.liters = 'Please enter quantity in liters.';
    } else if (lVal <= 0) {
      newErrors.liters = 'Quantity must be greater than 0.';
    } else if (lVal > 5000) {
      newErrors.liters = 'Quantity exceeds 5,000 L limit.';
    }

    // Fat percentage
    const fVal = parseFloat(fat);
    if (!fat.trim() || isNaN(fVal)) {
      newErrors.fat = 'Please enter fat percentage.';
    } else if (fVal <= 0) {
      newErrors.fat = 'Fat % must be greater than 0.';
    } else if (fVal > 15) {
      newErrors.fat = 'Fat % should not exceed 15%.';
    }

    // Rate per liter
    const rVal = parseFloat(rate);
    if (!rate.trim() || isNaN(rVal)) {
      newErrors.rate = 'Please enter rate per liter.';
    } else if (rVal <= 0) {
      newErrors.rate = 'Rate must be greater than 0.';
    }

    // Buyer
    if (!chosenBuyer) {
      newErrors.buyer = 'Please select or add a buyer.';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setGeneralError('Please check highlighted errors.');
      return false;
    }

    setGeneralError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate() || isSubmitting) return;

    if (!chosenBuyer) {
      setErrors({ buyer: 'Selected buyer not found.' });
      return;
    }

    const newEntry: NewMilkEntry = {
      date: date.trim(),
      shift,
      liters: parseFloat(liters),
      fat_percentage: parseFloat(fat),
      rate_per_liter: parseFloat(rate),
      total_amount: Number(liveTotalAmount.toFixed(2)),
      buyer_id: chosenBuyer.id,
      buyer_name: chosenBuyer.name,
      notes: notes.trim() || undefined,
    };

    try {
      setIsSubmitting(true);
      if (entryToEdit && onUpdateEntry) {
        await onUpdateEntry(entryToEdit.id, newEntry);
      } else {
        await onSaveEntry(newEntry);
      }
      resetForm();
      onClose();
    } catch (e: any) {
      setGeneralError(e.message || 'Failed to save entry to local database.');
      setIsSubmitting(false);
    }
  };

  // Format readable local date string (e.g. "Tue, 13 Oct 2026")
  const formatReadableDate = (dateStr: string): string => {
    try {
      const parts = dateStr.split('-').map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return d.toLocaleDateString(undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {
      // fallback
    }
    return dateStr;
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}>
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {/* ========================================================= */}
            {/* 1. TOP HEADER (Back arrow, Title, Subtitle, Help icon)   */}
            {/* ========================================================= */}
            <View style={[styles.headerRow, { borderBottomColor: theme.border }]}>
              <Pressable
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
                <AppIcon name="chevronLeft" size={24} color={theme.text} />
              </Pressable>

              <View style={styles.headerTitleWrap}>
                <ThemedText style={styles.modalTitle}>
                  {entryToEdit
                    ? isUrdu
                      ? 'دودھ دا اندراج درست کرو'
                      : 'Edit milk sale'
                    : isUrdu
                      ? 'دودھ دا نواں اندراج'
                      : 'Add milk sale'}
                </ThemedText>
                <ThemedText style={styles.modalSubtitle}>
                  {entryToEdit
                    ? isUrdu
                      ? 'مقدار، فیٹ تے ریٹ تبدیل کرو'
                      : 'Update recorded quantities & rate'
                    : isUrdu
                      ? 'فوری اندراج · صرف 30 سیکنڈ'
                      : 'Quick entry · about 30 seconds'}
                </ThemedText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Help Info"
                onPress={() =>
                  Alert.alert(
                    isUrdu ? 'دودھ دا فوری اندراج' : 'Quick Milk Entry',
                    isUrdu
                      ? 'دودھ دی مقدار، فیٹ فیصد تے ریٹ درج کرو۔ ایہ فوری موبائل وچ محفوظ ہو جاوے گا۔'
                      : 'Enter session quantity, fat percentage, and rate. Entries are immediately stored in local SQLite and attributed to the buyer.'
                  )
                }
                hitSlop={12}
                style={({ pressed }) => [styles.helpBtn, pressed && styles.pressed]}>
                <AppIcon name="alert" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollContent}>
              {/* General Error Banner */}
              {generalError ? (
                <AppCard variant="warning" padding="sm" style={styles.generalErrorCard}>
                  <View style={styles.errorRow}>
                    <AppIcon name="close" size={16} color={theme.danger} />
                    <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                      {generalError}
                    </ThemedText>
                  </View>
                </AppCard>
              ) : null}

              {/* ========================================================= */}
              {/* 2. OFFLINE WARNING BANNER (Matching Screenshot 140503)    */}
              {/* ========================================================= */}
              <AppCard variant="warning" padding="md" style={styles.offlineBanner}>
                <View style={styles.offlineBannerContent}>
                  <AppIcon name="sync" size={18} color={theme.accent} />
                  <View style={styles.offlineTextCol}>
                    <ThemedText style={[styles.offlineBannerTitle, { color: theme.morning }]}>
                      {isUrdu ? 'آف لائن اندراج دستیاب اے' : 'Offline entry is available'}
                    </ThemedText>
                    <ThemedText style={[styles.offlineBannerSubtitle, { color: theme.textSecondary }]}>
                      {isUrdu
                        ? 'ایہ ریکارڈ تواڈے موبائل وچ محفوظ رہے گا، نیٹ دی لوڑ نہیں۔'
                        : 'This record will be saved on your device.'}
                    </ThemedText>
                  </View>
                </View>
              </AppCard>

              {/* ========================================================= */}
              {/* 3. DATE SELECTION CARD (With Change Action)              */}
              {/* ========================================================= */}
              <AppCard variant="default" padding="md" style={styles.dateCard}>
                <View style={styles.dateRow}>
                  <View style={styles.dateLeft}>
                    <IconBubble icon="calendar" variant="mint" size={36} iconSize={18} />
                    <ThemedText style={styles.dateValue}>
                      {formatReadableDate(date)} {date === todayStr ? (isUrdu ? '· اج دا دن' : '· Today') : ''}
                    </ThemedText>
                  </View>

                  <Pressable
                    onPress={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    accessibilityRole="button"
                    accessibilityLabel="Change Date"
                    style={({ pressed }) => [styles.changeBtn, pressed && styles.pressed]}>
                    <ThemedText style={[styles.changeBtnText, { color: theme.primary }]}>
                      {isDatePickerOpen ? (isUrdu ? 'ہو گیا' : 'Done') : (isUrdu ? 'تاریخ بدلو' : 'Change')}
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Expanded Date Scrubber/Input */}
                {isDatePickerOpen ? (
                  <View style={styles.datePickerExpand}>
                    <View style={styles.quickDateChipsRow}>
                      <Pressable
                        onPress={() => setDate(todayStr)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: date === todayStr }}
                        style={[
                          styles.quickDateChip,
                          date === todayStr && { backgroundColor: theme.primaryLight, borderColor: theme.primary },
                        ]}>
                        <ThemedText
                          style={[
                            styles.quickDateChipText,
                            date === todayStr && { color: theme.primaryDark, fontWeight: '700' },
                          ]}>
                          {isUrdu ? 'اج' : 'Today'}
                        </ThemedText>
                      </Pressable>

                      {(() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        const yStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
                        return (
                          <Pressable
                            onPress={() => setDate(yStr)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: date === yStr }}
                            style={[
                              styles.quickDateChip,
                              date === yStr && { backgroundColor: theme.primaryLight, borderColor: theme.primary },
                            ]}>
                            <ThemedText
                              style={[
                                styles.quickDateChipText,
                                date === yStr && { color: theme.primaryDark, fontWeight: '700' },
                              ]}>
                              {isUrdu ? 'کل (گزشتہ)' : 'Yesterday'}
                            </ThemedText>
                          </Pressable>
                        );
                      })()}
                    </View>

                    <AppTextInput
                      label={isUrdu ? 'مرضی دی تاریخ (YYYY-MM-DD)' : 'Custom Date (YYYY-MM-DD)'}
                      value={date}
                      onChangeText={(t) => {
                        setDate(t);
                        if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                      }}
                      placeholder="YYYY-MM-DD"
                      error={errors.date}
                    />
                  </View>
                ) : null}
              </AppCard>

              {/* ========================================================= */}
              {/* 4. MILKING SESSION (Shift Selector with Checkmarks)      */}
              {/* ========================================================= */}
              <View style={styles.formSection}>
                <ThemedText style={styles.sectionLabel}>
                  {isUrdu ? 'چوئی دی شفٹ' : 'Milking session'}
                </ThemedText>
                <ShiftSelector selectedShift={shift} onSelectShift={setShift} />
              </View>

              {/* ========================================================= */}
              {/* 5. BUYER SELECTION CARD (Matching Screenshot 140503)     */}
              {/* ========================================================= */}
              <View style={styles.formSection}>
                <View style={styles.sectionLabelRow}>
                  <ThemedText style={styles.sectionLabel}>
                    {isUrdu ? 'گاہک / خریدار' : 'Buyer'}
                  </ThemedText>
                  <Pressable
                    onPress={() => setIsBuyerModalOpen(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Add New Buyer"
                    style={({ pressed }) => [styles.newBuyerLink, pressed && styles.pressed]}>
                    <ThemedText style={[styles.newBuyerLinkText, { color: theme.primary }]}>
                      {isUrdu ? '+ نواں گاہک' : '+ New Buyer'}
                    </ThemedText>
                  </Pressable>
                </View>

                {/* Selected Buyer Card */}
                <AppCard
                  variant="default"
                  padding="md"
                  onPress={() => setIsBuyerListOpen(!isBuyerListOpen)}
                  style={styles.buyerCard}>
                  <View style={styles.buyerCardRow}>
                    <View style={styles.buyerLeft}>
                      <IconBubble icon="user" variant="mint" size={38} iconSize={18} />
                      <View style={styles.buyerInfoCol}>
                        <ThemedText style={styles.buyerName} numberOfLines={1}>
                          {chosenBuyer ? chosenBuyer.name : (isUrdu ? 'گاہک منتخب کرو' : 'Select a Buyer')}
                        </ThemedText>
                        <ThemedText style={styles.buyerSubtext} numberOfLines={1}>
                          {chosenBuyer?.phone ? `${chosenBuyer.phone} · ` : ''}
                          {isUrdu ? `ریٹ: Rs ${rate}/لیٹر` : `Default rate - ${currencySymbol} ${rate}/L`}
                        </ThemedText>
                      </View>
                    </View>
                    <AppIcon
                      name={isBuyerListOpen ? 'chevronDown' : 'chevronRight'}
                      size={18}
                      color={theme.textSecondary}
                    />
                  </View>
                </AppCard>
                {errors.buyer ? (
                  <ThemedText style={[styles.fieldError, { color: theme.danger }]}>
                    {errors.buyer}
                  </ThemedText>
                ) : null}

                {/* Dropdown list of buyers if expanded */}
                {isBuyerListOpen ? (
                  <View style={[styles.buyersDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {buyers.map((b) => {
                      const isSelected = chosenBuyer?.id === b.id;
                      return (
                        <Pressable
                          key={b.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => {
                            setUserSelectedBuyerId(b.id);
                            setIsBuyerListOpen(false);
                            if (errors.buyer) setErrors((prev) => ({ ...prev, buyer: '' }));
                          }}
                          style={({ pressed }) => [
                            styles.buyerDropdownItem,
                            isSelected && { backgroundColor: theme.primaryLight },
                            pressed && styles.pressed,
                          ]}>
                          <View style={styles.dropdownItemLeft}>
                            <AppIcon
                              name={isSelected ? 'check' : 'user'}
                              size={16}
                              color={isSelected ? theme.primary : theme.textSecondary}
                            />
                            <ThemedText
                              style={[
                                styles.dropdownBuyerName,
                                isSelected && { color: theme.primaryDark, fontWeight: '700' },
                              ]}>
                              {b.name}
                            </ThemedText>
                          </View>
                          {b.is_default ? (
                            <View style={[styles.defaultBadge, { backgroundColor: theme.backgroundElement }]}>
                              <ThemedText style={[styles.defaultBadgeText, { color: theme.primaryDark }]}>
                                {isUrdu ? 'بنیادی' : 'Default'}
                              </ThemedText>
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}

                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setIsBuyerListOpen(false);
                        setIsBuyerModalOpen(true);
                      }}
                      style={({ pressed }) => [styles.addBuyerDropdownRow, pressed && styles.pressed]}>
                      <AppIcon name="add" size={16} color={theme.primary} />
                      <ThemedText style={[styles.addBuyerDropdownText, { color: theme.primary }]}>
                        {isUrdu ? '+ نواں گاہک اکاؤنٹ درج کرو' : 'Add New Buyer Account'}
                      </ThemedText>
                    </Pressable>
                  </View>
                ) : null}
              </View>

              {/* ========================================================= */}
              {/* 6. QUANTITY & FAT PERCENTAGE ROW (Side by Side)           */}
              {/* ========================================================= */}
              <View style={styles.twoColumnRow}>
                <View style={styles.col}>
                  <AppTextInput
                    label={isUrdu ? 'دودھ دی مقدار' : 'Milk quantity'}
                    required
                    value={liters}
                    onChangeText={(t) => {
                      setLiters(t);
                      if (errors.liters) setErrors((prev) => ({ ...prev, liters: '' }));
                    }}
                    placeholder="65"
                    keyboardType="decimal-pad"
                    unitSuffix={isUrdu ? 'لیٹر' : 'L'}
                    error={errors.liters}
                  />
                </View>

                <View style={styles.col}>
                  <AppTextInput
                    label={isUrdu ? 'فیٹ چکنائی فیصد' : 'Fat percentage'}
                    required
                    value={fat}
                    onChangeText={(t) => {
                      setFat(t);
                      if (errors.fat) setErrors((prev) => ({ ...prev, fat: '' }));
                    }}
                    placeholder="4.5"
                    keyboardType="decimal-pad"
                    unitSuffix="%"
                    error={errors.fat}
                  />
                </View>
              </View>

              {/* Quick Fat % Presets */}
              <View style={styles.quickPresetsRow}>
                <ThemedText style={styles.quickPresetsLabel}>
                  {isUrdu ? 'فوری فیٹ %:' : 'Quick Fat %:'}
                </ThemedText>
                {['3.5', '4.0', '4.5', '5.0', '6.0'].map((fVal) => (
                  <Pressable
                    key={fVal}
                    accessibilityRole="button"
                    accessibilityLabel={`Fat ${fVal}`}
                    accessibilityState={{ selected: fat === fVal }}
                    onPress={() => {
                      setFat(fVal);
                      if (errors.fat) setErrors((prev) => ({ ...prev, fat: '' }));
                    }}
                    style={({ pressed }) => [
                      styles.quickChip,
                      fat === fVal && {
                        backgroundColor: theme.primaryLight,
                        borderColor: theme.primary,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText
                      style={[
                        styles.quickChipText,
                        fat === fVal && { color: theme.primaryDark, fontWeight: '700' },
                      ]}>
                      {fVal}%
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {/* ========================================================= */}
              {/* 7. RATE PER LITER INPUT                                   */}
              {/* ========================================================= */}
              <View style={styles.formSection}>
                <AppTextInput
                  label={isUrdu ? 'ریٹ فی لیٹر (روپے)' : 'Rate per liter'}
                  required
                  value={rate}
                  onChangeText={(t) => {
                    setRate(t);
                    if (errors.rate) setErrors((prev) => ({ ...prev, rate: '' }));
                  }}
                  placeholder="220"
                  keyboardType="decimal-pad"
                  unitSuffix={isUrdu ? 'روپے / لیٹر' : `${currencySymbol} / L`}
                  error={errors.rate}
                />
              </View>

              {/* ========================================================= */}
              {/* 8. CALCULATED SALE AMOUNT CARD (Soft Mint Highlight)      */}
              {/* ========================================================= */}
              <AppCard variant="mint" padding="lg" style={styles.calcCard}>
                <View style={styles.calcHeaderRow}>
                  <View style={styles.calcMainCol}>
                    <ThemedText style={styles.calcLabel}>
                      {isUrdu ? 'کل فروخت دی رقم' : 'Calculated sale amount'}
                    </ThemedText>
                    <ThemedText style={styles.calcBigAmount}>
                      {currencySymbol} {Math.round(liveTotalAmount).toLocaleString()}
                    </ThemedText>
                    <ThemedText style={styles.calcFormula}>
                      {parsedLiters > 0 && parsedRate > 0
                        ? isUrdu
                          ? `${parsedLiters} لیٹر × Rs ${parsedRate}/لیٹر · گاہک دے کھاتے وچ شامل`
                          : `${parsedLiters} L × ${currencySymbol} ${parsedRate}/L · added to buyer's bill`
                        : isUrdu
                          ? 'کل رقم دیکھن لئی مقدار تے ریٹ درج کرو'
                          : `Enter quantity and rate to preview total`}
                    </ThemedText>
                  </View>
                  <IconBubble icon="calculator" variant="mint" size={42} iconSize={22} />
                </View>
              </AppCard>

              {/* ========================================================= */}
              {/* 9. NOTES INPUT (Optional)                                 */}
              {/* ========================================================= */}
              <View style={styles.formSection}>
                <AppTextInput
                  label={isUrdu ? 'کوئی نوٹ یا تفصیل (اختیاری)' : 'Add a note (optional)'}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder={isUrdu ? 'مثلاً صبح دا ٹینکر، خاص گاہک...' : 'e.g. Morning batch, tanker delivery...'}
                  leftIcon={<AppIcon name="print" size={16} color={theme.textMuted} />}
                />
              </View>

              {/* ========================================================= */}
              {/* 10. PRIMARY SAVE ACTION & CAPTION                         */}
              {/* ========================================================= */}
              <View style={styles.actionContainer}>
                <AppButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  title={
                    isSubmitting
                      ? isUrdu
                        ? 'محفوظ ہو رہیا اے...'
                        : 'Saving entry...'
                      : entryToEdit
                        ? isUrdu
                          ? 'تبدیلیاں محفوظ کرو'
                          : 'Save changes'
                        : isUrdu
                          ? 'دودھ محفوظ کرو'
                          : 'Save milk sale'
                  }
                  loading={isSubmitting}
                  icon={<AppIcon name="check" size={18} color="#FFFFFF" />}
                  onPress={handleSave}
                />

                <ThemedText style={styles.saveCaption}>
                  {isUrdu
                    ? 'موبائل وچ فورا محفوظ · انٹرنیٹ آن ہوندیاں ای سنک'
                    : 'Save on device now · sync when connected'}
                </ThemedText>

                <AppButton
                  variant="ghost"
                  size="md"
                  title={isUrdu ? 'منسوخ کرو' : 'Cancel'}
                  onPress={handleClose}
                  style={styles.cancelGhostBtn}
                />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Nested Add Buyer Modal */}
      <AddBuyerModal
        visible={isBuyerModalOpen}
        onClose={() => setIsBuyerModalOpen(false)}
        existingBuyers={buyers}
        onSaveBuyer={async (name, phone, address, isDefault) => {
          await onAddBuyer(name, phone, address, isDefault);
          setIsBuyerModalOpen(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
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
    borderRadius: BorderRadius.sm,
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  modalSubtitle: {
    fontSize: Typography.footnote.fontSize,
    color: '#52665A',
    marginTop: 2,
  },
  helpBtn: {
    padding: 6,
    borderRadius: BorderRadius.full,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge + 20,
    gap: Spacing.md,
  },
  generalErrorCard: {
    marginBottom: -4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },

  // Offline banner
  offlineBanner: {
    borderRadius: BorderRadius.md,
  },
  offlineBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  offlineTextCol: {
    flex: 1,
  },
  offlineBannerTitle: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  offlineBannerSubtitle: {
    fontSize: Typography.footnote.fontSize,
    marginTop: 2,
  },

  // Date Card
  dateCard: {
    borderRadius: BorderRadius.md,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateValue: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '700',
  },
  changeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeBtnText: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '700',
  },
  datePickerExpand: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DFE7E1',
    gap: Spacing.sm,
  },
  quickDateChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  quickDateChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#DFE7E1',
    backgroundColor: '#FFFFFF',
  },
  quickDateChipText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '500',
  },

  // Form Sections
  formSection: {
    gap: Spacing.xs,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
    color: '#52665A',
  },
  newBuyerLink: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  newBuyerLinkText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '700',
  },

  // Buyer Card
  buyerCard: {
    borderRadius: BorderRadius.md,
  },
  buyerCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  buyerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  buyerInfoCol: {
    flex: 1,
  },
  buyerName: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '700',
  },
  buyerSubtext: {
    fontSize: Typography.footnote.fontSize,
    color: '#52665A',
    marginTop: 2,
  },
  fieldError: {
    fontSize: Typography.footnote.fontSize,
    marginTop: 4,
  },
  buyersDropdown: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: 4,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  buyerDropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EFF5F1',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dropdownBuyerName: {
    fontSize: Typography.body.fontSize,
    fontWeight: '500',
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  addBuyerDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F8FAF8',
  },
  addBuyerDropdownText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '700',
  },

  // Two columns (Quantity & Fat)
  twoColumnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  col: {
    flex: 1,
  },

  // Quick Fat Presets
  quickPresetsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: -4,
  },
  quickPresetsLabel: {
    fontSize: Typography.footnote.fontSize,
    color: '#52665A',
    fontWeight: '500',
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#DFE7E1',
    backgroundColor: '#FFFFFF',
  },
  quickChipText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
    color: '#52665A',
  },

  // Calculated Amount Card
  calcCard: {
    borderRadius: BorderRadius.md,
  },
  calcHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calcMainCol: {
    flex: 1,
  },
  calcLabel: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
    color: '#135D38',
  },
  calcBigAmount: {
    fontSize: Typography.title1.fontSize,
    fontWeight: '800',
    color: '#135D38',
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  calcFormula: {
    fontSize: Typography.footnote.fontSize,
    color: '#346A4C',
    fontWeight: '500',
  },

  // Actions
  actionContainer: {
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  saveCaption: {
    fontSize: Typography.footnote.fontSize,
    color: '#8FA095',
    textAlign: 'center',
    marginTop: 4,
  },
  cancelGhostBtn: {
    marginTop: 2,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
