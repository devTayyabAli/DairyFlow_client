import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppCard, AppIcon, IconBubble } from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { getLedgerEntries, getMilkCollections, getSuppliers, MilkCollection, Supplier } from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { formatCsvRow } from '@/utils/csv-export';
import { statementForPeriod } from '@/utils/supplier-statement';
import { getFridayToThursdayWeek } from '@/utils/week-cycle';

type Period = 'today' | 'week' | 'month';

function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rangeFor(period: Period): { start: string; end: string } {
  if (period === 'today') {
    const today = localDate();
    return { start: today, end: today };
  }
  if (period === 'week') {
    const week = getFridayToThursdayWeek();
    return { start: week.startDate, end: week.endDate };
  }
  const now = new Date();
  return {
    start: localDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export default function CollectionReportScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { farm, role } = useSync();
  const userId = farm?.userId || '';
  const [period, setPeriod] = useState<Period>('today');
  const [personId, setPersonId] = useState<number | 'all'>('all');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [rows, setRows] = useState<MilkCollection[]>([]);
  const [bill, setBill] = useState('');

  const range = useMemo(() => rangeFor(period), [period]);

  const load = useCallback(async () => {
    const all = await getSuppliers(db, 'active');
    const visible = role === 'farmer' ? all.filter((supplier) => supplier.linked_farm_id === userId) : all;
    const entries = await getMilkCollections(db, {
      startDate: range.start,
      endDate: range.end,
      collectorId: role === 'collector' ? userId : undefined,
    });
    const ids = new Set(visible.map((supplier) => supplier.id));
    const visibleRows = role === 'farmer' ? entries.filter((entry) => ids.has(entry.supplier_id)) : entries;
    setSuppliers(visible);
    setRows(visibleRows);
    const billSupplier = role === 'farmer' ? visible[0] : personId === 'all' ? null : visible.find((supplier) => supplier.id === personId);
    if (!billSupplier || role === 'collector') {
      setBill('');
      return;
    }
    const week = getFridayToThursdayWeek();
    const milk = await getMilkCollections(db, { supplierId: billSupplier.id });
    const ledger = await getLedgerEntries(db, { accountType: 'supplier', accountId: billSupplier.id });
    const line = (row: { date: string; entry_type: string; amount: number }) => ({
      date: row.date,
      entryType: row.entry_type,
      amount: row.amount,
    });
    const result = statementForPeriod(
      milk.filter((row) => row.date < week.startDate).reduce((sum, row) => sum + row.total_amount, 0),
      ledger.filter((row) => row.date < week.startDate).map(line),
      milk.filter((row) => row.date >= week.startDate && row.date <= week.endDate).reduce((sum, row) => sum + row.total_amount, 0),
      ledger.filter((row) => row.date >= week.startDate && row.date <= week.endDate).map(line)
    );
    setBill(
      `${billSupplier.name} · ${week.label}\n${isUrdu ? 'پچھلا' : 'Opening'} Rs ${result.opening} · ${isUrdu ? 'دودھ' : 'Milk'} Rs ${result.milk} · ${isUrdu ? 'ادائیگی' : 'Paid'} Rs ${result.payments} · ${isUrdu ? 'باقی' : 'Remaining'} Rs ${result.closing}`
    );
  }, [db, isUrdu, personId, range.end, range.start, role, userId]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) load().catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [load]);

  const shown = personId === 'all' ? rows : rows.filter((entry) => entry.supplier_id === personId);
  const totals = useMemo(() => {
    let liters = 0;
    let amount = 0;
    let fatWeighted = 0;
    for (const entry of shown) {
      liters += entry.liters;
      amount += entry.total_amount;
      fatWeighted += entry.fat_percentage * entry.liters;
    }
    return {
      liters: Math.round(liters * 10) / 10,
      amount: Math.round(amount),
      fat: liters > 0 ? Math.round((fatWeighted / liters) * 10) / 10 : 0,
      count: shown.length,
    };
  }, [shown]);

  const periods: { id: Period; en: string; ur: string }[] = [
    { id: 'today', en: 'Today', ur: 'آج' },
    { id: 'week', en: 'This week', ur: 'یہ ہفتہ' },
    { id: 'month', en: 'This month', ur: 'یہ مہینہ' },
  ];

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={[styles.iconBtn, { borderColor: theme.border }]}>
          <AppIcon name="chevronLeft" size={18} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText style={styles.title}>{isUrdu ? 'دودھ رپورٹ' : 'Milk report'}</ThemedText>
          <ThemedText style={{ color: theme.textSecondary }}>
            {range.start === range.end ? range.start : `${range.start} – ${range.end}`}
          </ThemedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chips}>
          {periods.map((item) => {
            const selected = period === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setPeriod(item.id)}
                style={[
                  styles.chip,
                  { borderColor: theme.border, backgroundColor: selected ? theme.primary : theme.card },
                ]}>
                <ThemedText style={{ color: selected ? '#fff' : theme.text, fontWeight: '700' }}>
                  {isUrdu ? item.ur : item.en}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {role === 'owner' && suppliers.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Pressable
              onPress={() => setPersonId('all')}
              style={[
                styles.chip,
                { borderColor: theme.border, backgroundColor: personId === 'all' ? theme.primary : theme.card },
              ]}>
              <ThemedText style={{ color: personId === 'all' ? '#fff' : theme.text, fontWeight: '700' }}>
                {isUrdu ? 'سب' : 'Everyone'}
              </ThemedText>
            </Pressable>
            {suppliers.map((supplier) => {
              const selected = personId === supplier.id;
              return (
                <Pressable
                  key={supplier.id}
                  onPress={() => setPersonId(supplier.id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border, backgroundColor: selected ? theme.primary : theme.card },
                  ]}>
                  <ThemedText style={{ color: selected ? '#fff' : theme.text, fontWeight: '700' }}>
                    {supplier.name}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {bill ? (
          <AppCard>
            <ThemedText>{bill}</ThemedText>
          </AppCard>
        ) : null}

        <View style={styles.metrics}>
          <Metric label={isUrdu ? 'لیٹر' : 'Liters'} value={String(totals.liters)} />
          <Metric label={isUrdu ? 'اوسط فیٹ' : 'Avg fat'} value={`${totals.fat}%`} />
          <Metric label={isUrdu ? 'رقم' : 'Amount'} value={`Rs ${totals.amount.toLocaleString()}`} />
        </View>
        <View style={styles.metrics}>
          <Metric
            label={isUrdu ? 'صبح' : 'Morning'}
            value={String(shown.filter((entry) => entry.shift === 'Morning').reduce((sum, entry) => sum + entry.liters, 0))}
          />
          <Metric
            label={isUrdu ? 'شام' : 'Evening'}
            value={String(shown.filter((entry) => entry.shift === 'Evening').reduce((sum, entry) => sum + entry.liters, 0))}
          />
        </View>
        <Pressable
          onPress={() => {
            const csv = [
              formatCsvRow(['Date', 'Shift', 'Supplier', 'Collector', 'Liters', 'Fat', 'Rate', 'Amount']),
              ...shown.map((entry) =>
                formatCsvRow([
                  entry.date,
                  entry.shift,
                  entry.supplier_name,
                  entry.collector_name || '',
                  entry.liters,
                  entry.fat_percentage,
                  entry.rate_per_liter,
                  entry.total_amount,
                ])
              ),
            ].join('\r\n');
            Share.share({ message: csv }).catch(() => {});
          }}>
          <ThemedText style={{ color: theme.primary, fontWeight: '700' }}>
            {isUrdu ? 'CSV شیئر کرو' : 'Share CSV'}
          </ThemedText>
        </Pressable>

        {shown.length === 0 ? (
          <AppCard>
            <View style={styles.empty}>
              <IconBubble icon="milk" variant="mint" />
              <ThemedText style={{ color: theme.textSecondary, textAlign: 'center' }}>
                {isUrdu ? 'اس مدت میں کوئی دودھ درج نہیں۔' : 'No milk was recorded in this period.'}
              </ThemedText>
            </View>
          </AppCard>
        ) : (
          shown.map((entry) => (
            <AppCard key={entry.id} padding="md">
              <ThemedText style={styles.entryTitle}>
                {entry.supplier_name} · {entry.shift === 'Morning' ? (isUrdu ? 'صبح' : 'Morning') : isUrdu ? 'شام' : 'Evening'}
              </ThemedText>
              <ThemedText style={{ color: theme.textSecondary }}>
                {entry.date}
                {entry.collector_name ? ` · ${entry.collector_name}` : ''}
              </ThemedText>
              <ThemedText style={styles.entryAmount}>
                {entry.liters} L · {entry.fat_percentage}% · Rs {Math.round(entry.total_amount).toLocaleString()}
              </ThemedText>
            </AppCard>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <AppCard padding="md" style={styles.metric}>
      <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>{label}</ThemedText>
      <ThemedText style={styles.metricValue}>{value}</ThemedText>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontSize: Typography.title2.fontSize, fontWeight: '700' },
  content: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: Layout.bottomTabInset + 24 },
  chips: { flexDirection: 'row', gap: Spacing.xs },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: BorderRadius.full, paddingHorizontal: 14, paddingVertical: 8 },
  metrics: { flexDirection: 'row', gap: Spacing.xs },
  metric: { flex: 1 },
  metricValue: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  entryTitle: { fontWeight: '700' },
  entryAmount: { marginTop: 4, fontWeight: '600' },
});
