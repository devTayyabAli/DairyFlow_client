import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/button';
import { AppCard } from '@/components/ui/card';
import { FilterChip } from '@/components/ui/chip';
import { AppIcon, IconBubble } from '@/components/ui/icon';
import { AppTextInput } from '@/components/ui/text-input';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import {
  Expense,
  ExpenseCategory,
  insertExpense,
  NewExpense,
  updateExpense,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Feed',
  'Labour',
  'Veterinary',
  'Transport',
  'Utilities',
  'Maintenance',
  'Other',
];

const FEED_UNITS = ['kg', 'bags', 'bales', 'maund'] as const;
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Credit / Due'] as const;

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSaveExpense?: (expense: NewExpense) => Promise<void>;
  initialCategory?: ExpenseCategory;
  initialDate?: string;
  currencySymbol?: string;
  expenseToEdit?: Expense | null;
  onUpdateExpense?: (id: number, expense: NewExpense) => Promise<void>;
}

export function AddExpenseModal({
  visible,
  onClose,
  onSuccess,
  onSaveExpense,
  initialCategory = 'Feed',
  initialDate,
  currencySymbol = 'Rs',
  expenseToEdit,
  onUpdateExpense,
}: AddExpenseModalProps) {
  const db = useSQLiteContext();
  const theme = useTheme();

  // Local calendar date helper (YYYY-MM-DD)
  const getTodayLocalDate = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = useMemo(() => getTodayLocalDate(), []);

  // Form states
  const [category, setCategory] = useState<ExpenseCategory>(initialCategory);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(initialDate || todayStr);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Feed-specific dynamic states
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<string>('kg');
  const [unitPrice, setUnitPrice] = useState('');

  // Optional metadata states
  const [supplierOrPayee, setSupplierOrPayee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');
  const [notes, setNotes] = useState('');

  // UI / Submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState('');

  // Track prop changes to sync date and prefill when editing
  const [lastSync, setLastSync] = useState<{ visible: boolean; expenseId?: number }>({
    visible: false,
    expenseId: expenseToEdit?.id,
  });

  if (visible !== lastSync.visible || expenseToEdit?.id !== lastSync.expenseId) {
    setLastSync({ visible, expenseId: expenseToEdit?.id });
    if (visible && expenseToEdit) {
      setCategory(expenseToEdit.category);
      setTitle(expenseToEdit.title);
      setAmount(expenseToEdit.amount.toString());
      setDate(expenseToEdit.date);
      setQuantity(expenseToEdit.quantity ? expenseToEdit.quantity.toString() : '');
      setUnit(expenseToEdit.unit || 'kg');
      setUnitPrice(expenseToEdit.unit_price ? expenseToEdit.unit_price.toString() : '');
      setSupplierOrPayee(expenseToEdit.supplier_or_payee || '');
      setPaymentMethod(expenseToEdit.payment_method || 'Cash');
      setNotes(expenseToEdit.notes || '');
    } else if (visible && initialDate) {
      setDate(initialDate);
    }
  }

  const isFeed = category === 'Feed';

  // Handle dynamic feed quantity / unit price auto-calculation
  const handleQuantityChange = (newQty: string) => {
    setQuantity(newQty);
    if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: '' }));

    const parsedQty = parseFloat(newQty);
    const parsedPrice = parseFloat(unitPrice);
    if (!isNaN(parsedQty) && !isNaN(parsedPrice) && parsedQty > 0 && parsedPrice > 0) {
      const calculated = Math.round(parsedQty * parsedPrice).toString();
      setAmount(calculated);
      if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const handleUnitPriceChange = (newPrice: string) => {
    setUnitPrice(newPrice);
    if (errors.unitPrice) setErrors((prev) => ({ ...prev, unitPrice: '' }));

    const parsedQty = parseFloat(quantity);
    const parsedPrice = parseFloat(newPrice);
    if (!isNaN(parsedQty) && !isNaN(parsedPrice) && parsedQty > 0 && parsedPrice > 0) {
      const calculated = Math.round(parsedQty * parsedPrice).toString();
      setAmount(calculated);
      if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
    }
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setQuantity('');
    setUnitPrice('');
    setSupplierOrPayee('');
    setPaymentMethod('Cash');
    setNotes('');
    setIsDatePickerOpen(false);
    setErrors({});
    setGeneralError('');
    setIsSubmitting(false);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    // If user entered significant data, warn before discarding
    if ((title.trim() || amount.trim()) && !isSubmitting) {
      Alert.alert(
        'Discard Expense?',
        'You have unsaved changes. Are you sure you want to discard this expense entry?',
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

  // Form Validation
  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // 1. Date
    if (!date.trim()) {
      newErrors.date = 'Date is required.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      newErrors.date = 'Date must be formatted as YYYY-MM-DD.';
    }

    // 2. Title
    if (!title.trim()) {
      newErrors.title = isFeed
        ? 'Please enter feed or fodder name.'
        : 'Please enter expense title.';
    }

    // 3. Amount
    const parsedAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(parsedAmount)) {
      newErrors.amount = 'Please enter total amount.';
    } else if (parsedAmount <= 0) {
      newErrors.amount = 'Amount must be greater than 0.';
    }

    // 4. Feed-specific validation
    if (isFeed) {
      const parsedQty = parseFloat(quantity);
      const parsedPrice = parseFloat(unitPrice);

      if (quantity.trim()) {
        if (isNaN(parsedQty) || parsedQty <= 0) {
          newErrors.quantity = 'Quantity must be greater than 0.';
        }
      }

      if (unitPrice.trim()) {
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
          newErrors.unitPrice = 'Price must be greater than 0.';
        }
      }

      // Check consistency when both quantity and unit price are given
      if (
        !isNaN(parsedQty) &&
        parsedQty > 0 &&
        !isNaN(parsedPrice) &&
        parsedPrice > 0 &&
        !isNaN(parsedAmount)
      ) {
        const expected = Math.round(parsedQty * parsedPrice);
        if (Math.abs(parsedAmount - expected) > 1.0) {
          newErrors.amount = `Amount (${currencySymbol} ${parsedAmount}) does not match ${parsedQty} ${unit} × ${currencySymbol} ${parsedPrice} (${currencySymbol} ${expected}).`;
        }
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      setGeneralError('Please check highlighted errors.');
      return false;
    }

    setGeneralError('');
    return true;
  };

  // Submit Handler
  const handleSave = async () => {
    if (!validate() || isSubmitting) return;
    Keyboard.dismiss();

    const parsedAmount = parseFloat(amount);
    const parsedQty = quantity.trim() ? parseFloat(quantity) : undefined;
    const parsedPrice = unitPrice.trim() ? parseFloat(unitPrice) : undefined;

    const newExpense: NewExpense = {
      date: date.trim(),
      category,
      title: title.trim(),
      amount: Number(parsedAmount.toFixed(2)),
      quantity: isFeed && parsedQty && parsedQty > 0 ? parsedQty : undefined,
      unit: isFeed && parsedQty ? unit : undefined,
      unit_price: isFeed && parsedPrice && parsedPrice > 0 ? parsedPrice : undefined,
      supplier_or_payee: supplierOrPayee.trim() || undefined,
      payment_method: paymentMethod || 'Cash',
      notes: notes.trim() || undefined,
    };

    try {
      setIsSubmitting(true);
      if (expenseToEdit && onUpdateExpense) {
        await onUpdateExpense(expenseToEdit.id, newExpense);
      } else if (expenseToEdit) {
        await updateExpense(db, expenseToEdit.id, newExpense);
      } else if (onSaveExpense) {
        await onSaveExpense(newExpense);
      } else {
        await insertExpense(db, newExpense);
      }
      resetForm();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setGeneralError(err?.message || 'Failed to save expense record.');
    }
  };

  // Preset quick dates
  const handleSetPresetDate = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    setDate(`${y}-${m}-${day}`);
    setIsDatePickerOpen(false);
    if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}>
          {/* Header Bar */}
          <View style={[styles.headerBar, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable
              onPress={handleClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close add expense modal"
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </Pressable>

            <View style={styles.headerTitleGroup}>
              <ThemedText style={styles.headerTitle}>
                {expenseToEdit ? 'Edit Expense' : 'Add Expense'}
              </ThemedText>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                {isFeed ? 'Feed purchases & fodder' : 'Farm operating expenditure'}
              </ThemedText>
            </View>

            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Layout.bottomTabInset + 75 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {/* Offline Assurance Notice */}
            <AppCard variant="warning" padding="sm" style={styles.offlineNotice}>
              <View style={styles.noticeRow}>
                <AppIcon name="sync" size={13} color={theme.accent} />
                <ThemedText style={[styles.noticeText, { color: theme.accent }]}>
                  Local SQLite Storage · Saved instantly on your device
                </ThemedText>
              </View>
            </AppCard>

            {/* Error Banner */}
            {generalError ? (
              <AppCard variant="default" padding="sm" style={[styles.errorCard, { backgroundColor: theme.dangerBg, borderColor: theme.danger }]}>
                <View style={styles.noticeRow}>
                  <Ionicons name="alert-circle" size={16} color={theme.danger} />
                  <ThemedText style={[styles.errorCardText, { color: theme.danger }]}>
                    {generalError}
                  </ThemedText>
                </View>
              </AppCard>
            ) : null}

            {/* ========================================================= */}
            {/* 1. CATEGORY SELECTOR CHIPS                                */}
            {/* ========================================================= */}
            <AppCard variant="default" padding="md" style={styles.sectionCard}>
              <ThemedText style={[styles.fieldSectionLabel, { color: theme.textSecondary }]}>Expense Category *</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.categoryChipsWrap}>
                {EXPENSE_CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <FilterChip
                      key={cat}
                      label={
                        cat === 'Feed'
                          ? '🌾 Feed & Fodder'
                          : cat === 'Labour'
                          ? '👥 Labour'
                          : cat === 'Veterinary'
                          ? '💊 Veterinary'
                          : cat === 'Transport'
                          ? '🚚 Transport'
                          : cat === 'Utilities'
                          ? '⚡ Utilities'
                          : cat === 'Maintenance'
                          ? '🔧 Maintenance'
                          : '📋 Other'
                      }
                      selected={isSelected}
                      onPress={() => {
                        setCategory(cat);
                        // Clean error state when changing category
                        if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                      }}
                    />
                  );
                })}
              </ScrollView>
            </AppCard>

            {/* ========================================================= */}
            {/* 2. DATE SELECTOR CARD                                     */}
            {/* ========================================================= */}
            <AppCard variant="default" padding="md" style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.labelWithIcon}>
                  <AppIcon name="calendar" size={15} color={theme.primary} />
                  <ThemedText style={[styles.fieldSectionLabel, { color: theme.textSecondary }]}>Expense Date *</ThemedText>
                </View>
                <Pressable
                  onPress={() => setIsDatePickerOpen(!isDatePickerOpen)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.changeDateBtn, pressed && styles.pressed]}>
                  <ThemedText style={[styles.changeDateText, { color: theme.primaryDark }]}>
                    {isDatePickerOpen ? 'Done' : 'Change'}
                  </ThemedText>
                </Pressable>
              </View>

              {/* Quick Presets Row */}
              <View style={styles.dateChipsRow}>
                <FilterChip
                  label="Today"
                  selected={date === todayStr}
                  onPress={() => handleSetPresetDate(0)}
                />
                <FilterChip
                  label="Yesterday"
                  selected={
                    (() => {
                      const y = new Date();
                      y.setDate(y.getDate() - 1);
                      const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                      return date === yStr;
                    })()
                  }
                  onPress={() => handleSetPresetDate(1)}
                />
                <View style={[styles.activeDateBadge, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText style={[styles.activeDateText, { color: theme.primaryDark }]}>
                    📅 {date}
                  </ThemedText>
                </View>
              </View>

              {/* Expandable Manual Date Input */}
              {isDatePickerOpen ? (
                <View style={styles.customDateWrap}>
                  <AppTextInput
                    label="Custom Date (YYYY-MM-DD)"
                    placeholder="YYYY-MM-DD"
                    value={date}
                    onChangeText={(val) => {
                      setDate(val);
                      if (errors.date) setErrors((prev) => ({ ...prev, date: '' }));
                    }}
                    error={errors.date}
                  />
                </View>
              ) : null}
            </AppCard>

            {/* ========================================================= */}
            {/* 3. ITEM TITLE / DESCRIPTION                               */}
            {/* ========================================================= */}
            <AppCard variant="default" padding="md" style={styles.sectionCard}>
              <AppTextInput
                label={isFeed ? 'Feed / Fodder Item *' : 'Expense Title *'}
                placeholder={
                  isFeed
                    ? 'e.g. Wheat straw, Wanda, Silage'
                    : category === 'Labour'
                    ? 'e.g. Farm wages, Milking labour'
                    : category === 'Veterinary'
                    ? 'e.g. HS Vaccine, Doctor checkup'
                    : category === 'Transport'
                    ? 'e.g. Milk delivery diesel, Tractor fuel'
                    : 'e.g. Electricity bill, Machinery repair'
                }
                value={title}
                onChangeText={(val) => {
                  setTitle(val);
                  if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                }}
                error={errors.title}
                leftIcon={
                  isFeed ? (
                    <MaterialCommunityIcons name="barley" size={17} color={theme.textMuted} />
                  ) : (
                    <Ionicons name="receipt-outline" size={17} color={theme.textMuted} />
                  )
                }
                autoCapitalize="words"
              />

              <AppTextInput
                label="Supplier / Vendor / Payee (Optional)"
                placeholder="e.g. Tariq Fodder, Al-Hafiz Feeds, Dr. Usman"
                value={supplierOrPayee}
                onChangeText={setSupplierOrPayee}
                leftIcon={<AppIcon name="user" size={16} color={theme.textMuted} />}
                autoCapitalize="words"
              />
            </AppCard>

            {/* ========================================================= */}
            {/* 4. DYNAMIC FEED QUANTITY & RATE FIELDS (When Feed active) */}
            {/* ========================================================= */}
            {isFeed ? (
              <AppCard variant="default" padding="md" style={styles.sectionCard}>
                <View style={styles.labelWithIcon}>
                  <MaterialCommunityIcons name="scale" size={16} color={theme.primary} />
                  <ThemedText style={[styles.fieldSectionLabel, { color: theme.textSecondary }]}>
                    Quantity & Rate Breakdown (Optional)
                  </ThemedText>
                </View>

                {/* Unit Selector Pills */}
                <View style={styles.unitPillsRow}>
                  <ThemedText style={[styles.unitLabelText, { color: theme.textSecondary }]}>Unit:</ThemedText>
                  {FEED_UNITS.map((u) => (
                    <FilterChip
                      key={u}
                      label={u}
                      selected={unit === u}
                      onPress={() => setUnit(u)}
                    />
                  ))}
                </View>

                {/* Quantity and Unit Price 2-Column Row */}
                <View style={styles.twoColumnRow}>
                  <View style={styles.columnHalf}>
                    <AppTextInput
                      label={`Quantity (${unit})`}
                      placeholder="e.g. 100"
                      value={quantity}
                      onChangeText={handleQuantityChange}
                      keyboardType="decimal-pad"
                      error={errors.quantity}
                    />
                  </View>

                  <View style={styles.columnHalf}>
                    <AppTextInput
                      label={`Rate (${currencySymbol} / ${unit})`}
                      placeholder="e.g. 40"
                      value={unitPrice}
                      onChangeText={handleUnitPriceChange}
                      keyboardType="decimal-pad"
                      error={errors.unitPrice}
                    />
                  </View>
                </View>
              </AppCard>
            ) : null}

            {/* ========================================================= */}
            {/* 5. TOTAL AMOUNT & PAYMENT METHOD                          */}
            {/* ========================================================= */}
            <AppCard variant="default" padding="md" style={styles.sectionCard}>
              <AppTextInput
                label={`Total Amount (${currencySymbol}) *`}
                placeholder="e.g. 4000"
                value={amount}
                onChangeText={(val) => {
                  setAmount(val);
                  if (errors.amount) setErrors((prev) => ({ ...prev, amount: '' }));
                }}
                keyboardType="decimal-pad"
                error={errors.amount}
                leftIcon={<IconBubble icon="cash" variant="mint" size={24} iconSize={13} />}
              />

              {/* Live Preview Card */}
              {amount.trim() && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? (
                <View style={[styles.amountPreviewBanner, { backgroundColor: theme.primaryLight }]}>
                  <ThemedText style={[styles.previewLabel, { color: theme.primaryDark }]}>
                    Recorded Cost:
                  </ThemedText>
                  <ThemedText style={[styles.previewAmount, { color: theme.primaryDark }]}>
                    {currencySymbol} {Math.round(parseFloat(amount)).toLocaleString()}
                  </ThemedText>
                </View>
              ) : null}

              {/* Payment Method Selector */}
              <View style={styles.paymentMethodSection}>
                <ThemedText style={[styles.fieldSectionLabel, { color: theme.textSecondary }]}>Payment Method:</ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.paymentChipsRow}>
                  {PAYMENT_METHODS.map((pm) => (
                    <FilterChip
                      key={pm}
                      label={pm === 'Cash' ? '💵 Cash' : pm === 'Bank Transfer' ? '🏦 Bank' : '⏳ Credit / Due'}
                      selected={paymentMethod === pm}
                      onPress={() => setPaymentMethod(pm)}
                    />
                  ))}
                </ScrollView>
              </View>

              {/* Optional Notes */}
              <AppTextInput
                label="Notes / Receipt Details (Optional)"
                placeholder="e.g. Bilty # 849, Paid by foreman"
                value={notes}
                onChangeText={setNotes}
              />
            </AppCard>

            {/* ========================================================= */}
            {/* 6. ACTION BUTTONS                                         */}
            {/* ========================================================= */}
            <View style={styles.actionButtonsRow}>
              <AppButton
                variant="secondary"
                size="lg"
                title="Cancel"
                onPress={handleClose}
                disabled={isSubmitting}
                style={styles.cancelBtn}
              />

              <AppButton
                variant="primary"
                size="lg"
                title={
                  isSubmitting
                    ? 'Saving...'
                    : expenseToEdit
                      ? 'Save Changes'
                      : 'Save Expense'
                }
                loading={isSubmitting}
                icon={<AppIcon name="check" size={17} color="#FFFFFF" />}
                onPress={handleSave}
                disabled={isSubmitting}
                style={styles.saveBtn}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitleGroup: {
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.bodyBold.fontSize,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: Typography.footnote.fontSize,
  },
  headerRightPlaceholder: {
    width: 44,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  offlineNotice: {
    borderRadius: BorderRadius.sm,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  errorCard: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  errorCardText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  sectionCard: {
    gap: Spacing.sm,
  },
  fieldSectionLabel: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },
  categoryChipsWrap: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  changeDateBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  changeDateText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '700',
  },
  dateChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  activeDateBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
  },
  activeDateText: {
    fontSize: 11,
    fontWeight: '700',
  },
  customDateWrap: {
    marginTop: 4,
  },
  unitPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  unitLabelText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '500',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  columnHalf: {
    flex: 1,
  },
  amountPreviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    marginTop: 2,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewAmount: {
    fontSize: 16,
    fontWeight: '800',
  },
  paymentMethodSection: {
    gap: 4,
    marginTop: 2,
  },
  paymentChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1.6,
  },
});
