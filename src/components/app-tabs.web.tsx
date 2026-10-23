import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { useSync } from '@/sync';

export default function AppTabs() {
  const { t } = useLanguage();
  const { role } = useSync();
  const procurementOnly = role === 'collector' || role === 'farmer';

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{t('tabHome')}</TabButton>
          </TabTrigger>
          {!procurementOnly && (
            <TabTrigger name="explore" href="/explore" asChild>
              <TabButton>{t('tabMilk')}</TabButton>
            </TabTrigger>
          )}
          {!procurementOnly && (
            <TabTrigger name="buyers" href="/buyers" asChild>
              <TabButton>{t('tabBuyers')}</TabButton>
            </TabTrigger>
          )}
          {/* Herd / Livestock (Maweshi) commented out for now - will be re-enabled in the future
          <TabTrigger name="livestock" href="/livestock" asChild>
            <TabButton>{t('tabHerd')}</TabButton>
          </TabTrigger>
          */}
          <TabTrigger name="more" href={'/more' as never} asChild>
            <TabButton>{t('tabMore')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <ThemedView style={styles.tabListContainer}>
      <ThemedView {...props} style={styles.tabList} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: Spacing.four,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabList: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.one,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    elevation: 4,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.7,
  },
});
