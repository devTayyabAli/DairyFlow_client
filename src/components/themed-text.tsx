import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, FontWeights, ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'display'
    | 'title1'
    | 'title2'
    | 'title3'
    | 'headline'
    | 'body'
    | 'bodyMedium'
    | 'bodyBold'
    | 'subhead'
    | 'footnote'
    | 'caption'
    | 'tiny';
  themeColor?: ThemeColor;
  weight?: keyof typeof FontWeights;
  color?: string;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  weight,
  color,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  const textColor = color ?? (themeColor ? theme[themeColor] : theme.text);
  const fontWeight = weight ? FontWeights[weight] : undefined;

  return (
    <Text
      style={[
        { color: textColor },
        styles[type],
        fontWeight ? { fontWeight } : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  // Legacy types
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  title: {
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: '600',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#15803D',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },

  // Semantic Typography scale matching design references
  display: Typography.display,
  title1: Typography.title1,
  title2: Typography.title2,
  title3: Typography.title3,
  headline: Typography.headline,
  body: Typography.body,
  bodyMedium: Typography.bodyMedium,
  bodyBold: Typography.bodyBold,
  subhead: Typography.subhead,
  footnote: Typography.footnote,
  caption: Typography.caption,
  tiny: Typography.tiny,
});
