import { Feather, Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';

// ==========================================
// 1. SHIFT BADGE & SHIFT SELECTOR
// ==========================================

export type ShiftType = 'Morning' | 'Evening';

export interface ShiftBadgeProps {
  shift: ShiftType;
  label?: string; // Optional custom text e.g. "90 L - Rs 18,000" or defaults to shift name
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

export function ShiftBadge({ shift, label, size = 'sm', style }: ShiftBadgeProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const isMorning = shift === 'Morning';

  const bg = isMorning ? theme.morningBg : theme.eveningBg;
  const color = isMorning ? theme.morning : theme.evening;
  const icon = isMorning ? 'sun' : 'moon';

  const displayLabel = label ?? (isUrdu ? (isMorning ? 'صبح' : 'شام') : shift);

  return (
    <View
      style={[
        styles.badgeBase,
        { backgroundColor: bg },
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        style,
      ]}>
      <Feather name={icon} size={size === 'sm' ? 12 : 14} color={color} />
      <Text
        style={[
          styles.badgeText,
          { color },
          size === 'sm' ? styles.badgeTextSm : styles.badgeTextMd,
        ]}>
        {displayLabel}
      </Text>
    </View>
  );
}

export interface ShiftSelectorProps {
  selectedShift: ShiftType;
  onSelectShift: (shift: ShiftType) => void;
  style?: StyleProp<ViewStyle>;
}

export function ShiftSelector({ selectedShift, onSelectShift, style }: ShiftSelectorProps) {
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  return (
    <View style={[styles.selectorRow, style]}>
      {/* Morning Button */}
      {(() => {
        const isSelected = selectedShift === 'Morning';
        return (
          <Pressable
            onPress={() => onSelectShift('Morning')}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.selectorItem,
              {
                backgroundColor: isSelected ? theme.morningBg : theme.card,
                borderColor: isSelected ? theme.morning : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <Feather
              name="sun"
              size={18}
              color={isSelected ? theme.morning : theme.textSecondary}
            />
            <Text
              style={[
                styles.selectorText,
                { color: isSelected ? theme.morning : theme.textSecondary },
              ]}>
              {isUrdu ? 'صبح (سویر)' : 'Morning'}
            </Text>
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={18} color={theme.morning} />
            ) : null}
          </Pressable>
        );
      })()}

      {/* Evening Button */}
      {(() => {
        const isSelected = selectedShift === 'Evening';
        return (
          <Pressable
            onPress={() => onSelectShift('Evening')}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            style={({ pressed }) => [
              styles.selectorItem,
              {
                backgroundColor: isSelected ? theme.eveningBg : theme.card,
                borderColor: isSelected ? theme.evening : theme.border,
              },
              pressed && styles.pressed,
            ]}>
            <Feather
              name="moon"
              size={18}
              color={isSelected ? theme.evening : theme.textSecondary}
            />
            <Text
              style={[
                styles.selectorText,
                { color: isSelected ? theme.evening : theme.textSecondary },
              ]}>
              {isUrdu ? 'شام (سنجھ)' : 'Evening'}
            </Text>
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={18} color={theme.evening} />
            ) : null}
          </Pressable>
        );
      })()}
    </View>
  );
}

// ==========================================
// 2. STATUS BADGE
// ==========================================

export type StatusVariant =
  | 'syncPending' // Amber offline/pending indicator
  | 'synced' // Green success indicator
  | 'lactating' // Mint lactating animal badge
  | 'neutral' // Gray meta pill (e.g. Draft)
  | 'danger'; // Red alert pill

export interface StatusBadgeProps {
  label: string;
  variant?: StatusVariant;
  icon?: React.ReactNode;
  showDot?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function StatusBadge({
  label,
  variant = 'neutral',
  icon,
  showDot = false,
  style,
}: StatusBadgeProps) {
  const theme = useTheme();

  const getVariantStyles = (): { bg: string; color: string; dotColor: string } => {
    switch (variant) {
      case 'syncPending':
        return {
          bg: theme.accentBg,
          color: theme.accent,
          dotColor: theme.accent,
        };
      case 'synced':
        return {
          bg: theme.primaryLight,
          color: theme.primaryDark,
          dotColor: theme.primary,
        };
      case 'lactating':
        return {
          bg: theme.backgroundElement,
          color: theme.primaryDark,
          dotColor: theme.primary,
        };
      case 'danger':
        return {
          bg: theme.dangerBg,
          color: theme.danger,
          dotColor: theme.danger,
        };
      case 'neutral':
      default:
        return {
          bg: theme.chipBg,
          color: theme.textSecondary,
          dotColor: theme.textMuted,
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <View style={[styles.statusBadgeBase, { backgroundColor: vStyle.bg }, style]}>
      {showDot ? (
        <View style={[styles.statusDot, { backgroundColor: vStyle.dotColor }]} />
      ) : null}
      {icon ? <View style={styles.statusIconWrap}>{icon}</View> : null}
      <Text style={[styles.statusText, { color: vStyle.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontWeight: '700',
  },
  badgeTextSm: {
    fontSize: Typography.tiny.fontSize,
  },
  badgeTextMd: {
    fontSize: Typography.footnote.fontSize,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  selectorItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  selectorText: {
    fontSize: Typography.bodyMedium.fontSize,
    fontWeight: '700',
  },
  statusBadgeBase: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: Typography.footnote.fontSize,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
