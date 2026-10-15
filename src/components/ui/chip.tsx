import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface FilterChipProps {
  label: string;
  count?: number;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FilterChip({
  label,
  count,
  selected = false,
  onPress,
  style,
  testID,
}: FilterChipProps) {
  const theme = useTheme();

  const displayText = count !== undefined ? `${label} · ${count}` : label;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chipBase,
        {
          backgroundColor: selected ? theme.chipSelectedBg : theme.chipBg,
          borderColor: selected ? theme.primaryLight : 'transparent',
        },
        pressed && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.chipText,
          {
            color: selected ? theme.chipSelectedText : theme.chipText,
            fontWeight: selected ? '700' : '500',
          },
        ]}>
        {displayText}
      </Text>
    </Pressable>
  );
}

export interface FilterChipGroupOption {
  key: string;
  label: string;
  count?: number;
}

export interface FilterChipGroupProps {
  options: FilterChipGroupOption[];
  selectedKey: string;
  onSelectKey: (key: string) => void;
  horizontal?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function FilterChipGroup({
  options,
  selectedKey,
  onSelectKey,
  horizontal = true,
  style,
}: FilterChipGroupProps) {
  const content = options.map((opt) => (
    <FilterChip
      key={opt.key}
      label={opt.label}
      count={opt.count}
      selected={selectedKey === opt.key}
      onPress={() => onSelectKey(opt.key)}
    />
  ));

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.groupHorizontal, style]}>
        {content}
      </ScrollView>
    );
  }

  return <View style={[styles.groupWrap, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  chipBase: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: Typography.subhead.fontSize,
  },
  groupHorizontal: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  groupWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
});
