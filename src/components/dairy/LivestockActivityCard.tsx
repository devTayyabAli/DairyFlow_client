import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconBubble, SemanticIconName } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { ActivityType, LivestockActivity } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';

export interface LivestockActivityCardProps {
  activity: LivestockActivity;
  isLast?: boolean;
}

function getActivityConfig(type: ActivityType): {
  icon: SemanticIconName;
  variant: 'blue' | 'mint' | 'amber' | 'gray';
} {
  switch (type) {
    case 'Vaccination':
    case 'Treatment':
      return { icon: 'alert', variant: 'blue' };
    case 'Calving':
    case 'Insemination':
      return { icon: 'sprout', variant: 'mint' };
    case 'Deworming':
      return { icon: 'calendar', variant: 'amber' };
    case 'Group Move':
    default:
      return { icon: 'milk', variant: 'mint' };
  }
}

function LivestockActivityCardBase({ activity, isLast = false }: LivestockActivityCardProps) {
  const theme = useTheme();
  const config = getActivityConfig(activity.activity_type);

  return (
    <View
      style={[
        styles.container,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
      <IconBubble icon={config.icon} variant={config.variant} size={36} iconSize={18} />
      <View style={styles.contentWrap}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {activity.title}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
          {activity.animal_tag}
          {activity.notes ? ` · ${activity.notes}` : ''}
        </ThemedText>
      </View>
      <ThemedText style={[styles.dateText, { color: theme.textMuted }]}>{activity.date}</ThemedText>
    </View>
  );
}

export const LivestockActivityCard = memo(LivestockActivityCardBase);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  contentWrap: { flex: 1, gap: 1 },
  title: { fontSize: Typography.subhead.fontSize, fontWeight: '700' },
  subtitle: { fontSize: Typography.footnote.fontSize, fontWeight: '500' },
  dateText: { fontSize: Typography.caption.fontSize, fontWeight: '500' },
});
