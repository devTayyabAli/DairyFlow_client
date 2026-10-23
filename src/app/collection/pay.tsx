import { Redirect, router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { AppButton, AppCard, AppIcon, AppTextInput, useToast } from '@/components/ui';
import { Spacing, Typography } from '@/constants/theme';
import { useLanguage } from '@/context/language-context';
import { getLedgerEntries, getMilkCollections, getSuppliers, Supplier } from '@/db/database';
import { recordSupplierPayment } from '@/db/procurement';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/sync';
import { statementForPeriod } from '@/utils/supplier-statement';
import { getFridayToThursdayWeek } from '@/utils/week-cycle';

export default function PaySupplierScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();
  const { role } = useSync();
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [statement, setStatement] = useState<string>('');
  const week = getFridayToThursdayWeek();

  const loadStatement = useCallback(
    async (id: number) => {
      const milk = await getMilkCollections(db, { supplierId: id });
      const ledger = await getLedgerEntries(db, { accountType: 'supplier', accountId: id });
      const priorMilk = milk.filter((row) => row.date < week.startDate).reduce((sum, row) => sum + row.total_amount, 0);
      const periodMilk = milk
        .filter((row) => row.date >= week.startDate && row.date <= week.endDate)
        .reduce((sum, row) => sum + row.total_amount, 0);
      const toLine = (row: { date: string; entry_type: string; amount: number }) => ({
        date: row.date,
        entryType: row.entry_type,
        amount: row.amount,
      });
      const priorLedger = ledger.filter((row) => row.date < week.startDate).map(toLine);
      const periodLedger = ledger.filter((row) => row.date >= week.startDate && row.date <= week.endDate).map(toLine);
      const result = statementForPeriod(priorMilk, priorLedger, periodMilk, periodLedger);
      setStatement(
        `${week.label}\n${isUrdu ? 'پچھلا بیلنس' : 'Opening'} Rs ${result.opening}\n${isUrdu ? 'دودھ' : 'Milk'} Rs ${result.milk}\n${isUrdu ? 'ادائیگی' : 'Payments'} Rs ${result.payments}\n${isUrdu ? 'باقی' : 'Remaining'} Rs ${result.closing}`
      );
    },
    [db, isUrdu, week.endDate, week.label, week.startDate]
  );

  useEffect(() => {
    getSuppliers(db, 'active').then((rows) => {
      setSuppliers(rows);
      if (rows[0]) {
        setSupplierId(rows[0].id);
        loadStatement(rows[0].id).catch(() => {});
      }
    }).catch(() => {});
  }, [db, loadStatement]);

  if (role && role !== 'owner' && role !== 'manager') return <Redirect href="/collection" />;

  const pay = async () => {
    const supplier = suppliers.find((item) => item.id === supplierId);
    const value = Number(amount);
    if (!supplier || !(value > 0)) {
      toast.info(isUrdu ? 'ڈیری اور رقم چنو' : 'Choose a dairy and an amount.');
      return;
    }
    try {
      await recordSupplierPayment(db, {
        supplierId: supplier.id,
        supplierName: supplier.name,
        amount: value,
        date: new Date().toISOString().slice(0, 10),
        method,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      });
      setAmount('');
      setReference('');
      toast.success(isUrdu ? 'ادائیگی محفوظ ہو گئی' : 'Payment saved');
      await loadStatement(supplier.id);
    } catch (err) {
      toast.error(
        err instanceof Error && err.message === 'DUPLICATE_PAYMENT'
          ? isUrdu
            ? 'یہ ریفرنس پہلے استعمال ہو چکا'
            : 'That reference was already used.'
          : isUrdu
            ? 'ادائیگی محفوظ نہیں ہوئی'
            : 'Could not save the payment'
      );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.title}>{isUrdu ? 'جمعہ کی ادائیگی' : 'Friday payment'}</ThemedText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={{ color: theme.textSecondary }}>
          {isUrdu
            ? 'ہفتہ جمعہ سے جمعرات ہے۔ دودھ کی وصولی ادائیگی نہیں ہے۔'
            : 'The week runs Friday to Thursday. A milk entry is not a payment.'}
        </ThemedText>
        <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
          {suppliers.map((supplier) => (
            <Pressable
              key={supplier.id}
              onPress={() => {
                setSupplierId(supplier.id);
                loadStatement(supplier.id).catch(() => {});
              }}>
              <ThemedText style={{ fontWeight: '700', color: supplierId === supplier.id ? theme.primary : theme.text }}>
                {supplier.name}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
        {statement ? (
          <AppCard>
            <ThemedText>{statement}</ThemedText>
          </AppCard>
        ) : null}
        <AppTextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={isUrdu ? 'رقم' : 'Amount'} />
        <AppTextInput value={method} onChangeText={setMethod} placeholder={isUrdu ? 'طریقہ' : 'Method'} />
        <AppTextInput value={reference} onChangeText={setReference} placeholder={isUrdu ? 'ریفرنس' : 'Reference'} autoCapitalize="none" />
        <AppTextInput value={notes} onChangeText={setNotes} placeholder={isUrdu ? 'نوٹ' : 'Notes'} />
        <AppButton title={isUrdu ? 'ادائیگی محفوظ کرو' : 'Save payment'} onPress={pay} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md },
  title: { fontSize: Typography.title2.fontSize, fontWeight: '700' },
  content: { padding: Spacing.md, gap: Spacing.sm },
});
