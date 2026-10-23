import { Redirect, Stack } from 'expo-router';

import { useSync } from '@/sync';

export default function BuyersLayout() {
  const { role } = useSync();
  if (role === 'collector' || role === 'farmer') return <Redirect href="/collection" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
