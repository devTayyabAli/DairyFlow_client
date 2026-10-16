import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BRAND_DARK } from '@/components/animated-icon';
import { LanguageToggleButton } from '@/components/ui';

interface AuthHeroProps {
  title: string;
  subtitle?: string;
  compact?: boolean;
}

/** Dark-green brand header used at the top of the login and setup screens. */
export function AuthHero({ title, subtitle, compact = false }: AuthHeroProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.hero, { paddingTop: insets.top + 12 }, compact && styles.heroCompact]}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <Image
            source={require('@/assets/images/dairyflow-logo.png')}
            style={styles.brandLogo}
            contentFit="cover"
          />
          <Text style={styles.brandName}>DairyFlow</Text>
        </View>
        <LanguageToggleButton />
      </View>

      <View style={[styles.copy, compact && styles.copyCompact]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: BRAND_DARK,
    paddingHorizontal: 24,
    paddingBottom: 56,
  },
  heroCompact: {
    paddingBottom: 44,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  copy: {
    marginTop: 36,
    gap: 6,
  },
  copyCompact: {
    marginTop: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    color: '#A7D7B8',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
