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
import { ActivityType, NewLivestockActivity } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface LogActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (activity: NewLivestockActivity) => Promise<void>;
  defaultAnimalTag?: string;
}

export function LogActivityModal({
  visible,
  onClose,
  onSave,
  defaultAnimalTag = '',
}: LogActivityModalProps) {
  const theme = useTheme();

  const todayStr = new Date().toISOString().split('T')[0];

  const [animalTag, setAnimalTag] = useState(defaultAnimalTag);
  const [activityType, setActivityType] = useState<ActivityType>('Vaccination');
  const [title, setTitle] = useState('Vaccination completed');
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivityTypeChange = (type: ActivityType) => {
    setActivityType(type);
    switch (type) {
      case 'Vaccination':
        setTitle('Vaccination completed');
        break;
      case 'Deworming':
        setTitle('Deworming completed');
        break;
      case 'Calving':
        setTitle('New calf registered');
        break;
      case 'Insemination':
        setTitle('Artificial insemination');
        break;
      case 'Treatment':
        setTitle('Medical treatment');
        break;
      case 'Group Move':
        setTitle('Moved to lactating group');
        break;
      case 'Other':
      default:
        setTitle('Herd health check');
        break;
    }
  };

  const resetForm = () => {
    setAnimalTag(defaultAnimalTag);
    setActivityType('Vaccination');
    setTitle('Vaccination completed');
    setDate(todayStr);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!animalTag.trim()) {
      setError('Please specify which animal or tag (e.g. Buffalo B-07 or Cow C-12).');
      return;
    }
    if (!title.trim()) {
      setError('Please provide an activity title.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      await onSave({
        animal_tag: animalTag.trim(),
        activity_type: activityType,
        title: title.trim(),
        date: date.trim() || todayStr,
        notes: notes.trim() || undefined,
      });

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record activity.');
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
              <ThemedText style={styles.modalTitle}>Log Herd Activity</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                Vaccinations, treatments, deworming & breeding
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
            {/* 1. Activity Type */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Activity Type</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                <FilterChip
                  label="Vaccination"
                  selected={activityType === 'Vaccination'}
                  onPress={() => handleActivityTypeChange('Vaccination')}
                />
                <FilterChip
                  label="Deworming"
                  selected={activityType === 'Deworming'}
                  onPress={() => handleActivityTypeChange('Deworming')}
                />
                <FilterChip
                  label="Calving"
                  selected={activityType === 'Calving'}
                  onPress={() => handleActivityTypeChange('Calving')}
                />
                <FilterChip
                  label="Insemination"
                  selected={activityType === 'Insemination'}
                  onPress={() => handleActivityTypeChange('Insemination')}
                />
                <FilterChip
                  label="Group Move"
                  selected={activityType === 'Group Move'}
                  onPress={() => handleActivityTypeChange('Group Move')}
                />
                <FilterChip
                  label="Treatment"
                  selected={activityType === 'Treatment'}
                  onPress={() => handleActivityTypeChange('Treatment')}
                />
              </ScrollView>
            </View>

            {/* 2. Animal Tag */}
            <AppTextInput
              label="Animal Tag or Group *"
              placeholder="e.g. Buffalo B-07, Cow C-12, or All Calves"
              value={animalTag}
              onChangeText={(t) => {
                setAnimalTag(t);
                if (error) setError(null);
              }}
            />

            {/* 3. Title */}
            <AppTextInput
              label="Activity Title *"
              placeholder="e.g. HS vaccine administered"
              value={title}
              onChangeText={setTitle}
            />

            {/* 4. Date */}
            <AppTextInput
              label="Date (YYYY-MM-DD) *"
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
            />

            {/* 5. Notes */}
            <AppTextInput
              label="Medicine / Doctor / Notes"
              placeholder="e.g. Dr. Nadeem · 5ml intramuscular dose"
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
              title="Save Activity"
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
