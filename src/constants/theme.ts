/**
 * Dairy Farm Theme tokens:
 * Premium, clean dairy farm management mobile design system.
 * Emerald green and crisp white color scheme with soft mint backgrounds,
 * deep forest featured financial cards, warm amber (Morning) and dusk blue (Evening) shift accents.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Core Backgrounds
    background: '#F4F8F5', // Premium light mint background
    backgroundElement: '#E8F5ED', // Soft mint element surface
    backgroundSelected: '#D7F3E3', // Selected state background
    card: '#FFFFFF', // Clean white rounded cards

    // Featured Card Variants
    cardDark: '#135D38', // Deep forest emerald featured financial card
    cardDarkText: '#FFFFFF',
    cardDarkSubtext: '#A5D6B8',
    cardMint: '#E8F8EE', // Soft mint highlight card
    cardMintBorder: '#C7EED6',
    cardMintText: '#135D38',

    // Borders & Dividers
    border: '#E3EBE5', // Subtle, clean card border
    borderSubtle: '#EFF5F1',
    divider: '#F0F4F1',

    // Text & Typography
    text: '#141F18', // High contrast deep forest slate
    textSecondary: '#52665A', // Calming readable sage slate
    textMuted: '#5F7167', // Placeholder & secondary cues
    textInverse: '#FFFFFF',

    // Brand Primary (Emerald Green)
    primary: '#15803D', // Emerald primary
    primaryDark: '#0F4D2A', // Deep emerald
    primaryLight: '#DCFCE7', // Light emerald tint for pills/icon backgrounds
    primaryContent: '#FFFFFF',

    // Shift Accents
    morning: '#B45309', // Warm amber
    morningBg: '#FEF3C7', // Amber pill background
    morningBorder: '#FDE68A',
    evening: '#1D4ED8', // Dusk blue
    eveningBg: '#EFF6FF', // Blue pill background
    eveningBorder: '#BFDBFE',

    // Status & Utility Accents
    accent: '#B45309', // Alert / warning amber
    accentBg: '#FFFBEB',
    danger: '#B91C1C',
    dangerBg: '#FEE2E2',
    success: '#15803D',
    successBg: '#DCFCE7',
    info: '#0369A1',
    infoBg: '#E0F2FE',

    // Interactive Chips & Tabs
    chipBg: '#F0F4F1',
    chipText: '#52665A',
    chipSelectedBg: '#DDF5E7',
    chipSelectedText: '#135D38',

    // Form Inputs
    inputBg: '#FFFFFF',
    inputBorder: '#DFE7E1',
    inputFocusBorder: '#15803D',
  },
  dark: {
    // Core Backgrounds
    background: '#0D1711',
    backgroundElement: '#14271B',
    backgroundSelected: '#1C3A27',
    card: '#131F17',

    // Featured Card Variants
    cardDark: '#0B3822',
    cardDarkText: '#F8FAFC',
    cardDarkSubtext: '#86EFAC',
    cardMint: '#142E1F',
    cardMintBorder: '#1E4A32',
    cardMintText: '#4ADE80',

    // Borders & Dividers
    border: '#1E3827',
    borderSubtle: '#172B1E',
    divider: '#193021',

    // Text & Typography
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#7C8CA3',
    textInverse: '#0D1711',

    // Brand Primary
    primary: '#22C55E',
    primaryDark: '#166534',
    primaryLight: '#14532D',
    primaryContent: '#FFFFFF',

    // Shift Accents
    morning: '#FBBF24',
    morningBg: '#451A03',
    morningBorder: '#78350F',
    evening: '#38BDF8',
    eveningBg: '#082F49',
    eveningBorder: '#0C4A6E',

    // Status & Utility Accents
    accent: '#F59E0B',
    accentBg: '#3E1C00',
    danger: '#EF4444',
    dangerBg: '#450A0A',
    success: '#4ADE80',
    successBg: '#052E16',
    info: '#38BDF8',
    infoBg: '#082F49',

    // Interactive Chips & Tabs
    chipBg: '#192C20',
    chipText: '#94A3B8',
    chipSelectedBg: '#1C3A27',
    chipSelectedText: '#4ADE80',

    // Form Inputs
    inputBg: '#131F17',
    inputBorder: '#1E3827',
    inputFocusBorder: '#22C55E',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const FontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  heavy: '800' as const,
};

export const Typography = {
  display: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  title1: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  title2: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700' as const,
  },
  title3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  headline: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  bodyBold: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700' as const,
  },
  subhead: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500' as const,
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500' as const,
  },
  tiny: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.2,
  },
} as const;

export const Spacing = {
  // Legacy aliases for backward compatibility
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,

  // Standardized semantic scale
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const BorderRadius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  subtle: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Layout = {
  buttonHeight: {
    sm: 36,
    md: 46,
    lg: 52,
  },
  inputHeight: 48,
  cardRadius: BorderRadius.lg,
  featuredCardRadius: BorderRadius.xl,
  badgeRadius: BorderRadius.full,
  maxContentWidth: MaxContentWidth,
  bottomTabInset: BottomTabInset,
} as const;
