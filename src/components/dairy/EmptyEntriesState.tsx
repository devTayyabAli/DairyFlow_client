import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyEntriesStateProps {
  shiftFilter?: string;
  onAddPress: () => void;
}

export function EmptyEntriesState({ shiftFilter = 'All', onAddPress }: EmptyEntriesStateProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={[styles.iconRing, { backgroundColor: theme.primaryLight }]}>
        <MaterialCommunityIcons name="bucket-outline" size={32} color={theme.primary} />
      </View>

      <ThemedText style={styles.title} type="smallBold">
        No Milk Entries Recorded
      </ThemedText>

      <ThemedText style={styles.description}>
        {shiftFilter === 'All'
          ? 'No milk collection records found for this date. Record your Morning or Evening milking shift.'
          : `No ${shiftFilter} shift entries found. Tap below to record this shift.`}
      </ThemedText>

      <Pressable
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel="Add Milk Entry"
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: theme.primary },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="add" size={18} color="#FFFFFF" />
        <ThemedText style={styles.btnText}>Add Milk Entry</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    marginVertical: Spacing.two,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: Spacing.two,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    marginTop: Spacing.two,
    elevation: 2,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.8,
  },
});
