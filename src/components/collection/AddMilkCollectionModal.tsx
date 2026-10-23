import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
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
  insertMilkCollection,
  MilkCollection,
  NewMilkCollection,
  ShiftType,
  Supplier,
} from '@/db/database';
import { listFatBands, toFatBand, updateMilkCollection } from '@/db/procurement';
import { useTheme } from '@/hooks/use-theme';
import { quoteCollection, type FatBand } from '@/utils/fat-bands';
import { formatRate } from '@/utils/fat-pricing';
import { lineAmount } from '@/utils/money';
import { logger } from '@/utils/logger';

interface AddMilkCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  initialSupplier?: Supplier | null;
  suppliers: Supplier[];
  selectedDate: string;
  selectedShift: ShiftType;
  collectionToEdit?: MilkCollection | null;
  collectorUserId?: string;
  collectorName?: string;
}

export function AddMilkCollectionModal({
  visible,
  onClose,
  onSave,
  initialSupplier,
  suppliers,
  selectedDate,
  selectedShift,
  collectionToEdit,
  collectorUserId,
  collectorName,
}: AddMilkCollectionModalProps) {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const toast = useToast();

  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(
    initialSupplier?.id ?? collectionToEdit?.supplier_id ?? (suppliers[0]?.id || null)
  );
  const [shift, setShift] = useState<ShiftType>(
    collectionToEdit?.shift ?? selectedShift ?? 'Morning'
  );
  const [litersText, setLitersText] = useState<string>(
    collectionToEdit ? String(collectionToEdit.liters) : ''
  );
  const [fatText, setFatText] = useState<string>(
    collectionToEdit ? String(collectionToEdit.fat_percentage) : '6.0'
  );
  const [notes, setNotes] = useState<string>(collectionToEdit?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [bands, setBands] = useState<FatBand[]>([]);

  useEffect(() => {
    if (!visible) return;
    const supplierId = collectionToEdit?.supplier_id ?? initialSupplier?.id ?? suppliers[0]?.id ?? null;
    const nextShift = collectionToEdit?.shift ?? selectedShift ?? 'Morning';
    const nextLiters = collectionToEdit ? String(collectionToEdit.liters) : '';
    const nextFat = collectionToEdit ? String(collectionToEdit.fat_percentage) : '6.0';
    const nextNotes = collectionToEdit?.notes || '';
    queueMicrotask(() => {
      setSelectedSupplierId(supplierId);
      setShift(nextShift);
      setLitersText(nextLiters);
      setFatText(nextFat);
      setNotes(nextNotes);
    });
  }, [visible, collectionToEdit, initialSupplier, selectedShift, suppliers]);

  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId) || initialSupplier || null;
  }, [suppliers, selectedSupplierId, initialSupplier]);

  useEffect(() => {
    if (!visible) return;
    listFatBands(db)
      .then((rows) => setBands(rows.map(toFatBand)))
      .catch(() => setBands([]));
  }, [db, visible]);

  const liters = parseFloat(litersText) || 0;
  const fat = parseFloat(fatText) || 0;
  const sameFatAsSaved =
    !!collectionToEdit && Math.abs(collectionToEdit.fat_percentage - fat) < 0.0001;
  const priced = useMemo(() => {
    if (sameFatAsSaved && collectionToEdit) {
      return {
        ok: true as const,
        rate: collectionToEdit.rate_per_liter,
        amount: lineAmount(liters, collectionToEdit.rate_per_liter),
        bandUuid: collectionToEdit.pricing_band_uuid || null,
        kept: true,
      };
    }
    const quote = quoteCollection(bands, selectedDate, fat, liters > 0 ? liters : 1);
    if (!quote.ok) return { ok: false as const, reason: quote.reason, kept: false };
    return {
      ok: true as const,
      rate: quote.rate,
      amount: liters > 0 ? quote.amount : 0,
      bandUuid: quote.band.uuid,
      kept: false,
    };
  }, [bands, collectionToEdit, fat, liters, sameFatAsSaved, selectedDate]);

  const addLiters = (amount: number) => {
    const current = parseFloat(litersText) || 0;
    setLitersText(String(Math.max(0, current + amount)));
  };

  const adjustFat = (delta: number) => {
    const current = parseFloat(fatText) || 6.0;
    const next = Math.max(0, Math.min(15, current + delta));
    setFatText(next.toFixed(1));
  };

  const handleSave = async (shareSlip: boolean = false) => {
    if (!currentSupplier) {
      toast.info(isUrdu ? 'مہربانی کر کے سپلائر منتخب کرو' : 'Please select a supplier');
      return;
    }
    if (liters <= 0) {
      toast.info(isUrdu ? 'دودھ دی مقدار درج کرو' : 'Please enter valid milk liters');
      return;
    }
    if (fat <= 0 || fat > 15) {
      toast.info(isUrdu ? 'فیٹ 0 سے 15 کے درمیان ہونا چاہیے' : 'Fat must be between 0 and 15');
      return;
    }
    if (!priced.ok) {
      const message =
        priced.reason === 'ambiguous'
          ? isUrdu
            ? 'دو ریٹ ملے ہیں۔ مالک ریٹ ٹیبل درست کرے'
            : 'Two rates match this fat. The owner must fix the rate table.'
          : isUrdu
            ? 'اس فیٹ کا کوئی ریٹ نہیں۔ اندازہ نہیں لگایا گیا'
            : 'No fat rate covers this fat. A rate was not guessed.';
      toast.info(message);
      return;
    }

    setSaving(true);
    try {
      if (collectionToEdit) {
        await updateMilkCollection(db, collectionToEdit.id, {
          liters,
          fat,
          rate: priced.rate,
          total: priced.amount,
          bandUuid: priced.bandUuid,
          notes: notes.trim() || null,
          actorId: collectorUserId || null,
        });
      } else {
        const entry: NewMilkCollection = {
          date: selectedDate,
          shift,
          supplier_id: currentSupplier.id,
          supplier_name: currentSupplier.name,
          liters,
          fat_percentage: fat,
          rate_per_liter: priced.rate,
          total_amount: priced.amount,
          collector_id: collectorUserId || null,
          collector_name: collectorName || null,
          pricing_band_uuid: priced.bandUuid,
          collected_at: new Date().toISOString(),
          notes: notes.trim() || null,
        };
        await insertMilkCollection(db, entry);
      }
      toast.success(
        isUrdu
          ? `${currentSupplier.name}: ${liters}L دودھ محفوظ ہو گیا!`
          : `Saved ${liters}L collection for ${currentSupplier.name}!`
      );
      onSave();
      onClose();

      if (shareSlip) {
        const shiftLabel = shift === 'Morning' ? (isUrdu ? 'صبح' : 'Morning') : (isUrdu ? 'شام' : 'Evening');
        const msg = [
          `🥛 *DairyFlow دودھ وصولی پرچی (Milk Slip)*`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `👤 *کسان / سپلائر:* ${currentSupplier.name}`,
          currentSupplier.village ? `📍 *مقام / پنڈ:* ${currentSupplier.village}` : '',
          `📅 *تاریخ:* ${selectedDate} (${shiftLabel})`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `🥛 *دودھ:* ${liters} L`,
          `🧪 *فیٹ:* ${fat}%`,
          `🏷️ *ریٹ:* Rs ${priced.ok ? formatRate(priced.rate) : '—'} / L`,
          `💵 *کل رقم:* Rs ${priced.ok ? priced.amount.toLocaleString() : '—'}`,
          `━━━━━━━━━━━━━━━━━━━━`,
          `_DairyFlow Dodhi Route Portal_`,
        ]
          .filter(Boolean)
          .join('\n');

        try {
          const cleanPhone = currentSupplier.phone ? currentSupplier.phone.replace(/[^0-9]/g, '') : '';
          const url = cleanPhone
            ? `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`
            : `whatsapp://send?text=${encodeURIComponent(msg)}`;

          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            await Share.share({ message: msg });
          }
        } catch {
          await Share.share({ message: msg });
        }
      }
    } catch (err) {
      logger.error('Failed to save milk collection:', err);
      if (err instanceof Error && err.message === 'DUPLICATE_SHIFT') {
        toast.info(
          isUrdu
            ? 'اس ڈیری کی اس شفٹ کی وصولی پہلے سے موجود ہے'
            : 'This dairy already has a collection for this shift.'
        );
      } else {
        toast.error(isUrdu ? 'محفوظ نہیں ہو سکیا' : 'Failed to save collection');
      }
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
              <IconBubble icon="milk" variant="mint" size={38} iconSize={18} />
              <View>
                <ThemedText style={styles.modalTitle}>
                  {collectionToEdit
                    ? isUrdu
                      ? 'دودھ وصولی درست کرو'
                      : 'Edit Milk Collection'
                    : isUrdu
                    ? 'دودھ دی وصولی درج کرو'
                    : 'Record Milk Collection'}
                </ThemedText>
                <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  {selectedDate} · {shift === 'Morning' ? (isUrdu ? 'صبح' : 'Morning') : (isUrdu ? 'شام' : 'Evening')}
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
            {/* Shift Selector */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'شفٹ (Shift)' : 'Shift'}
              </ThemedText>
              <View style={[styles.shiftRow, { backgroundColor: theme.backgroundElement }]}>
                <Pressable
                  onPress={() => setShift('Morning')}
                  style={[
                    styles.shiftTab,
                    shift === 'Morning' && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText
                    style={[
                      styles.shiftTabText,
                      { color: shift === 'Morning' ? '#FFF' : theme.textSecondary },
                    ]}>
                    ☀️ {isUrdu ? 'صبح (Morning)' : 'Morning'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setShift('Evening')}
                  style={[
                    styles.shiftTab,
                    shift === 'Evening' && { backgroundColor: theme.primary },
                  ]}>
                  <ThemedText
                    style={[
                      styles.shiftTabText,
                      { color: shift === 'Evening' ? '#FFF' : theme.textSecondary },
                    ]}>
                    🌙 {isUrdu ? 'شام (Evening)' : 'Evening'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Supplier Selector */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'دودھ سپلائر (Milk Supplier)' : 'Milk Supplier'}
              </ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {suppliers.map((s) => {
                  const isSelected = s.id === selectedSupplierId;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSelectedSupplierId(s.id)}
                      style={[
                        styles.supplierChip,
                        {
                          backgroundColor: isSelected ? theme.primary : theme.backgroundElement,
                          borderColor: isSelected ? theme.primary : theme.border,
                        },
                      ]}>
                      <ThemedText
                        style={[
                          styles.supplierChipText,
                          { color: isSelected ? '#FFF' : theme.text },
                        ]}>
                        {s.name}
                      </ThemedText>
                      {s.village ? (
                        <ThemedText
                          style={[
                            styles.supplierChipSub,
                            { color: isSelected ? 'rgba(255,255,255,0.8)' : theme.textMuted },
                          ]}>
                          {s.village}
                        </ThemedText>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Liters Input & Quick Chips */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'دودھ دی مقدار (Liters)' : 'Milk Quantity (Liters)'}
              </ThemedText>
              <View style={[styles.inputContainer, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <TextInput
                  value={litersText}
                  onChangeText={setLitersText}
                  keyboardType="numeric"
                  placeholder="0.0"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.bigInput, { color: theme.text }]}
                />
                <ThemedText style={[styles.inputSuffix, { color: theme.textSecondary }]}>
                  {isUrdu ? 'لیٹر (L)' : 'Liters'}
                </ThemedText>
              </View>
              {/* Quick Increment Chips */}
              <View style={styles.quickChipsRow}>
                {[5, 10, 20, 40].map((amt) => (
                  <Pressable
                    key={amt}
                    onPress={() => addLiters(amt)}
                    style={[styles.quickChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                    <ThemedText style={[styles.quickChipText, { color: theme.text }]}>
                      +{amt}L
                    </ThemedText>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setLitersText('')}
                  style={[styles.quickChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={[styles.quickChipText, { color: theme.danger }]}>
                    {isUrdu ? 'صاف' : 'Clear'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {/* Fat Percentage Input & Presets */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'فیٹ فیصد (Fat %)' : 'Fat Percentage (%)'}
              </ThemedText>
              <View style={styles.fatControlRow}>
                <Pressable
                  onPress={() => adjustFat(-0.1)}
                  style={[styles.stepButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={[styles.stepButtonText, { color: theme.text }]}>−</ThemedText>
                </Pressable>
                <View style={[styles.fatInputWrap, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <TextInput
                    value={fatText}
                    onChangeText={setFatText}
                    keyboardType="numeric"
                    placeholder="6.0"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.fatInput, { color: theme.text }]}
                  />
                  <ThemedText style={[styles.fatPercentLabel, { color: theme.textSecondary }]}>%</ThemedText>
                </View>
                <Pressable
                  onPress={() => adjustFat(0.1)}
                  style={[styles.stepButton, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={[styles.stepButtonText, { color: theme.text }]}>+</ThemedText>
                </Pressable>
              </View>

              {/* Standard Fat Presets */}
              <View style={styles.quickChipsRow}>
                {[5.5, 6.0, 6.5, 7.0].map((fVal) => (
                  <Pressable
                    key={fVal}
                    onPress={() => setFatText(fVal.toFixed(1))}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: fatText === fVal.toFixed(1) ? theme.primaryLight : theme.backgroundElement,
                        borderColor: fatText === fVal.toFixed(1) ? theme.primary : theme.border,
                      },
                    ]}>
                    <ThemedText
                      style={[
                        styles.quickChipText,
                        { color: fatText === fVal.toFixed(1) ? theme.primary : theme.text },
                      ]}>
                      {fVal.toFixed(1)}%
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Live Pricing Summary Box */}
            <View
              style={[
                styles.calculationCard,
                { backgroundColor: theme.primaryLight, borderColor: theme.primary },
              ]}>
              <View style={styles.calcRow}>
                <ThemedText style={[styles.calcLabel, { color: theme.textSecondary }]}>
                  {isUrdu ? 'لاگو ریٹ (Rate applied):' : 'Applied Rate:'}
                </ThemedText>
                <ThemedText style={[styles.calcValue, { color: theme.text }]}>
                  {priced.ok ? `Rs ${formatRate(priced.rate)} / L` : isUrdu ? 'ریٹ نہیں' : 'No rate'}
                </ThemedText>
              </View>
              <View style={styles.calcDivider} />
              <View style={styles.calcRow}>
                <ThemedText style={[styles.calcTotalLabel, { color: theme.text }]}>
                  {isUrdu ? 'کل رقم (Total Amount):' : 'Total Amount:'}
                </ThemedText>
                <ThemedText style={[styles.calcTotalValue, { color: theme.primary }]}>
                  {priced.ok ? `Rs ${priced.amount.toLocaleString()}` : '—'}
                </ThemedText>
              </View>
              <ThemedText style={{ color: theme.textSecondary, marginTop: 8, fontSize: 12 }}>
                {priced.ok && priced.kept
                  ? isUrdu
                    ? 'یہ پرانا ریٹ محفوظ ہے۔ نیا ریٹ ٹیبل اس رقم کو نہیں بدلتا۔'
                    : 'This keeps the rate already saved. A later rate change does not rewrite it.'
                  : isUrdu
                    ? 'ریٹ اس فون کے فیٹ ٹیبل سے ہے۔ اگر مالک نے آف لائن تبدیلی کی تو سنک اسے جائزے میں رکھے گا، اندازہ نہیں لگائے گا۔'
                    : 'This rate is from the fat table on this phone. If the owner changed it while you were offline, sync keeps the entry for review instead of guessing.'}
              </ThemedText>
            </View>

            {/* Optional Notes */}
            <View style={styles.fieldSection}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {isUrdu ? 'نوٹس (اختیاری)' : 'Notes (Optional)'}
              </ThemedText>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={isUrdu ? 'کوئی نوٹ یا کین نمبر لکھو...' : 'Optional notes or container ID...'}
                placeholderTextColor={theme.textMuted}
                style={[styles.notesInput, { backgroundColor: theme.backgroundElement, borderColor: theme.border, color: theme.text }]}
              />
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
            <Pressable
              disabled={saving}
              onPress={() => handleSave(true)}
              style={({ pressed }) => [
                styles.whatsappShareBtn,
                { opacity: pressed || saving ? 0.8 : 1 },
              ]}>
              <ThemedText style={styles.whatsappShareText}>
                {saving ? '...' : (isUrdu ? '💬 محفوظ + پرچی' : '💬 Save & Slip')}
              </ThemedText>
            </Pressable>
            <AppButton
              title={saving ? (isUrdu ? '...' : '...') : (isUrdu ? 'محفوظ (Save)' : 'Save')}
              variant="primary"
              loading={saving}
              onPress={() => handleSave(false)}
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
    maxHeight: '92%',
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
  fieldSection: {
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  shiftRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 3,
  },
  shiftTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  shiftTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginHorizontal: -Spacing.xs,
  },
  supplierChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  supplierChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  supplierChipSub: {
    fontSize: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  bigInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
  },
  inputSuffix: {
    fontSize: 15,
    fontWeight: '600',
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
    fontSize: 12,
    fontWeight: '600',
  },
  fatControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: {
    fontSize: 24,
    fontWeight: '700',
  },
  fatInputWrap: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  fatInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  fatPercentLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  calculationCard: {
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
  calcDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginVertical: Spacing.xs,
  },
  calcTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  calcTotalValue: {
    fontSize: 22,
    fontWeight: '800',
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
  whatsappShareBtn: {
    flex: 1.5,
    backgroundColor: '#25D366',
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  whatsappShareText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  saveBtn: {
    flex: 1.2,
  },
});
