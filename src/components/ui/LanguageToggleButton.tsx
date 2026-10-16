import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

export function LanguageToggleButton() {
  const { isUrdu, setLanguage } = useLanguage();
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      {/* Urdu Option */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="اردو منتخب کریں"
        accessibilityState={{ selected: isUrdu }}
        hitSlop={{ top: 8, bottom: 8 }}
        onPress={() => setLanguage('ur')}
        style={[
          styles.segment,
          isUrdu && [styles.activeSegment, { backgroundColor: theme.primary }],
        ]}>
        <ThemedText
          style={[
            styles.segmentText,
            { color: isUrdu ? '#FFFFFF' : theme.textSecondary },
            isUrdu && styles.activeText,
          ]}>
          اردو
        </ThemedText>
      </Pressable>

      {/* English Option */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select English"
        accessibilityState={{ selected: !isUrdu }}
        hitSlop={{ top: 8, bottom: 8 }}
        onPress={() => setLanguage('en')}
        style={[
          styles.segment,
          !isUrdu && [styles.activeSegment, { backgroundColor: theme.primary }],
        ]}>
        <ThemedText
          style={[
            styles.segmentText,
            { color: !isUrdu ? '#FFFFFF' : theme.textSecondary },
            !isUrdu && styles.activeText,
          ]}>
          ENG
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    padding: 2,
  },
  segment: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  activeSegment: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    fontWeight: '700',
  },
});
