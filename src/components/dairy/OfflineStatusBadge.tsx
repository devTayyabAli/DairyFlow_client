import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

export interface OfflineStatusBadgeProps {
  compact?: boolean;
  onPress?: () => void;
}

export function OfflineStatusBadge({ compact = false, onPress }: OfflineStatusBadgeProps) {
  const theme = useTheme();
  const { t } = useLanguage();
  const { status, pendingCount } = useSync();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/more/cloud-sync' as never);
    }
  };

  const isOffline = status === 'offline';
  const isSyncing = status === 'syncing';
  const hasPending = pendingCount > 0;

  let label = t('syncStatusSynced');
  let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'cloud-done-outline';
  let badgeBg: string = theme.primaryLight;
  let badgeBorder: string = theme.primary;
  let textColor: string = theme.primaryDark;
  let dotColor: string = theme.success;

  if (isOffline) {
    label = t('syncStatusOffline');
    iconName = 'cloud-offline-outline';
    badgeBg = theme.accentBg;
    badgeBorder = theme.morningBorder;
    textColor = theme.accent;
    dotColor = theme.accent;
  } else if (isSyncing) {
    label = t('syncStatusSyncing');
    iconName = 'sync-outline';
    badgeBg = theme.backgroundSelected;
    badgeBorder = theme.info;
    textColor = theme.info;
    dotColor = theme.info;
  } else if (hasPending) {
    label = `${pendingCount} ${t('syncStatusPending')}`;
    iconName = 'cloud-upload-outline';
    badgeBg = theme.morningBg;
    badgeBorder = theme.morning;
    textColor = theme.morning;
    dotColor = theme.morning;
  }

  if (compact) {
    return (
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [
          styles.compactBadge,
          {
            backgroundColor: badgeBg,
            borderColor: badgeBorder,
          },
          pressed && { opacity: 0.75 },
        ]}>
        <Ionicons name={iconName} size={12} color={textColor} />
        <ThemedText style={[styles.compactText, { color: textColor }]}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }

  let fullLabel = 'Synced • Local SQLite';
  if (isOffline) {
    fullLabel = 'Offline • Local SQLite';
  } else if (isSyncing) {
    fullLabel = 'Syncing with Cloud…';
  } else if (hasPending) {
    fullLabel = `${pendingCount} pending • Local SQLite`;
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={fullLabel}
      style={({ pressed }) => [
        styles.badge,
        { backgroundColor: theme.backgroundElement },
        pressed && { opacity: 0.75 },
      ]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Ionicons
        name={iconName}
        size={12}
        color={textColor}
        style={styles.icon}
      />
      <ThemedText style={[styles.text, { color: theme.primaryDark }]} type="small">
        {fullLabel}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
    gap: 6,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 4,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  icon: {
    marginRight: -2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});

