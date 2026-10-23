import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useSync } from '@/sync';

export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const { t } = useLanguage();
  const { role } = useSync();
  const procurementOnly = role === 'collector' || role === 'farmer';

  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.primaryLight}
      iconColor={{ default: colors.textMuted, selected: colors.primary }}
      labelStyle={{
        default: { color: colors.textMuted },
        selected: { color: colors.primary },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabHome')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md="home"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore" hidden={procurementOnly}>
        <NativeTabs.Trigger.Label>{t('tabMilk')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'drop', selected: 'drop.fill' }}
          md="water_drop"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="buyers" hidden={procurementOnly}>
        <NativeTabs.Trigger.Label>{t('tabBuyers')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md="group"
        />
      </NativeTabs.Trigger>

      {/* Herd / Livestock (Maweshi) commented out for now - will be re-enabled in the future
      <NativeTabs.Trigger name="livestock">
        <NativeTabs.Trigger.Label>{t('tabHerd')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'pawprint', selected: 'pawprint.fill' }}
          md="pets"
        />
      </NativeTabs.Trigger>
      */}

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>{t('tabMore')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }}
          md="more_horiz"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
