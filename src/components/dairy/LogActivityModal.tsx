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
import { ActivityType, NewLivestockActivity } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import {
  activityTypeLabel,
  defaultActivityTitle,
  isDefaultActivityTitle,
} from '@/utils/herd-labels';

export interface LogActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (activity: NewLivestockActivity) => Promise<void>;
  defaultAnimalTag?: string;
}

const ACTIVITY_TYPES: ActivityType[] = [
  'Vaccination',
  'Deworming',
  'Calving',
  'Insemination',
  'Group Move',
  'Treatment',
];

export function LogActivityModal({
  visible,
  onClose,
  onSave,
  defaultAnimalTag = '',
}: LogActivityModalProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const lang = isUrdu ? 'ur' : 'en';
  const tr = (en: string, ur: string) => (isUrdu ? ur : en);
  const toast = useToast();

  const todayStr = new Date().toISOString().split('T')[0];

  const [animalTag, setAnimalTag] = useState(defaultAnimalTag);
  const [activityType, setActivityType] = useState<ActivityType>('Vaccination');
  const [title, setTitle] = useState(() => defaultActivityTitle('Vaccination', lang));
  const [date, setDate] = useState(todayStr);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivityTypeChange = (type: ActivityType) => {
    setActivityType(type);
    setTitle(defaultActivityTitle(type, lang));
  };

  const resetForm = () => {
    setAnimalTag(defaultAnimalTag);
    setActivityType('Vaccination');
    setTitle(defaultActivityTitle('Vaccination', lang));
    setDate(todayStr);
    setNotes('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (saving) return;
    if (!animalTag.trim()) {
      setError(
        tr(
          'Please specify which animal or tag (e.g. Buffalo B-07 or Cow C-12).',
          'جانور یا ٹیگ دسو (مثلاً Buffalo B-07 یا Cow C-12)۔'
        )
      );
      return;
    }
    if (!title.trim()) {
      setError(tr('Please provide an activity title.', 'سرگرمی دا عنوان لکھو۔'));
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // A suggested title typed in the other language is re-localised so records stay consistent.
      const finalTitle = isDefaultActivityTitle(title.trim())
        ? defaultActivityTitle(activityType, lang)
        : title.trim();

      await onSave({
        animal_tag: animalTag.trim(),
        activity_type: activityType,
        title: finalTitle,
        date: date.trim() || todayStr,
        notes: notes.trim() || undefined,
      });

      resetForm();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : tr('Failed to record activity.', 'سرگرمی درج نہیں ہو سکی۔')
      );
      toast.error(tr('Could not record activity', 'سرگرمی درج نہیں ہو سکی'));
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
              <ThemedText style={styles.modalTitle}>{tr('Log Herd Activity', 'ریوڑ دی سرگرمی درج کرو')}</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {tr(
                  'Vaccinations, treatments, deworming & breeding',
                  'ٹیکے، علاج، کیڑے مار دوا تے نسل کشی'
                )}
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
            {/* 1. Activity Type */}
            <View style={styles.fieldGroup}>
              <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {tr('Activity Type', 'سرگرمی دی قسم')}
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipsRow}>
                {ACTIVITY_TYPES.map((type) => (
                  <FilterChip
                    key={type}
                    label={activityTypeLabel(type, lang)}
                    selected={activityType === type}
                    onPress={() => handleActivityTypeChange(type)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* 2. Animal Tag */}
            <AppTextInput
              label={tr('Animal Tag or Group', 'جانور دا ٹیگ یا گروپ')}
              required
              placeholder={tr(
                'e.g. Buffalo B-07, Cow C-12, or All Calves',
                'مثلاً Buffalo B-07، Cow C-12 یا سارے بچھڑے'
              )}
              value={animalTag}
              onChangeText={(t) => {
                setAnimalTag(t);
                if (error) setError(null);
              }}
            />

            {/* 3. Title */}
            <AppTextInput
              label={tr('Activity Title', 'سرگرمی دا عنوان')}
              required
              placeholder={tr('e.g. HS vaccine administered', 'مثلاً گلہڑ گھوٹو ویکسین لگائی')}
              value={title}
              onChangeText={setTitle}
            />

            {/* 4. Date */}
            <AppTextInput
              label={tr('Date (YYYY-MM-DD)', 'تاریخ (YYYY-MM-DD)')}
              required
              placeholder="YYYY-MM-DD"
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
            />

            {/* 5. Notes */}
            <AppTextInput
              label={tr('Medicine / Doctor / Notes', 'دوائی / ڈاکٹر / نوٹس')}
              placeholder={tr(
                'e.g. Dr. Nadeem · 5ml intramuscular dose',
                'مثلاً ڈاکٹر ندیم · 5 ملی لیٹر ٹیکہ'
              )}
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
              title={tr('Save Activity', 'سرگرمی محفوظ کرو')}
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
  headerText: {
    flex: 1,
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
