import * as Haptics from 'expo-haptics';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon, SemanticIconName } from './icon';
import { BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  /** Milliseconds on screen. Errors stay a little longer by default. */
  duration?: number;
  /** Optional action shown on the right (e.g. "Retry"). */
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends ToastOptions {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastApi {
  show: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  dismiss: () => void;
}

const DEFAULT_DURATION: Record<ToastType, number> = { success: 2600, info: 3000, error: 4500 };

const ToastContext = createContext<ToastApi | null>(null);

/**
 * One app-wide toast. Replaces the per-screen banners: a new toast replaces the visible one,
 * slides in under the status bar, is announced to screen readers and fades out by itself.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const idRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [anim] = useState(() => new Animated.Value(0));

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setItem(null);
    });
  }, [anim, clearTimer]);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const type = options.type ?? 'info';
      idRef.current += 1;
      setItem({ ...options, id: idRef.current, message, type });

      anim.stopAnimation();
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }).start();

      clearTimer();
      timerRef.current = setTimeout(dismiss, options.duration ?? DEFAULT_DURATION[type]);

      // Light haptic confirmation; never let a missing haptics engine break the flow.
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      AccessibilityInfo.announceForAccessibility(message);
    },
    [anim, clearTimer, dismiss]
  );

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m, o) => show(m, { ...o, type: 'success' }),
      error: (m, o) => show(m, { ...o, type: 'error' }),
      info: (m, o) => show(m, { ...o, type: 'info' }),
      dismiss,
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {item ? <ToastView item={item} anim={anim} onPress={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({ item, anim, onPress }: { item: ToastItem; anim: Animated.Value; onPress: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const palette: Record<ToastType, { bg: string; icon: SemanticIconName }> = {
    success: { bg: theme.primaryDark, icon: 'check' },
    error: { bg: theme.danger, icon: 'alert' },
    info: { bg: theme.text, icon: 'bell' },
  };
  const { bg, icon } = palette[item.type];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + Spacing.sm,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={item.message}
        style={[styles.toast, { backgroundColor: bg }]}>
        <AppIcon name={icon} size={18} color="#FFFFFF" />
        <Text style={styles.message} numberOfLines={3}>
          {item.message}
        </Text>
        {item.actionLabel ? (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            onPress={() => {
              item.onAction?.();
              onPress();
            }}>
            <Text style={styles.action}>{item.actionLabel}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </Pressable>
    </Animated.View>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  message: { flex: 1, color: '#FFFFFF', fontSize: 14, lineHeight: 19, fontWeight: '600' },
  action: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
});
