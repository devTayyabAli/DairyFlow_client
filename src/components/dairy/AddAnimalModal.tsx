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
} from '@/components/ui';
import { BorderRadius, Shadows, Spacing, Typography } from '@/constants/theme';
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  NewLivestockAnimal,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface AddAnimalModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (animal: NewLivestockAnimal) => Promise<void>;
}

export function AddAnimalModal({
  visible,
  onClose,
  onSave,
}: AddAnimalModalProps) {
  const theme = useTheme();

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
    if (!tagNumber.trim()) {
      setError('Please enter a tag number (e.g. C-19 or B-13).');
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

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register animal.');
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
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={[styles.sheetContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View>
              <ThemedText style={styles.modalTitle}>Add New Animal</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Register cow, buffalo, or calf in herd
              </ThemedText>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.closeBtn}>
              <AppIcon name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerBg }]}>
              <AppIcon name="alert" size={16} color={theme.danger} />
              <ThemedText style={[styles.errorText, { color: theme.danger }]}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.formScroll}
            showsVerticalScrollIndicator={false}>
            {/* 1. Species Selection */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Species</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                <FilterChip
                  label="Cow (Gai)"
                  selected={species === 'Cow'}
                  onPress={() => handleSpeciesChange('Cow')}
                />
                <FilterChip
                  label="Buffalo (Bhains)"
                  selected={species === 'Buffalo'}
                  onPress={() => handleSpeciesChange('Buffalo')}
                />
                <FilterChip
                  label="Calf (Bachra/i)"
                  selected={species === 'Calf'}
                  onPress={() => handleSpeciesChange('Calf')}
                />
              </ScrollView>
            </View>

            {/* 2. Tag Number & Name */}
            <AppTextInput
              label="Tag Number *"
              placeholder={species === 'Cow' ? 'C-19' : species === 'Buffalo' ? 'B-13' : 'K-10'}
              value={tagNumber}
              onChangeText={(t) => {
                setTagNumber(t);
                if (error) setError(null);
              }}
              autoCapitalize="characters"
            />

            <AppTextInput
              label="Animal Name (Optional)"
              placeholder="e.g. Rani, Sona, Bhuri"
              value={name}
              onChangeText={setName}
            />

            {/* 3. Gender */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Gender</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                <FilterChip
                  label="Female (Mada)"
                  selected={gender === 'Female'}
                  onPress={() => setGender('Female')}
                />
                <FilterChip
                  label="Male (Nar)"
                  selected={gender === 'Male'}
                  onPress={() => setGender('Male')}
                />
              </ScrollView>
            </View>

            {/* 4. Status */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Production / Life Status</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                {species !== 'Calf' ? (
                  <>
                    <FilterChip
                      label="Lactating (Doodh wali)"
                      selected={status === 'Lactating'}
                      onPress={() => setStatus('Lactating')}
                    />
                    <FilterChip
                      label="Dry (Khushk)"
                      selected={status === 'Dry'}
                      onPress={() => setStatus('Dry')}
                    />
                    <FilterChip
                      label="Pregnant (Ghaban)"
                      selected={status === 'Pregnant'}
                      onPress={() => setStatus('Pregnant')}
                    />
                  </>
                ) : (
                  <FilterChip
                    label="Calf (Bachra)"
                    selected={status === 'Calf'}
                    onPress={() => setStatus('Calf')}
                  />
                )}
              </ScrollView>
            </View>

            {/* 5. Breed */}
            <AppTextInput
              label="Breed (Nasal)"
              placeholder="e.g. Sahiwal, Nili Ravi, Cholistani, Friesian"
              value={breed}
              onChangeText={setBreed}
            />

            {/* 6. Notes */}
            <AppTextInput
              label="Notes / Origin"
              placeholder="e.g. Purchased from Arifwala Mandi"
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
              title="Cancel"
              onPress={handleClose}
              style={styles.cancelBtn}
            />
            <AppButton
              variant="primary"
              size="md"
              title="Register Animal"
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
