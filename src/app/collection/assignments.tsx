import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppCard, AppIcon, useToast } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { getSuppliers, Supplier } from '@/db/database';
import { assignedSupplierIds, setCollectorAssignment } from '@/db/procurement';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { getAuthToken } from '@/sync/sync-storage';

interface Member {
  userId: string;
  name: string;
  role: string;
  status: string;
}

export default function AssignmentsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { role, apiUrl } = useSync();
  const toast = useToast();
  const [collectors, setCollectors] = useState<Member[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [assigned, setAssigned] = useState<Set<number>>(new Set());

  const loadAssigned = useCallback(
    async (collectorId: string) => {
      setAssigned(await assignedSupplierIds(db, collectorId));
    },
    [db]
  );

  useEffect(() => {
    getSuppliers(db, 'active').then(setSuppliers).catch(() => {});
    (async () => {
      const token = await getAuthToken();
      if (!token) return;
      const res = await fetch(`${apiUrl}/tenants/members`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const body = (await res.json()) as { members: Member[] };
      const dodhis = body.members.filter((member) => member.role === 'collector' && member.status !== 'suspended');
      setCollectors(dodhis);
      if (dodhis[0]) {
        setSelected(dodhis[0].userId);
        await loadAssigned(dodhis[0].userId);
      }
    })().catch(() => {});
  }, [apiUrl, db, loadAssigned]);

  if (role && role !== 'owner' && role !== 'manager') return <Redirect href="/collection" />;

  const toggle = async (supplierId: number) => {
    if (!selected) return;
    const next = !assigned.has(supplierId);
    try {
      await setCollectorAssignment(db, selected, supplierId, next);
      await loadAssigned(selected);
    } catch {
      toast.error(isUrdu ? 'تفویض محفوظ نہیں ہوئی' : 'Could not save the assignment');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.title}>{isUrdu ? 'ڈیری تفویض' : 'Assign dairies'}</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={{ color: theme.textSecondary }}>
          {isUrdu
            ? 'دودھی صرف وہ ڈیریاں دیکھتا ہے جو آپ نے اسے دیں۔'
            : 'A dodhi sees only the dairies you assign.'}
        </ThemedText>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {collectors.map((collector) => (
            <Pressable key={collector.userId} onPress={() => { setSelected(collector.userId); loadAssigned(collector.userId).catch(() => {}); }}>
              <ThemedText style={{ fontWeight: '700', color: selected === collector.userId ? theme.primary : theme.text }}>
                {collector.name || collector.userId}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        {collectors.length === 0 && (
          <ThemedText style={{ color: theme.textSecondary }}>
            {isUrdu ? 'پہلے دودھی کا اکاؤنٹ بناؤ' : 'Create a dodhi account first.'}
          </ThemedText>
        )}
        {suppliers.map((supplier) => {
          const on = assigned.has(supplier.id);
          return (
            <Pressable key={supplier.id} onPress={() => toggle(supplier.id)}>
              <AppCard>
                <ThemedText style={{ fontWeight: '700' }}>
                  {on ? '✓ ' : ''}
                  {supplier.name}
                </ThemedText>
              </AppCard>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  title: { fontSize: Typography.title2.fontSize, fontWeight: '700' },
  content: { padding: Spacing.md, gap: Spacing.sm },
});
