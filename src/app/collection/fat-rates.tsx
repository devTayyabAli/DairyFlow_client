import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, AppTextInput, useToast } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { deactivateFatBand, listFatBands, saveFatBand, type FatBandRow } from '@/db/procurement';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function FatRatesScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { role } = useSync();
  const toast = useToast();
  const [rows, setRows] = useState<FatBandRow[]>([]);
  const [minFat, setMinFat] = useState('4');
  const [maxFat, setMaxFat] = useState('6');
  const [rate, setRate] = useState('180');
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState('');
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    setRows(await listFatBands(db));
  }, [db]);

  useEffect(() => {
    let active = true;
    listFatBands(db)
      .then((next) => {
        if (active) setRows(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db]);

  if (role && role !== 'owner' && role !== 'manager') {
    return <Redirect href="/collection" />;
  }

  const save = async () => {
    const min = Number(minFat);
    const max = Number(maxFat);
    const rateValue = Number(rate);
    if (!(min >= 0) || !(max >= min) || !(rateValue > 0) || !DATE.test(from) || (to && !DATE.test(to))) {
      toast.info(isUrdu ? 'حد، ریٹ اور تاریخ درست کرو' : 'Check the fat range, rate, and dates.');
      return;
    }
    try {
      await saveFatBand(db, {
        minFat: min,
        maxFat: max,
        ratePerLiter: rateValue,
        effectiveFrom: from,
        effectiveTo: to || null,
        label: label.trim() || null,
      });
      toast.success(isUrdu ? 'ریٹ محفوظ ہو گیا' : 'Rate saved');
      await load();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === 'BAND_CONFLICT'
          ? isUrdu
            ? 'یہ حد کسی فعال ریٹ سے ٹکراتی ہے'
            : 'This range overlaps another active rate.'
          : isUrdu
            ? 'محفوظ نہیں ہوا'
            : 'Could not save the rate'
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.title}>{isUrdu ? 'فیٹ ریٹ ٹیبل' : 'Fat rate table'}</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={{ color: theme.textSecondary }}>
          {isUrdu
            ? 'دونوں سرے شامل ہیں۔ 4.0 صرف ایک بینڈ کا ہو سکتا ہے۔ خالی جگہ کا ریٹ نہیں لگایا جاتا۔ پرانی وصولی کی رقم نہیں بدلتی۔'
            : 'Both ends are included. 4.0 can belong to only one band. A gap has no rate. Saved collections keep their amount.'}
        </ThemedText>
        <AppCard>
          <AppTextInput value={label} onChangeText={setLabel} placeholder={isUrdu ? 'نام' : 'Label'} />
          <AppTextInput value={minFat} onChangeText={setMinFat} keyboardType="decimal-pad" placeholder={isUrdu ? 'کم سے کم فیٹ' : 'Minimum fat'} />
          <AppTextInput value={maxFat} onChangeText={setMaxFat} keyboardType="decimal-pad" placeholder={isUrdu ? 'زیادہ سے زیادہ فیٹ' : 'Maximum fat'} />
          <AppTextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder={isUrdu ? 'فی لیٹر ریٹ' : 'Rate per liter'} />
          <AppTextInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" autoCapitalize="none" />
          <AppTextInput value={to} onChangeText={setTo} placeholder={isUrdu ? 'اختتامی تاریخ، خالی = کھلا' : 'End date, blank = open'} autoCapitalize="none" />
          <AppButton title={isUrdu ? 'ریٹ شامل کرو' : 'Add rate'} onPress={save} />
        </AppCard>
        {rows.map((row) => (
          <AppCard key={row.id}>
            <ThemedText style={{ fontWeight: '700' }}>
              {row.label || `${row.min_fat}–${row.max_fat}%`} · Rs {row.rate_per_liter}/L
            </ThemedText>
            <ThemedText style={{ color: theme.textSecondary }}>
              {row.min_fat}% – {row.max_fat}% · {row.effective_from}
              {row.effective_to ? ` – ${row.effective_to}` : ''} · {row.active ? (isUrdu ? 'فعال' : 'Active') : isUrdu ? 'بند' : 'Inactive'}
            </ThemedText>
            {row.active === 1 && (
              <AppButton
                title={isUrdu ? 'بند کرو' : 'Deactivate'}
                variant="secondary"
                onPress={async () => {
                  await deactivateFatBand(db, row.id);
                  await load();
                }}
              />
            )}
          </AppCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  title: { fontSize: Typography.title2.fontSize, fontWeight: '700' },
  content: { padding: Spacing.md, gap: Spacing.sm },
});
