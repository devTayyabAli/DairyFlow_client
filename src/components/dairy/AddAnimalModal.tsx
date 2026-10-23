import React, { useState } from 'react';
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
  useToast,
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  NewLivestockAnimal,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { genderLabel, speciesLabel, statusLabel } from '@/utils/herd-labels';

export interface AddAnimalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (animal: NewLivestockAnimal) => Promise<void>;
}

const SPECIES_OPTIONS: AnimalSpecies[] = ['Cow', 'Buffalo', 'Calf'];
const GENDER_OPTIONS: AnimalGender[] = ['Female', 'Male'];
const ADULT_STATUSES: AnimalStatus[] = ['Lactating', 'Dry', 'Pregnant'];

export function AddAnimalModal({
  visible,
  onClose,
  onSave,
}: AddAnimalModalProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const lang = isUrdu ? 'ur' : 'en';
  const tr = (en: string, ur: string) => (isUrdu ? ur : en);
  const toast = useToast();

  const [tagNumber, setTagNumber] = useState('');
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<AnimalSpecies>('Cow');
  const [gender, setGender] = useState<AnimalGender>('Female');
  const [status, setStatus] = useState<AnimalStatus>('Lactating');
  const [breed, setBreed] = useState('Sahiwal');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setTagNumber('');
    setName('');
    setSpecies('Cow');
    setGender('Female');
    setStatus('Lactating');
    setBreed('Sahiwal');
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  const handleSpeciesChange = (s: AnimalSpecies) => {
    setSpecies(s);
    if (s === 'Cow') {
      setBreed('Sahiwal');
      setStatus('Lactating');
      setGender('Female');
    } else if (s === 'Buffalo') {
      setBreed('Nili Ravi');
      setStatus('Lactating');
      setGender('Female');
    } else {
      setBreed('Crossbred');
      setStatus('Calf');
    }
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!tagNumber.trim()) {
      setError(
        tr(
          'Please enter a tag number (e.g. C-19 or B-13).',
          'ٹیگ نمبر درج کرو (مثلاً C-19 یا B-13)۔'
        )
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        tag_number: tagNumber.trim().toUpperCase(),
        name: name.trim() || undefined,
        species,
        gender,
        status,
        breed: breed.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      resetForm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tr('Failed to register animal.', 'جانور درج نہیں ہو سکیا۔')
      );
      toast.error(tr('Could not register animal', 'جانور درج نہیں ہو سکیا'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={handleClose}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={tr('Close', 'بند کرو')}
        />

        <View style={[styles.sheetContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.headerText}>
              <ThemedText style={styles.modalTitle}>{tr('Add New Animal', 'نواں جانور شامل کرو')}</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {tr('Register cow, buffalo, or calf in herd', 'ریوڑ وچ گائے، بھینس یا بچھڑا درج کرو')}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={saving}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tr('Close', 'بند کرو')}
              style={styles.closeBtn}>
              <AppIcon name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={[styles.errorBox, { backgroundColor: theme.dangerBg }]}>
              <AppIcon name="alert" size={16} color={theme.danger} />
              <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* 1. Species Selection */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {tr('Species', 'قسم')}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                {SPECIES_OPTIONS.map((s) => (
                  <FilterChip
                    key={s}
                    label={isUrdu ? speciesLabel(s, lang) : s === 'Cow' ? 'Cow (Gai)' : s === 'Buffalo' ? 'Buffalo (Bhains)' : 'Calf (Bachra/i)'}
                    selected={species === s}
                    onPress={() => handleSpeciesChange(s)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* 2. Tag Number & Name */}
            <AppTextInput
              label={tr('Tag Number', 'ٹیگ نمبر')}
              required
              placeholder={species === 'Cow' ? 'C-19' : species === 'Buffalo' ? 'B-13' : 'K-10'}
              value={tagNumber}
              onChangeText={(t) => {
                setTagNumber(t);
                if (error) setError(null);
              }}
              autoCapitalize="characters"
            />

            <AppTextInput
              label={tr('Animal Name (Optional)', 'جانور دا ناں (اختیاری)')}
              placeholder={tr('e.g. Rani, Sona, Bhuri', 'مثلاً رانی، سونا، بھوری')}
              value={name}
              onChangeText={setName}
            />

            {/* 3. Gender */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {tr('Gender', 'جنس')}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                {GENDER_OPTIONS.map((g) => (
                  <FilterChip
                    key={g}
                    label={isUrdu ? genderLabel(g, lang) : g === 'Female' ? 'Female (Mada)' : 'Male (Nar)'}
                    selected={gender === g}
                    onPress={() => setGender(g)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* 4. Status */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {tr('Production / Life Status', 'پیداوار / حالت')}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                {species !== 'Calf' ? (
                  ADULT_STATUSES.map((s) => (
                    <FilterChip
                      key={s}
                      label={
                        isUrdu
                          ? statusLabel(s, lang)
                          : s === 'Lactating'
                            ? 'Lactating (Doodh wali)'
                            : s === 'Dry'
                              ? 'Dry (Khushk)'
                              : 'Pregnant (Ghaban)'
                      }
                      selected={status === s}
                      onPress={() => setStatus(s)}
                    />
                  ))
                ) : (
                  <FilterChip
                    label={isUrdu ? statusLabel('Calf', lang) : 'Calf (Bachra)'}
                    selected={status === 'Calf'}
                    onPress={() => setStatus('Calf')}
                  />
                )}
              </ScrollView>
            </View>

            {/* 5. Breed */}
            <AppTextInput
              label={tr('Breed (Nasal)', 'نسل')}
              placeholder={tr(
                'e.g. Sahiwal, Nili Ravi, Cholistani, Friesian',
                'مثلاً ساہیوال، نیلی راوی، چولستانی، فریزین'
              )}
              value={breed}
              onChangeText={setBreed}
            />

            {/* 6. Notes */}
            <AppTextInput
              label={tr('Notes / Origin', 'نوٹس / کتھوں آیا')}
              placeholder={tr('e.g. Purchased from Arifwala Mandi', 'مثلاً عارف والا منڈی توں خریدیا')}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </ScrollView>

          {/* Footer Submit */}
          <View style={[styles.modalFooter, { borderTopColor: theme.border }]}>
            <AppButton
              variant="secondary"
              size="md"
              title={tr('Cancel', 'منسوخ')}
              onPress={handleClose}
              disabled={saving}
              style={styles.cancelBtn}
            />
            <AppButton
              variant="primary"
              size="md"
              title={tr('Register Animal', 'جانور درج کرو')}
              loading={saving}
              onPress={handleSubmit}
              style={styles.submitBtn}
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
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    maxHeight: '88%',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: Typography.footnote.fontSize,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.caption.fontSize,
    fontWeight: '600',
  },
  formScroll: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: Typography.subhead.fontSize,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
});
