/**
 * DairyFlow Data & Backup Management Screen
 * 
 * Capabilities:
 * 1. CSV Exports:
 *    - Milk Collection Records (CSV)
 *    - Buyers Directory with Aggregated Stats (CSV)
 *    - Farm Operating Expenses (CSV)
 * 2. Full Database Backup (Versioned JSON):
 *    - Complete relational snapshot (buyers, milk_entries, expenses)
 *    - Pre-computed counts and financial totals
 *    - Native share-sheet dispatching
 * 3. Atomic Database Restoration:
 *    - Document picker file selection
 *    - Pre-mutation validation (0 silent coercion)
 *    - Clear confirmation modal showing backup timestamp and record counts
 *    - Guaranteed atomic rollback if validation or integrity checks fail
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AdminPinModal } from '@/components/dairy/AdminPinModal';
import { ThemedText } from '@/components/themed-text';
import {
  AppButton,
  AppCard,
  AppIcon,
  AppTextInput,
  IconBubble,
  StatCard,
} from '@/components/ui';
import { BorderRadius, Layout, Spacing, Typography } from '@/constants/theme';
import { useAdmin } from '@/context/admin-context';
import { useLanguage } from '@/context/language-context';
import {
  Buyer,
  getAllDataForBackup,
  getBuyersWithStats,
  getFilteredExpenses,
  MilkEntry,
  restoreAllDataFromBackup,
  RestoreResult,
} from '@/db/database';
import { useTheme } from '@/hooks/use-theme';
import {
  DairyFlowBackupEnvelope,
  parseAndValidateBackupJson,
  serializeBackupToJson,
} from '@/utils/backup-restore';
import {
  exportBuyersToCsv,
  exportExpensesToCsv,
  exportMilkEntriesToCsv,
} from '@/utils/csv-export';
import {
  pickBackupDocument,
  readBackupFile,
  saveContentToCache,
  shareExportFile,
} from '@/utils/file-storage';

interface LiveDbStats {
  buyersCount: number;
  milkEntriesCount: number;
  expensesCount: number;
  totalLiters: number;
  totalRevenue: number;
  totalExpenses: number;
}

export default function BackupScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { isUrdu } = useLanguage();

  // Multi-Farm Admin Profile from context
  const {
    farmName: adminFarmName,
    defaultMilkRate: adminMilkRate,
    updateFarmProfile,
    hasPinSet,
    setAuthScreen,
  } = useAdmin();

  // Farm Admin Settings State
  // Local edits override the context values until saved (avoids syncing state inside an effect).
  const [farmNameEdit, setFarmNameEdit] = useState<string | null>(null);
  const [defaultRateEdit, setDefaultRateEdit] = useState<string | null>(null);
  const farmName = farmNameEdit ?? adminFarmName;
  const defaultRate = defaultRateEdit ?? adminMilkRate;
  const setFarmName = setFarmNameEdit;
  const setDefaultRate = setDefaultRateEdit;
  const [savingSettings, setSavingSettings] = useState<boolean>(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [pinModalMode, setPinModalMode] = useState<'verify' | 'setup'>('setup');

  // Database live metrics
  const [stats, setStats] = useState<LiveDbStats>({
    buyersCount: 0,
    milkEntriesCount: 0,
    expensesCount: 0,
    totalLiters: 0,
    totalRevenue: 0,
    totalExpenses: 0,
  });
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Operation loading flags
  const [exportingMilk, setExportingMilk] = useState<boolean>(false);
  const [exportingBuyers, setExportingBuyers] = useState<boolean>(false);
  const [exportingExpenses, setExportingExpenses] = useState<boolean>(false);
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [pickingFile, setPickingFile] = useState<boolean>(false);
  const [restoringData, setRestoringData] = useState<boolean>(false);

  // Feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Restore Confirmation Modal State
  const [restoreModalVisible, setRestoreModalVisible] = useState<boolean>(false);
  const [pendingBackupEnvelope, setPendingBackupEnvelope] = useState<DairyFlowBackupEnvelope | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMessage(msg);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/more' as never);
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await updateFarmProfile({
        farmName: farmName.trim() || 'DairyFlow',
        defaultMilkRate: defaultRate.trim() || '220',
      });
      setFarmNameEdit(null);
      setDefaultRateEdit(null);
      showToast(isUrdu ? 'فارم سیٹنگز تے دودھ دا ریٹ محفوظ ہو گیا۔' : 'Farm settings & standard rate saved.');
    } catch {
      Alert.alert(
        isUrdu ? 'سیٹنگز خرابی' : 'Save Error',
        isUrdu ? 'سیٹنگز محفوظ کرن وچ مسئلہ پیش آیا۔' : 'Could not save farm settings.',
        [{ text: 'OK' }]
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // Load current database snapshot counts
  const loadDatabaseStats = useCallback(async () => {
    try {
      const buyers = await db.getAllAsync<Buyer>('SELECT id FROM buyers;');
      const milkEntries = await db.getAllAsync<{ liters: number; total_amount: number }>(
        'SELECT liters, total_amount FROM milk_entries;'
      );
      const expenses = await db.getAllAsync<{ amount: number }>('SELECT amount FROM expenses;');

      const totalLiters = milkEntries.reduce((sum, e) => sum + (e.liters || 0), 0);
      const totalRevenue = milkEntries.reduce((sum, e) => sum + (e.total_amount || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      setStats({
        buyersCount: buyers.length,
        milkEntriesCount: milkEntries.length,
        expensesCount: expenses.length,
        totalLiters: Number(totalLiters.toFixed(1)),
        totalRevenue: Math.round(totalRevenue),
        totalExpenses: Math.round(totalExpenses),
      });
    } catch (err) {
      console.error('Failed to load database stats:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadDatabaseStats();
    }, [loadDatabaseStats])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDatabaseStats();
  }, [loadDatabaseStats]);

  // Current date helper (YYYY-MM-DD)
  const getTodayDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // -------------------------------------------------------------------------
  // A. CSV EXPORTS
  // -------------------------------------------------------------------------
  const handleExportMilkCsv = async () => {
    if (exportingMilk) return;
    try {
      setExportingMilk(true);
      const entries = await db.getAllAsync<MilkEntry>(
        'SELECT * FROM milk_entries ORDER BY date DESC, id DESC;'
      );

      if (entries.length === 0) {
        Alert.alert(
          'No Milk Records',
          'There are currently no recorded milk collection entries to export.',
          [{ text: 'OK' }]
        );
        return;
      }

      const csvContent = exportMilkEntriesToCsv(entries);
      const filename = `dairyflow_milk_records_${getTodayDateStr()}.csv`;
      const saved = await saveContentToCache(filename, csvContent);

      const shared = await shareExportFile(saved.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Milk Records (CSV)',
      });

      if (shared) {
        showToast(`Exported ${entries.length} milk records to CSV.`);
      } else {
        showToast(`CSV saved to cache: ${saved.filename}`);
      }
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Unable to generate milk records CSV.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportingMilk(false);
    }
  };

  const handleExportBuyersCsv = async () => {
    if (exportingBuyers) return;
    try {
      setExportingBuyers(true);
      const buyersWithStats = await getBuyersWithStats(db);

      if (buyersWithStats.length === 0) {
        Alert.alert(
          'No Buyers Registered',
          'There are currently no registered buyers to export.',
          [{ text: 'OK' }]
        );
        return;
      }

      const csvContent = exportBuyersToCsv(buyersWithStats);
      const filename = `dairyflow_buyers_directory_${getTodayDateStr()}.csv`;
      const saved = await saveContentToCache(filename, csvContent);

      const shared = await shareExportFile(saved.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Buyers Directory (CSV)',
      });

      if (shared) {
        showToast(`Exported ${buyersWithStats.length} buyers to CSV.`);
      } else {
        showToast(`CSV saved to cache: ${saved.filename}`);
      }
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Unable to generate buyers CSV.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportingBuyers(false);
    }
  };

  const handleExportExpensesCsv = async () => {
    if (exportingExpenses) return;
    try {
      setExportingExpenses(true);
      const expenses = await getFilteredExpenses(db, {});

      if (expenses.length === 0) {
        Alert.alert(
          'No Expenses Recorded',
          'There are currently no recorded farm expenses to export.',
          [{ text: 'OK' }]
        );
        return;
      }

      const csvContent = exportExpensesToCsv(expenses);
      const filename = `dairyflow_expenses_${getTodayDateStr()}.csv`;
      const saved = await saveContentToCache(filename, csvContent);

      const shared = await shareExportFile(saved.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Farm Expenses (CSV)',
      });

      if (shared) {
        showToast(`Exported ${expenses.length} expense records to CSV.`);
      } else {
        showToast(`CSV saved to cache: ${saved.filename}`);
      }
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Unable to generate expenses CSV.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportingExpenses(false);
    }
  };

  // -------------------------------------------------------------------------
  // B. FULL BACKUP CREATION
  // -------------------------------------------------------------------------
  const handleCreateFullBackup = async () => {
    if (creatingBackup) return;
    try {
      setCreatingBackup(true);
      const backupEnvelope = await getAllDataForBackup(db);
      const jsonContent = serializeBackupToJson(backupEnvelope);

      const timestampSuffix = new Date()
        .toISOString()
        .replace(/[:T]/g, '-')
        .slice(0, 19);
      const filename = `dairyflow_full_backup_${timestampSuffix}.json`;

      const saved = await saveContentToCache(filename, jsonContent);
      const shared = await shareExportFile(saved.uri, {
        mimeType: 'application/json',
        dialogTitle: 'DairyFlow Full Backup (JSON)',
      });

      const { buyersCount, milkEntriesCount, expensesCount } = backupEnvelope.metadata;
      if (shared) {
        showToast(
          `Backup created: ${buyersCount} buyers, ${milkEntriesCount} records, ${expensesCount} expenses.`
        );
      } else {
        showToast(`Backup saved to cache: ${saved.filename}`);
      }
    } catch (err) {
      Alert.alert(
        'Backup Creation Failed',
        err instanceof Error ? err.message : 'Unable to create application backup.',
        [{ text: 'OK' }]
      );
    } finally {
      setCreatingBackup(false);
    }
  };

  // -------------------------------------------------------------------------
  // C. RESTORE FROM BACKUP
  // -------------------------------------------------------------------------
  const handleSelectBackupFile = async () => {
    if (pickingFile || restoringData) return;
    try {
      setPickingFile(true);
      const pickResult = await pickBackupDocument();

      if (pickResult.canceled || !pickResult.uri) {
        // User closed the file picker: exit silently without error
        return;
      }

      // Read file text
      const content = await readBackupFile(pickResult.uri);

      // Validate envelope structure and database constraints BEFORE any mutation
      const envelope = parseAndValidateBackupJson(content);

      setSelectedFileName(pickResult.name ?? 'Selected Backup');
      setPendingBackupEnvelope(envelope);
      setRestoreModalVisible(true);
    } catch (err) {
      Alert.alert(
        'Invalid Backup File',
        err instanceof Error
          ? err.message
          : 'The selected file is not a valid DairyFlow backup. No changes were made to your database.',
        [{ text: 'OK' }]
      );
    } finally {
      setPickingFile(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackupEnvelope || restoringData) return;
    try {
      setRestoringData(true);

      const result: RestoreResult = await restoreAllDataFromBackup(db, pendingBackupEnvelope);

      setRestoreModalVisible(false);
      setPendingBackupEnvelope(null);

      // Refresh displayed database numbers
      await loadDatabaseStats();

      Alert.alert(
        'Restore Complete',
        `Successfully restored ${result.restoredCounts.buyers} buyers, ${result.restoredCounts.milkEntries} milk records, and ${result.restoredCounts.expenses} expenses.\n\nAll tables have been synchronized.`,
        [{ text: 'Great' }]
      );
      showToast('Database restored successfully.');
    } catch (err) {
      Alert.alert(
        'Restore Failed (Rolled Back)',
        `Could not restore backup:\n${err instanceof Error ? err.message : String(err)}\n\nYour original database contents were not altered and remain protected by transaction rollback.`,
        [{ text: 'OK' }]
      );
    } finally {
      setRestoringData(false);
    }
  };

  // Formatted date string for backup timestamp
  const formatBackupDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoStr;
    }
  };

  const anyLoading =
    exportingMilk ||
    exportingBuyers ||
    exportingExpenses ||
    creatingBackup ||
    pickingFile ||
    restoringData;

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.background }]}>
      {/* Toast Feedback */}
      {toastMessage ? (
        <View style={[styles.toastContainer, { backgroundColor: theme.primaryDark }]}>
          <AppIcon name="check" size={16} color="#FFFFFF" />
          <ThemedText style={styles.toastText}>{toastMessage}</ThemedText>
        </View>
      ) : null}

      {/* Screen Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isUrdu ? 'واپس' : 'Go back'}
          onPress={goBack}
          hitSlop={6}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: theme.card, borderColor: theme.border },
            pressed && styles.pressed,
          ]}>
          <AppIcon name="chevronLeft" size={20} color={theme.text} />
        </Pressable>
        <View style={styles.headerText}>
          <ThemedText style={styles.headerTitle} numberOfLines={1}>
            {isUrdu ? 'ڈیٹا تے بیک اپ' : 'Data & Backup'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {isUrdu ? 'فارم سیٹنگز، ایکسل تے بیک اپ' : 'Export CSVs, full backups & restore'}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: Layout.bottomTabInset + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }>
        {/* ========================================================= */}
        {/* 1. FARM ADMIN SETTINGS (Farm Name & Default Milk Rate)    */}
        {/* ========================================================= */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWrap}>
              <IconBubble icon="settings" variant="mint" size={32} iconSize={16} />
              <View>
                <ThemedText style={styles.sectionTitle}>
                  {isUrdu ? 'فارم دی معلومات تے ایڈمن ریٹ' : 'Farm Profile & Standard Milk Rate'}
                </ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  {isUrdu
                    ? 'فارم دا ناں تے فی لیٹر بنیادی ریٹ سیٹ کرو'
                    : 'Set your farm name & default rate per liter'}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
            <AppTextInput
              label={isUrdu ? 'فارم دا ناں' : 'Farm Name'}
              value={farmName}
              onChangeText={setFarmName}
              placeholder={isUrdu ? 'ڈیری فلو' : 'e.g. DairyFlow'}
            />

            <AppTextInput
              label={isUrdu ? 'دودھ دا بنیادی ریٹ (روپے/لیٹر)' : 'Default Milk Rate (PKR / Liter)'}
              value={defaultRate}
              onChangeText={setDefaultRate}
              placeholder="220"
              keyboardType="decimal-pad"
              unitSuffix={isUrdu ? 'روپے / لیٹر' : 'Rs / L'}
            />

            <AppButton
              variant="primary"
              size="md"
              title={isUrdu ? 'سیٹنگز محفوظ کرو' : 'Save Farm Settings'}
              loading={savingSettings}
              icon={<AppIcon name="check" size={16} color="#FFFFFF" />}
              onPress={handleSaveSettings}
            />

            <AppButton
              variant="outline"
              size="md"
              title={
                hasPinSet
                  ? isUrdu
                    ? '🔒 ایڈمن پن تبدیل کرو'
                    : '🔒 Change Admin PIN'
                  : isUrdu
                    ? '🔑 4 ہندسیاں دا ایڈمن پن سیٹ کرو'
                    : '🔑 Set 4-Digit Admin PIN'
              }
              icon={<AppIcon name="wallet" size={16} color={theme.primary} />}
              onPress={() => {
                setPinModalMode('setup');
                setIsPinModalOpen(true);
              }}
            />

            <AppButton
              variant="outline"
              size="md"
              title={isUrdu ? '+ نواں فارم رجسٹر کرو' : '+ Register New Farm'}
              icon={<AppIcon name="add" size={16} color={theme.primary} />}
              onPress={() => setAuthScreen('register')}
            />
          </View>
        </AppCard>

        {/* ========================================================= */}
        {/* 2. LIVE DATABASE STATUS METRICS CARD                      */}
        {/* ========================================================= */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWrap}>
              <IconBubble icon="check" variant="mint" size={32} iconSize={16} />
              <View>
                <ThemedText style={styles.sectionTitle}>Local Database Status</ThemedText>
                <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                  Live records currently stored on this device
                </ThemedText>
              </View>
            </View>

            <Pressable
              onPress={onRefresh}
              disabled={loadingStats}
              style={({ pressed }) => [
                styles.refreshBtn,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name="refresh"
                size={16}
                color={loadingStats ? theme.textMuted : theme.primary}
              />
            </Pressable>
          </View>

          {loadingStats ? (
            <View style={styles.statsLoadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <ThemedText style={[styles.statsLoadingText, { color: theme.textSecondary }]}>
                Calculating database records...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.statGrid}>
              <StatCard
                style={styles.statItem}
                label="Buyers"
                value={stats.buyersCount.toString()}
                subtext="in directory"
                icon={<AppIcon name="user" size={16} color={theme.primary} />}
              />
              <StatCard
                style={styles.statItem}
                label="Milk Entries"
                value={stats.milkEntriesCount.toString()}
                subtext={`${stats.totalLiters.toLocaleString()} L`}
                icon={<AppIcon name="milk" size={16} color={theme.primary} />}
              />
              <StatCard
                style={styles.statItem}
                label="Farm Expenses"
                value={stats.expensesCount.toString()}
                subtext={`Rs ${stats.totalExpenses.toLocaleString()}`}
                icon={<AppIcon name="feed" size={16} color={theme.primary} />}
              />
            </View>
          )}
        </AppCard>

        {/* ========================================================= */}
        {/* 2. CSV EXPORTS SECTION                                    */}
        {/* ========================================================= */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardTitleWrap}>
            <IconBubble icon="chart" variant="mint" size={34} iconSize={18} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.sectionTitle}>Spreadsheet Exports (CSV)</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                UTF-8 with Excel BOM & formula injection defense. Ideal for Microsoft Excel, Google Sheets, or Apple Numbers.
              </ThemedText>
            </View>
          </View>

          <View style={styles.actionItemsContainer}>
            {/* Export Milk Entries */}
            <View style={[styles.actionRow, { borderColor: theme.border }]}>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitle}>Milk Collection Records</ThemedText>
                <ThemedText style={[styles.actionDescription, { color: theme.textSecondary }]}>
                  {stats.milkEntriesCount} records · Date, shift, fat, liters, rates, and amounts
                </ThemedText>
              </View>
              <AppButton
                title={exportingMilk ? 'Exporting...' : 'Export'}
                variant="secondary"
                size="sm"
                icon={<AppIcon name="milk" size={14} color={theme.primaryDark} />}
                loading={exportingMilk}
                disabled={anyLoading}
                onPress={handleExportMilkCsv}
              />
            </View>

            {/* Export Buyers Directory */}
            <View style={[styles.actionRow, { borderColor: theme.border }]}>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitle}>Buyers Directory</ThemedText>
                <ThemedText style={[styles.actionDescription, { color: theme.textSecondary }]}>
                  {stats.buyersCount} buyers · Contact details, defaults, and lifetime totals
                </ThemedText>
              </View>
              <AppButton
                title={exportingBuyers ? 'Exporting...' : 'Export'}
                variant="secondary"
                size="sm"
                icon={<AppIcon name="user" size={14} color={theme.primaryDark} />}
                loading={exportingBuyers}
                disabled={anyLoading}
                onPress={handleExportBuyersCsv}
              />
            </View>

            {/* Export Expenses */}
            <View style={[styles.actionRow, { borderColor: theme.border }]}>
              <View style={styles.actionInfo}>
                <ThemedText style={styles.actionTitle}>Farm Operating Expenses</ThemedText>
                <ThemedText style={[styles.actionDescription, { color: theme.textSecondary }]}>
                  {stats.expensesCount} expenses · Feed, labour, vet care, fuel, utilities
                </ThemedText>
              </View>
              <AppButton
                title={exportingExpenses ? 'Exporting...' : 'Export'}
                variant="secondary"
                size="sm"
                icon={<AppIcon name="feed" size={14} color={theme.primaryDark} />}
                loading={exportingExpenses}
                disabled={anyLoading}
                onPress={handleExportExpensesCsv}
              />
            </View>
          </View>

          <View style={[styles.noteBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
            <ThemedText style={[styles.noteText, { color: theme.textSecondary }]}>
              Note: CSV exports are tabular reports for spreadsheets. They do not constitute a full relational database backup and cannot be used to restore the database.
            </ThemedText>
          </View>
        </AppCard>

        {/* ========================================================= */}
        {/* 3. FULL BACKUP (JSON ARCHIVE)                             */}
        {/* ========================================================= */}
        <AppCard style={styles.sectionCard}>
          <View style={styles.cardTitleWrap}>
            <IconBubble icon="sync" variant="mint" size={34} iconSize={18} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.sectionTitle}>Full Database Backup (JSON)</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Complete versioned snapshot of buyers, milk records, and expenses with data integrity checksums.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.infoHighlightBox, { backgroundColor: theme.primaryLight + '15', borderColor: theme.primaryLight }]}>
            <Ionicons name="shield-checkmark" size={20} color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.highlightTitle, { color: theme.primary }]}>
                Safe & Portable Backup
              </ThemedText>
              <ThemedText style={[styles.highlightDescription, { color: theme.textSecondary }]}>
                Includes all {stats.buyersCount} buyers, {stats.milkEntriesCount} collection entries, and {stats.expensesCount} expenses.
                Always save or send the file to Google Drive, WhatsApp, or email for safekeeping outside your device.
              </ThemedText>
            </View>
          </View>

          <AppButton
            title={creatingBackup ? 'Creating Backup...' : 'Create Full Backup (JSON)'}
            variant="primary"
            size="lg"
            icon={<AppIcon name="sync" size={18} color="#FFFFFF" />}
            loading={creatingBackup}
            disabled={anyLoading}
            onPress={handleCreateFullBackup}
          />
        </AppCard>

        {/* ========================================================= */}
        {/* 4. RESTORE FROM BACKUP                                    */}
        {/* ========================================================= */}
        <AppCard style={[styles.sectionCard, { borderColor: theme.danger + '35' }]}>
          <View style={styles.cardTitleWrap}>
            <IconBubble icon="calendar" variant="mint" size={34} iconSize={18} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.sectionTitle}>Restore from Backup</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                Select an existing DairyFlow backup file (.json) to restore records.
              </ThemedText>
            </View>
          </View>

          <View style={[styles.warningBox, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '40' }]}>
            <Ionicons name="warning" size={20} color={theme.danger} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.warningTitle, { color: theme.danger }]}>
                Destructive Operation Notice
              </ThemedText>
              <ThemedText style={[styles.warningDescription, { color: theme.textSecondary }]}>
                Restoring replaces current buyers, milk collection entries, and farm expenses with data from the backup file.
                A confirmation preview will display record counts before any changes are applied.
              </ThemedText>
            </View>
          </View>

          <AppButton
            title={pickingFile ? 'Reading File...' : 'Select & Restore Backup File'}
            variant="outline"
            size="lg"
            icon={<Ionicons name="folder-open-outline" size={18} color={theme.primary} />}
            loading={pickingFile}
            disabled={anyLoading}
            onPress={handleSelectBackupFile}
          />
        </AppCard>
      </ScrollView>

      {/* ========================================================= */}
      {/* 5. RESTORE CONFIRMATION PREVIEW MODAL                     */}
      {/* ========================================================= */}
      <Modal
        visible={restoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!restoringData) setRestoreModalVisible(false);
        }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Modal Header */}
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleWrap}>
                <IconBubble icon="sync" variant="mint" size={36} iconSize={18} />
                <View>
                  <ThemedText style={styles.modalTitle}>Confirm Data Restore</ThemedText>
                  <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    {selectedFileName}
                  </ThemedText>
                </View>
              </View>

              {!restoringData ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={() => setRestoreModalVisible(false)}
                  style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>

            {pendingBackupEnvelope ? (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
                <View style={[styles.modalAlertBox, { backgroundColor: theme.danger + '12', borderColor: theme.danger + '50' }]}>
                  <Ionicons name="alert-circle" size={22} color={theme.danger} />
                  <ThemedText style={[styles.modalAlertText, { color: theme.danger }]}>
                    Restoring this file will delete and replace your current {stats.buyersCount} buyers, {stats.milkEntriesCount} milk collection records, and {stats.expensesCount} expenses.
                  </ThemedText>
                </View>

                {/* Backup Metadata Preview */}
                <View style={[styles.metaPreviewBox, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                  <ThemedText style={styles.metaPreviewHeading}>Backup Snapshot Details</ThemedText>

                  <View style={styles.metaRow}>
                    <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Created At</ThemedText>
                    <ThemedText style={styles.metaValue}>
                      {formatBackupDate(pendingBackupEnvelope.createdAt)}
                    </ThemedText>
                  </View>

                  <View style={styles.metaRow}>
                    <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Version</ThemedText>
                    <ThemedText style={styles.metaValue}>
                      {pendingBackupEnvelope.format} v{pendingBackupEnvelope.version}
                    </ThemedText>
                  </View>

                  <View style={styles.metaRow}>
                    <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Buyers Included</ThemedText>
                    <ThemedText style={[styles.metaValue, { color: theme.primary, fontWeight: '700' }]}>
                      {pendingBackupEnvelope.metadata.buyersCount} buyers
                    </ThemedText>
                  </View>

                  <View style={styles.metaRow}>
                    <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Milk Collection Entries</ThemedText>
                    <ThemedText style={[styles.metaValue, { color: theme.primary, fontWeight: '700' }]}>
                      {pendingBackupEnvelope.metadata.milkEntriesCount} entries ({pendingBackupEnvelope.metadata.totalMilkLiters} L)
                    </ThemedText>
                  </View>

                  <View style={styles.metaRow}>
                    <ThemedText style={[styles.metaLabel, { color: theme.textSecondary }]}>Farm Expenses</ThemedText>
                    <ThemedText style={[styles.metaValue, { color: theme.primary, fontWeight: '700' }]}>
                      {pendingBackupEnvelope.metadata.expensesCount} expenses (Rs {pendingBackupEnvelope.metadata.totalExpensesAmount.toLocaleString()})
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.safetyFootnote}>
                  <Ionicons name="lock-closed" size={14} color={theme.textMuted} />
                  <ThemedText style={[styles.safetyFootnoteText, { color: theme.textMuted }]}>
                    Foreign keys and exclusive transactions protect your data. If any error occurs during restoration, all changes are automatically rolled back.
                  </ThemedText>
                </View>
              </ScrollView>
            ) : null}

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <AppButton
                title="Cancel"
                variant="ghost"
                size="md"
                disabled={restoringData}
                onPress={() => setRestoreModalVisible(false)}
                style={{ flex: 1 }}
              />
              <AppButton
                title={restoringData ? 'Restoring...' : 'Confirm & Replace Data'}
                variant="danger"
                size="md"
                loading={restoringData}
                disabled={restoringData}
                onPress={handleConfirmRestore}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin PIN Setup / Change Modal */}
      <AdminPinModal
        visible={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
        mode={pinModalMode}
        onSuccess={() => {
          showToast(
            isUrdu
              ? 'ایڈمن پن کامیابی نال سیٹ ہو گیا۔'
              : 'Admin PIN configured successfully.'
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitle: {
    fontSize: Typography.title3.fontSize,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: Typography.footnote.fontSize,
    marginTop: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: Spacing.md,
  },
  sectionCard: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  statsLoadingText: {
    fontSize: 14,
  },
  statGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statItem: {
    flex: 1,
  },
  actionItemsContainer: {
    gap: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  noteText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  infoHighlightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  highlightDescription: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningDescription: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    maxHeight: '85%',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  modalScroll: {
    maxHeight: 320,
  },
  modalAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  modalAlertText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },
  metaPreviewBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  metaPreviewHeading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  metaLabel: {
    fontSize: 12,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  safetyFootnote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  safetyFootnoteText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 14,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pressed: {
    opacity: 0.75,
  },
});
