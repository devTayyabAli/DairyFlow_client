import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { BorderRadius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SemanticIconName =
  | 'sprout'
  | 'milk'
  | 'cow'
  | 'calf'
  | 'buffalo'
  | 'wallet'
  | 'cash'
  | 'calendar'
  | 'bell'
  | 'search'
  | 'filter'
  | 'user'
  | 'users'
  | 'add'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'calculator'
  | 'chart'
  | 'feed'
  | 'print'
  | 'share'
  | 'sync'
  | 'phone'
  | 'check'
  | 'close'
  | 'settings'
  | 'lock'
  | 'edit'
  | 'home'
  | 'logout'
  | 'alert';

export interface AppIconProps {
  name: SemanticIconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppIcon({ name, size = 20, color, style }: AppIconProps) {
  const theme = useTheme();
  const iconColor = color ?? theme.text;

  const renderIcon = () => {
    switch (name) {
      case 'sprout':
        return <MaterialCommunityIcons name="sprout-outline" size={size} color={iconColor} />;
      case 'milk':
        return <MaterialCommunityIcons name="cup-water" size={size} color={iconColor} />;
      case 'cow':
        return <MaterialCommunityIcons name="cow" size={size} color={iconColor} />;
      case 'calf':
        return <MaterialCommunityIcons name="paw-outline" size={size} color={iconColor} />;
      case 'buffalo':
        return <MaterialCommunityIcons name="shield-cross-outline" size={size} color={iconColor} />;
      case 'wallet':
        return <Ionicons name="wallet-outline" size={size} color={iconColor} />;
      case 'cash':
        return <Ionicons name="cash-outline" size={size} color={iconColor} />;
      case 'calendar':
        return <Ionicons name="calendar-outline" size={size} color={iconColor} />;
      case 'bell':
        return <Ionicons name="notifications-outline" size={size} color={iconColor} />;
      case 'search':
        return <Feather name="search" size={size} color={iconColor} />;
      case 'filter':
        return <Feather name="filter" size={size} color={iconColor} />;
      case 'user':
        return <Feather name="user" size={size} color={iconColor} />;
      case 'users':
        return <Feather name="users" size={size} color={iconColor} />;
      case 'add':
        return <Feather name="plus" size={size} color={iconColor} />;
      case 'chevronRight':
        return <Feather name="chevron-right" size={size} color={iconColor} />;
      case 'chevronLeft':
        return <Feather name="chevron-left" size={size} color={iconColor} />;
      case 'chevronDown':
        return <Feather name="chevron-down" size={size} color={iconColor} />;
      case 'calculator':
        return <Ionicons name="calculator-outline" size={size} color={iconColor} />;
      case 'chart':
        return <Feather name="trending-up" size={size} color={iconColor} />;
      case 'feed':
        return <MaterialCommunityIcons name="barley" size={size} color={iconColor} />;
      case 'print':
        return <Ionicons name="print-outline" size={size} color={iconColor} />;
      case 'share':
        return <Ionicons name="share-social-outline" size={size} color={iconColor} />;
      case 'sync':
        return <Ionicons name="sync-outline" size={size} color={iconColor} />;
      case 'phone':
        return <Feather name="phone" size={size} color={iconColor} />;
      case 'check':
        return <Feather name="check" size={size} color={iconColor} />;
      case 'close':
        return <Feather name="x" size={size} color={iconColor} />;
      case 'settings':
        return <Ionicons name="settings-outline" size={size} color={iconColor} />;
      case 'lock':
        return <Ionicons name="lock-closed-outline" size={size} color={iconColor} />;
      case 'edit':
        return <Feather name="edit-2" size={size} color={iconColor} />;
      case 'home':
        return <Feather name="home" size={size} color={iconColor} />;
      case 'logout':
        return <Ionicons name="log-out-outline" size={size} color={iconColor} />;
      case 'alert':
        return <Ionicons name="alert-circle-outline" size={size} color={iconColor} />;
    }
  };

  return <View style={style}>{renderIcon()}</View>;
}

// ==========================================
// ICON BUBBLE (TINTED CONTAINER)
// ==========================================

export type IconBubbleVariant = 'mint' | 'amber' | 'blue' | 'gray' | 'dark';
export type IconBubbleShape = 'rounded' | 'circle';

export interface IconBubbleProps {
  children?: React.ReactNode;
  icon?: SemanticIconName;
  variant?: IconBubbleVariant;
  shape?: IconBubbleShape;
  size?: number; // width & height in px, defaults to 38
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconBubble({
  children,
  icon,
  variant = 'mint',
  shape = 'rounded',
  size = 38,
  iconSize = 20,
  style,
}: IconBubbleProps) {
  const theme = useTheme();

  const getVariantColors = (): { bg: string; fg: string } => {
    switch (variant) {
      case 'amber':
        return { bg: theme.morningBg, fg: theme.morning };
      case 'blue':
        return { bg: theme.eveningBg, fg: theme.evening };
      case 'gray':
        return { bg: theme.chipBg, fg: theme.textSecondary };
      case 'dark':
        return { bg: theme.cardDark, fg: theme.cardDarkText };
      case 'mint':
      default:
        return { bg: theme.primaryLight, fg: theme.primaryDark };
    }
  };

  const colors = getVariantColors();
  const radius = shape === 'circle' ? size / 2 : BorderRadius.md;

  return (
    <View
      style={[
        styles.bubbleBase,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.bg,
        },
        style,
      ]}>
      {icon ? <AppIcon name={icon} size={iconSize} color={colors.fg} /> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  bubbleBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
