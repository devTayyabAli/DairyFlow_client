import { Platform } from 'react-native';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  DairyFlowBackupEnvelope,
  createBackupEnvelope,
  validateBackupPayload,
  parseAndValidateBackupJson,
} from '../utils/backup-restore';

export type ShiftType = 'Morning' | 'Evening';

export interface SyncQueueItem {
  id: number;
  table_name: string;
  row_uuid: string;
  op: 'upsert' | 'delete';
  queued_at: string;
}

export interface Buyer {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  is_default: number; // 1 = default, 0 = regular
  created_at: string;
  uuid?: string;
  updated_at?: string;
}

export interface MilkEntry {
  id: number;
  date: string; // YYYY-MM-DD
  shift: ShiftType;
  liters: number;
  fat_percentage: number;
  rate_per_liter: number;
  total_amount: number;
  buyer_id: number;
  buyer_name: string;
  notes?: string | null;
  created_at: string;
  uuid?: string;
  updated_at?: string;
}

export interface NewMilkEntry {
  date: string; // YYYY-MM-DD
  shift: ShiftType;
  liters: number;
  fat_percentage: number;
  rate_per_liter: number;
  total_amount: number;
  buyer_id: number;
  buyer_name: string;
  notes?: string;
}

export interface DaySummary {
  totalLiters: number;
  totalRevenue: number;
  morningLiters: number;
  eveningLiters: number;
  morningRevenue: number;
  eveningRevenue: number;
  avgFat: number;
  entriesCount: number;
}

export type ExpenseCategory =
  | 'Feed'
  | 'Labour'
  | 'Veterinary'
  | 'Transport'
  | 'Utilities'
  | 'Maintenance'
  | 'Other';

export interface Expense {
  id: number;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  title: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  supplier_or_payee: string | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  uuid?: string;
  updated_at?: string;
}

export interface NewExpense {
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  title: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  unit_price?: number | null;
  supplier_or_payee?: string | null;
  payment_method?: string | null;
  notes?: string | null;
}

export interface FilterExpensesOptions {
  startDate?: string;
  endDate?: string;
  category?: ExpenseCategory | 'All';
  searchQuery?: string;
  limit?: number;
}

export interface ExpenseSummary {
  totalExpenses: number;
  feedExpenses: number;
  otherExpenses: number;
  totalFeedQuantity: number;
  expenseCount: number;
  feedCount: number;
  otherCount: number;
  categoryBreakdown: Record<ExpenseCategory, number>;
}

export interface OperatingFinancialReport {
  startDate?: string;
  endDate?: string;
  totalMilkSalesRevenue: number;
  totalMilkLiters: number;
  totalExpenses: number;
  feedExpenses: number;
  otherExpenses: number;
  operatingBalance: number; // milk sales revenue - total farm expenses
  operatingMarginPercentage: number; // (operatingBalance / totalMilkSalesRevenue) * 100
  milkEntriesCount: number;
  expensesCount: number;
  disclaimer: string;
}

export interface FinancialReportFilterOptions {
  startDate?: string;
  endDate?: string;
}

// ==========================================
// LIVESTOCK & HERD TYPES
// ==========================================

export type AnimalSpecies = 'Cow' | 'Buffalo' | 'Calf';
export type AnimalGender = 'Female' | 'Male';
export type AnimalStatus = 'Lactating' | 'Dry' | 'Pregnant' | 'Heifer' | 'Bull' | 'Calf';
export type ActivityType =
  | 'Vaccination'
  | 'Deworming'
  | 'Calving'
  | 'Insemination'
  | 'Treatment'
  | 'Group Move'
  | 'Other';

export interface LivestockAnimal {
  id: number;
  tag_number: string;
  name?: string | null;
  species: AnimalSpecies;
  gender: AnimalGender;
  status: AnimalStatus;
  breed?: string | null;
  birth_date?: string | null;
  notes?: string | null;
  created_at: string;
  uuid?: string;
  updated_at?: string;
}

export interface NewLivestockAnimal {
  tag_number: string;
  name?: string | null;
  species: AnimalSpecies;
  gender: AnimalGender;
  status: AnimalStatus;
  breed?: string | null;
  birth_date?: string | null;
  notes?: string | null;
}

export interface LivestockActivity {
  id: number;
  animal_id?: number | null;
  animal_tag: string;
  activity_type: ActivityType;
  title: string;
  date: string; // YYYY-MM-DD
  notes?: string | null;
  created_at: string;
  uuid?: string;
  updated_at?: string;
}

export interface NewLivestockActivity {
  animal_id?: number | null;
  animal_tag: string;
  activity_type: ActivityType;
  title: string;
  date: string; // YYYY-MM-DD
  notes?: string | null;
}

export interface LivestockSummary {
  totalAnimals: number;
  lactatingCount: number;
  cowsCount: number;
  cowsLactating: number;
  buffaloesCount: number;
  buffaloesLactating: number;
  calvesCount: number;
  calvesFemale: number;
  calvesMale: number;
}

// ==========================================
// BUYER PAYMENTS & LEDGER TYPES
// ==========================================

export interface BuyerPayment {
  id: number;
  buyer_id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  payment_method: string;
  received_by?: string | null;
  notes?: string | null;
  created_at: string;
  uuid?: string;
  updated_at?: string;
}

export interface NewBuyerPayment {
  buyer_id: number;
  date: string; // YYYY-MM-DD
  amount: number;
  payment_method: string;
  received_by?: string | null;
  notes?: string | null;
}

export interface BuyerLedgerSummary {
  buyer: Buyer;
  openingBalance: number;
  totalSalesVolume: number;
  totalSalesAmount: number;
  totalPaymentsReceived: number;
  outstandingBalance: number;
  payments: BuyerPayment[];
  entries: MilkEntry[];
}

export interface BuyerOverviewItem {
  buyer: Buyer;
  weeklyLiters: number;
  totalSalesAmount: number;
  totalPaidAmount: number;
  balanceDue: number;
  percentagePaid: number;
}

export const DB_NAME = 'dairy_farm.db';

/**
 * Initializes the SQLite database schema and seeds the default buyer if needed.
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  // Enable foreign keys
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Create app_settings table for language and farm profile settings
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Create buyers table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS buyers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Create milk entries table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS milk_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      shift TEXT NOT NULL CHECK(shift IN ('Morning', 'Evening')),
      liters REAL NOT NULL,
      fat_percentage REAL NOT NULL,
      rate_per_liter REAL NOT NULL,
      total_amount REAL NOT NULL,
      buyer_id INTEGER NOT NULL,
      buyer_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE RESTRICT
    );
  `);

  // Create indexes for efficient filtering and sorting
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(date);
    CREATE INDEX IF NOT EXISTS idx_milk_entries_shift ON milk_entries(shift);
    CREATE INDEX IF NOT EXISTS idx_milk_entries_buyer ON milk_entries(buyer_id);
  `);

  // Create expenses table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      quantity REAL,
      unit TEXT,
      unit_price REAL,
      supplier_or_payee TEXT,
      payment_method TEXT DEFAULT 'Cash',
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Create indexes for efficient expense queries
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  `);

  // Create buyer payments table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS buyer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      buyer_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      received_by TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (buyer_id) REFERENCES buyers(id) ON DELETE RESTRICT
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_buyer_payments_buyer ON buyer_payments(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_buyer_payments_date ON buyer_payments(date);
  `);

  // Create livestock table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS livestock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag_number TEXT UNIQUE NOT NULL,
      name TEXT,
      species TEXT NOT NULL CHECK(species IN ('Cow', 'Buffalo', 'Calf')),
      gender TEXT NOT NULL CHECK(gender IN ('Female', 'Male')),
      status TEXT NOT NULL CHECK(status IN ('Lactating', 'Dry', 'Pregnant', 'Heifer', 'Bull', 'Calf')),
      breed TEXT,
      birth_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_livestock_species ON livestock(species);
    CREATE INDEX IF NOT EXISTS idx_livestock_status ON livestock(status);
  `);

  // Create livestock activities table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS livestock_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      animal_id INTEGER,
      animal_tag TEXT NOT NULL,
      activity_type TEXT NOT NULL CHECK(activity_type IN ('Vaccination', 'Deworming', 'Calving', 'Insemination', 'Treatment', 'Group Move', 'Other')),
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (animal_id) REFERENCES livestock(id) ON DELETE SET NULL
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_livestock_activities_date ON livestock_activities(date);
  `);

  // Run offline-first sync migration & trigger setup
  await migrateAndSetupSync(db);

  // Seed reference buyers if none exist
  const existingBuyer = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM buyers;'
  );

  if (!existingBuyer || existingBuyer.count === 0) {
    // Flag sync_applying to ensure demo seed data never enters sync_queue
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('sync_applying', '1');");
    const now = new Date().toISOString();

    // Default cooperative
    await db.runAsync(
      `INSERT INTO buyers (name, phone, address, is_default, created_at)
       VALUES (?, ?, ?, 1, ?);`,
      ['Ahmed Milk Centre', '0300 762 1890', 'Ahmed Ali · Sheikhupura', now]
    );
    await db.runAsync(
      `INSERT INTO buyers (name, phone, address, is_default, created_at)
       VALUES (?, ?, ?, 0, ?);`,
      ['Bilal Dairy Shop', '0301 555 1234', 'Ferozewala', now]
    );
    await db.runAsync(
      `INSERT INTO buyers (name, phone, address, is_default, created_at)
       VALUES (?, ?, ?, 0, ?);`,
      ['Ayesha Sweets', '0302 444 9876', 'Sheikhupura', now]
    );

    // Get Ahmed Milk Centre ID
    const ahmed = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM buyers WHERE name LIKE ? LIMIT 1;',
      ['%Ahmed%']
    );

    if (ahmed) {
      // Seed payments matching Screenshot 151353
      await db.runAsync(
        `INSERT INTO buyer_payments (buyer_id, date, amount, payment_method, received_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [ahmed.id, '2026-10-12', 20000, 'Bank transfer', 'HBL', now]
      );
      await db.runAsync(
        `INSERT INTO buyer_payments (buyer_id, date, amount, payment_method, received_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [ahmed.id, '2026-10-10', 25000, 'Cash', 'Received by Usman', now]
      );

      // Opening balance milk sale before weekly period (matches Screenshot 151353 opening balance Rs 8,000)
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 40, 4.5, 200, 8000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-08', ahmed.id, now]
      );

      // Seed milk sales matching Screenshot 151522 (Fri 9 - Tue 13 Oct 2026)
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 50, 4.5, 200, 10000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-09', ahmed.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 60, 4.5, 200, 12000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-10', ahmed.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 55, 4.5, 200, 11000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-11', ahmed.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 50, 4.5, 200, 10000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-12', ahmed.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 65, 4.5, 200, 13000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-13', ahmed.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Evening', 20, 4.5, 200, 4000, ?, 'Ahmed Milk Centre', ?);`,
        ['2026-10-13', ahmed.id, now]
      );
    }

    const bilal = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM buyers WHERE name LIKE ? LIMIT 1;',
      ['%Bilal%']
    );
    if (bilal) {
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 45, 4.5, 200, 9000, ?, 'Bilal Dairy Shop', ?);`,
        ['2026-10-12', bilal.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 80, 4.5, 200, 16000, ?, 'Bilal Dairy Shop', ?);`,
        ['2026-10-14', bilal.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Evening', 75, 4.5, 200, 15000, ?, 'Bilal Dairy Shop', ?);`,
        ['2026-10-15', bilal.id, now]
      );
      await db.runAsync(
        `INSERT INTO buyer_payments (buyer_id, date, amount, payment_method, received_by, created_at)
         VALUES (?, '2026-10-14', 31000, 'Bank transfer', 'Bank Alfalah', ?);`,
        [bilal.id, now]
      );
    }

    const ayesha = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM buyers WHERE name LIKE ? LIMIT 1;',
      ['%Ayesha%']
    );
    if (ayesha) {
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Evening', 25, 4.5, 200, 5000, ?, 'Ayesha Sweets', ?);`,
        ['2026-10-12', ayesha.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Evening', 65, 4.5, 200, 13000, ?, 'Ayesha Sweets', ?);`,
        ['2026-10-14', ayesha.id, now]
      );
      await db.runAsync(
        `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, created_at)
         VALUES (?, 'Morning', 60, 4.5, 200, 12000, ?, 'Ayesha Sweets', ?);`,
        ['2026-10-15', ayesha.id, now]
      );
      await db.runAsync(
        `INSERT INTO buyer_payments (buyer_id, date, amount, payment_method, received_by, created_at)
         VALUES (?, '2026-10-14', 25000, 'Cash', 'Direct counter', ?);`,
        [ayesha.id, now]
      );
    }

    // Seed reference farm operating expenses matching Screenshot 151433 (Rs 48,500 total)
    await db.runAsync(
      `INSERT INTO expenses (date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, created_at)
       VALUES (?, 'Feed', 'Wanda & Silage (40 bags)', 32000, 40, 'bag', 800, 'Punjab Feeds', 'Bank transfer', ?);`,
      ['2026-10-10', now]
    );
    await db.runAsync(
      `INSERT INTO expenses (date, category, title, amount, supplier_or_payee, payment_method, created_at)
       VALUES (?, 'Labour', 'Weekly farm staff wages', 10000, 'Farm Workers', 'Cash', ?);`,
      ['2026-10-12', now]
    );
    await db.runAsync(
      `INSERT INTO expenses (date, category, title, amount, supplier_or_payee, payment_method, created_at)
       VALUES (?, 'Veterinary', 'HS Vaccine & Deworming medication', 4500, 'Dr. Tariq Vet Clinic', 'Cash', ?);`,
      ['2026-10-11', now]
    );
    await db.runAsync(
      `INSERT INTO expenses (date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, created_at)
       VALUES (?, 'Transport', 'Tractor diesel for fodder (10 L)', 2000, 10, 'liter', 200, 'PSO Petrol Pump', 'Cash', ?);`,
      ['2026-10-13', now]
    );

    // 18 Cows (14 lactating, 4 dry/pregnant)
    for (let i = 1; i <= 14; i++) {
      const tag = `C-${String(i).padStart(2, '0')}`;
      await db.runAsync(
        `INSERT INTO livestock (tag_number, name, species, gender, status, breed, created_at)
         VALUES (?, ?, 'Cow', 'Female', 'Lactating', 'Sahiwal', ?);`,
        [tag, `Cow ${tag}`, now]
      );
    }
    for (let i = 15; i <= 18; i++) {
      const tag = `C-${String(i).padStart(2, '0')}`;
      const status = i % 2 === 0 ? 'Pregnant' : 'Dry';
      await db.runAsync(
        `INSERT INTO livestock (tag_number, name, species, gender, status, breed, created_at)
         VALUES (?, ?, 'Cow', 'Female', ?, 'Sahiwal', ?);`,
        [tag, `Cow ${tag}`, status, now]
      );
    }

    // 12 Buffaloes (8 lactating, 4 dry)
    for (let i = 1; i <= 8; i++) {
      const tag = `B-${String(i).padStart(2, '0')}`;
      await db.runAsync(
        `INSERT INTO livestock (tag_number, name, species, gender, status, breed, created_at)
         VALUES (?, ?, 'Buffalo', 'Female', 'Lactating', 'Nili Ravi', ?);`,
        [tag, `Buffalo ${tag}`, now]
      );
    }
    for (let i = 9; i <= 12; i++) {
      const tag = `B-${String(i).padStart(2, '0')}`;
      await db.runAsync(
        `INSERT INTO livestock (tag_number, name, species, gender, status, breed, created_at)
         VALUES (?, ?, 'Buffalo', 'Female', 'Dry', 'Nili Ravi', ?);`,
        [tag, `Buffalo ${tag}`, now]
      );
    }

    // 9 Calves (5 female, 4 male)
    for (let i = 1; i <= 5; i++) {
      const tag = `K-${String(i).padStart(2, '0')}`;
      await db.runAsync(
        `INSERT INTO livestock (tag_number, name, species, gender, status, breed, created_at)
         VALUES (?, ?, 'Calf', 'Female', 'Calf', 'Crossbred', ?);`,
        [tag, `Calf ${tag}`, now]
      );
    }
    for (let i = 6; i <= 9; i++) {
      const tag = `K-${String(i).padStart(2, '0')}`;
      await db.runAsync(
        `INSERT INTO livestock (tag_number, name, species, gender, status, breed, created_at)
         VALUES (?, ?, 'Calf', 'Male', 'Calf', 'Crossbred', ?);`,
        [tag, `Calf ${tag}`, now]
      );
    }

    // Seed recent activities matching Screenshot 151606
    const today = new Date().toISOString().split('T')[0];
    await db.runAsync(
      `INSERT INTO livestock_activities (animal_tag, activity_type, title, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['Buffalo B-07', 'Vaccination', 'Vaccination completed', today, 'HS vaccine · 10:00 am', now]
    );
    await db.runAsync(
      `INSERT INTO livestock_activities (animal_tag, activity_type, title, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['Cow C-12', 'Group Move', 'Moved to lactating group', today, 'calved on 11 Oct · 7:30 am', now]
    );
    await db.runAsync(
      `INSERT INTO livestock_activities (animal_tag, activity_type, title, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['Calf K-09', 'Calving', 'New calf registered', today, 'female · mother C-12 · 4:30 am', now]
    );
    await db.runAsync(
      `INSERT INTO livestock_activities (animal_tag, activity_type, title, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['Calves K-03, K-05, K-08', 'Deworming', 'Deworming scheduled', today, 'Oral suspension due this Thursday', now]
    );

    // Save demo seed UUIDs to distinguish seed rows from user rows
    const seedRows = await db.getAllAsync<{ uuid: string }>(`
      SELECT uuid FROM buyers
      UNION SELECT uuid FROM milk_entries
      UNION SELECT uuid FROM expenses
      UNION SELECT uuid FROM buyer_payments
      UNION SELECT uuid FROM livestock
      UNION SELECT uuid FROM livestock_activities;
    `);
    const seedUuids = seedRows.map((r) => r.uuid);
    await db.runAsync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('demo_seed_uuids', ?);",
      [JSON.stringify(seedUuids)]
    );

    // Clear flag and remove any queued demo seed operations
    await db.runAsync("DELETE FROM app_settings WHERE key = 'sync_applying';");
    await db.runAsync('DELETE FROM sync_queue;');
  }
}

export const SYNCED_TABLES = [
  'buyers',
  'milk_entries',
  'expenses',
  'buyer_payments',
  'livestock',
  'livestock_activities',
] as const;

/**
 * Idempotently adds uuid and updated_at to all 6 data tables,
 * ensures unique indexes, creates sync_queue and installs triggers.
 */
export async function migrateAndSetupSync(db: SQLiteDatabase): Promise<void> {
  // 1. Create sync_queue table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_uuid TEXT NOT NULL,
      op TEXT NOT NULL CHECK(op IN ('upsert', 'delete')),
      queued_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sync_queue_table_uuid ON sync_queue(table_name, row_uuid);
  `);

  // 2. Add uuid & updated_at to the 6 data tables (guarded by PRAGMA table_info)
  for (const table of SYNCED_TABLES) {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table});`);
    const hasUuid = columns.some((c) => c.name.toLowerCase() === 'uuid');
    const hasUpdatedAt = columns.some((c) => c.name.toLowerCase() === 'updated_at');

    if (!hasUuid) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN uuid TEXT;`);
    }
    if (!hasUpdatedAt) {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT;`);
    }

    // Backfill rows where uuid or updated_at is null
    await db.execAsync(`
      UPDATE ${table} SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
      UPDATE ${table} SET updated_at = COALESCE(created_at, datetime('now')) WHERE updated_at IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_${table}_uuid ON ${table}(uuid);
    `);

    // Create AFTER INSERT trigger
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_after_insert AFTER INSERT ON ${table} FOR EACH ROW
      WHEN (SELECT value FROM app_settings WHERE key='sync_applying') IS NOT '1'
      BEGIN
        UPDATE ${table} SET 
          uuid = CASE WHEN NEW.uuid IS NULL THEN lower(hex(randomblob(16))) ELSE NEW.uuid END,
          updated_at = CASE WHEN NEW.updated_at IS NULL THEN datetime('now') ELSE NEW.updated_at END
        WHERE id = NEW.id;
        INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
        VALUES ('${table}', (SELECT uuid FROM ${table} WHERE id = NEW.id), 'upsert', datetime('now'));
      END;
    `);

    // Create AFTER UPDATE trigger
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_after_update AFTER UPDATE ON ${table} FOR EACH ROW
      WHEN (SELECT value FROM app_settings WHERE key='sync_applying') IS NOT '1'
      AND (NEW.uuid IS NOT NULL AND NEW.uuid = OLD.uuid AND (NEW.updated_at IS OLD.updated_at OR NEW.updated_at IS NULL))
      BEGIN
        UPDATE ${table} SET updated_at = datetime('now') WHERE id = NEW.id;
        INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
        VALUES ('${table}', NEW.uuid, 'upsert', datetime('now'));
      END;
    `);

    // Create AFTER DELETE trigger
    await db.execAsync(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_after_delete AFTER DELETE ON ${table} FOR EACH ROW
      WHEN (SELECT value FROM app_settings WHERE key='sync_applying') IS NOT '1'
      BEGIN
        INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
        VALUES ('${table}', OLD.uuid, 'delete', datetime('now'));
      END;
    `);
  }

  // 3. Settings triggers for allowed farm configuration keys only
  await db.execAsync(`
    CREATE TRIGGER IF NOT EXISTS trg_settings_after_insert AFTER INSERT ON app_settings FOR EACH ROW
    WHEN (SELECT value FROM app_settings WHERE key='sync_applying') IS NOT '1'
    AND NEW.key IN ('farm_name', 'admin_name', 'admin_phone', 'default_milk_rate')
    BEGIN
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      VALUES ('settings', NEW.key, 'upsert', datetime('now'));
    END;

    CREATE TRIGGER IF NOT EXISTS trg_settings_after_update AFTER UPDATE ON app_settings FOR EACH ROW
    WHEN (SELECT value FROM app_settings WHERE key='sync_applying') IS NOT '1'
    AND NEW.key IN ('farm_name', 'admin_name', 'admin_phone', 'default_milk_rate')
    BEGIN
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      VALUES ('settings', NEW.key, 'upsert', datetime('now'));
    END;
  `);
}

/**
 * Retrieve batch of pending sync queue items.
 */
export async function getPendingSyncQueue(
  db: SQLiteDatabase,
  limit: number = 500
): Promise<SyncQueueItem[]> {
  return await db.getAllAsync<SyncQueueItem>(
    'SELECT id, table_name, row_uuid, op, queued_at FROM sync_queue ORDER BY id ASC LIMIT ?;',
    [limit]
  );
}

/**
 * Clear specific processed items from sync queue.
 */
export async function clearSyncQueueRows(
  db: SQLiteDatabase,
  ids: number[]
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM sync_queue WHERE id IN (${placeholders});`, ids);
}

/**
 * Returns current count of pending unsynced changes.
 */
export async function getPendingSyncCount(db: SQLiteDatabase): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM sync_queue;'
    );
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Resolves local integer buyer_id to global buyer_uuid.
 */
export async function resolveBuyerUuid(
  db: SQLiteDatabase,
  buyerId: number
): Promise<string | null> {
  const row = await db.getFirstAsync<{ uuid: string }>(
    'SELECT uuid FROM buyers WHERE id = ? LIMIT 1;',
    [buyerId]
  );
  return row?.uuid ?? null;
}

/**
 * Resolves global buyer_uuid to local integer buyer_id.
 */
export async function resolveBuyerId(
  db: SQLiteDatabase,
  buyerUuid: string
): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM buyers WHERE uuid = ? LIMIT 1;',
    [buyerUuid]
  );
  return row?.id ?? null;
}

/**
 * Resolves local animal_id to global animal_uuid.
 */
export async function resolveAnimalUuid(
  db: SQLiteDatabase,
  animalId: number
): Promise<string | null> {
  const row = await db.getFirstAsync<{ uuid: string }>(
    'SELECT uuid FROM livestock WHERE id = ? LIMIT 1;',
    [animalId]
  );
  return row?.uuid ?? null;
}

/**
 * Resolves global animal_uuid to local animal_id.
 */
export async function resolveAnimalId(
  db: SQLiteDatabase,
  animalUuid: string
): Promise<number | null> {
  const row = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM livestock WHERE uuid = ? LIMIT 1;',
    [animalUuid]
  );
  return row?.id ?? null;
}

async function loadDemoUuidSet(db: SQLiteDatabase): Promise<Set<string>> {
  const demoSetting = await getAppSetting(db, 'demo_seed_uuids', '[]');
  try {
    return new Set<string>(JSON.parse(demoSetting));
  } catch {
    return new Set<string>();
  }
}

/** Farm this device last signed in to; used to detect switching to a different farm account. */
export async function getSyncFarmId(db: SQLiteDatabase): Promise<string | null> {
  const id = await getAppSetting(db, 'sync_farm_id', '');
  return id || null;
}

export async function setSyncFarmId(db: SQLiteDatabase, farmId: string): Promise<void> {
  await setAppSetting(db, 'sync_farm_id', farmId);
}

/**
 * Removes the built-in demo rows (buyers, sales, expenses, herd) before a real farm's data is
 * pulled onto this phone, so demo records never mix with the farm's own. Demo buyers/animals
 * that real rows still reference are kept (they become real). Runs with sync_applying so the
 * removals are NOT queued as deletes for the server.
 */
export async function purgeDemoData(db: SQLiteDatabase): Promise<number> {
  const demo = await loadDemoUuidSet(db);
  if (demo.size === 0) return 0;
  let removed = 0;

  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('sync_applying', '1');");
    try {
      // Children first (FK RESTRICT on buyers), then parents that nothing real still uses.
      for (const table of ['milk_entries', 'buyer_payments', 'livestock_activities', 'expenses'] as const) {
        const rows = await db.getAllAsync<{ uuid: string }>(`SELECT uuid FROM ${table};`);
        for (const r of rows) {
          if (demo.has(r.uuid)) {
            await db.runAsync(`DELETE FROM ${table} WHERE uuid = ?;`, [r.uuid]);
            removed++;
          }
        }
      }
      const buyers = await db.getAllAsync<{ uuid: string }>('SELECT uuid FROM buyers;');
      for (const b of buyers) {
        if (!demo.has(b.uuid)) continue;
        const res = await db.runAsync(
          `DELETE FROM buyers WHERE uuid = ?
             AND id NOT IN (SELECT buyer_id FROM milk_entries)
             AND id NOT IN (SELECT buyer_id FROM buyer_payments);`,
          [b.uuid]
        );
        removed += res.changes;
      }
      const animals = await db.getAllAsync<{ uuid: string }>('SELECT uuid FROM livestock;');
      for (const a of animals) {
        if (demo.has(a.uuid)) {
          await db.runAsync('DELETE FROM livestock WHERE uuid = ?;', [a.uuid]);
          removed++;
        }
      }
      await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('demo_seed_uuids', '[]');");
    } finally {
      await db.runAsync("DELETE FROM app_settings WHERE key = 'sync_applying';");
    }
  });
  return removed;
}

/**
 * Wipes all farm business data and sync state from this phone (used when the user confirms
 * switching to a different farm account). Not queued for sync. Language/PIN settings are kept.
 */
export async function wipeLocalFarmData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('sync_applying', '1');");
    try {
      for (const table of [
        'milk_entries',
        'buyer_payments',
        'livestock_activities',
        'expenses',
        'buyers',
        'livestock',
      ] as const) {
        await db.runAsync(`DELETE FROM ${table};`);
      }
      await db.runAsync('DELETE FROM sync_queue;');
      await db.runAsync(
        "DELETE FROM app_settings WHERE key IN ('sync_cursor', 'sync_last_at', 'sync_farm_id');"
      );
      await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('demo_seed_uuids', '[]');");
    } finally {
      await db.runAsync("DELETE FROM app_settings WHERE key = 'sync_applying';");
    }
  });
}

/**
 * Enqueues all existing local user data for initial cloud sync (omitting demo seed data).
 */
export async function enqueueAllUserDataForSync(db: SQLiteDatabase): Promise<number> {
  const demoSet = await loadDemoUuidSet(db);

  // A demo buyer/animal that real (non-demo) rows still point at is no longer "just demo":
  // promote it so it is pushed too, otherwise those rows would reference a uuid the server lacks.
  const promoted = new Set<string>();
  const buyerRefs = [
    ...(await db.getAllAsync<{ uuid: string; buyer_id: number }>('SELECT uuid, buyer_id FROM milk_entries;')),
    ...(await db.getAllAsync<{ uuid: string; buyer_id: number }>('SELECT uuid, buyer_id FROM buyer_payments;')),
  ];
  const usedBuyerIds = new Set(buyerRefs.filter((r) => !demoSet.has(r.uuid)).map((r) => r.buyer_id));
  if (usedBuyerIds.size > 0) {
    const buyers = await db.getAllAsync<{ id: number; uuid: string }>('SELECT id, uuid FROM buyers;');
    for (const b of buyers) if (usedBuyerIds.has(b.id)) promoted.add(b.uuid);
  }
  const animalRefs = await db.getAllAsync<{ uuid: string; animal_id: number | null }>(
    'SELECT uuid, animal_id FROM livestock_activities WHERE animal_id IS NOT NULL;'
  );
  const usedAnimalIds = new Set(animalRefs.filter((r) => !demoSet.has(r.uuid)).map((r) => r.animal_id));
  if (usedAnimalIds.size > 0) {
    const animals = await db.getAllAsync<{ id: number; uuid: string }>('SELECT id, uuid FROM livestock;');
    for (const a of animals) if (usedAnimalIds.has(a.id)) promoted.add(a.uuid);
  }
  for (const uuid of promoted) demoSet.delete(uuid);

  let enqueued = 0;
  for (const table of SYNCED_TABLES) {
    const rows = await db.getAllAsync<{ uuid: string }>(`SELECT uuid FROM ${table};`);
    for (const row of rows) {
      if (!demoSet.has(row.uuid)) {
        await db.runAsync(
          `INSERT INTO sync_queue (table_name, row_uuid, op, queued_at) VALUES (?, ?, 'upsert', datetime('now'));`,
          [table, row.uuid]
        );
        enqueued++;
      }
    }
  }

  // Enqueue allowed farm settings
  const settingsRows = await db.getAllAsync<{ key: string }>(
    "SELECT key FROM app_settings WHERE key IN ('farm_name', 'admin_name', 'admin_phone', 'default_milk_rate');"
  );
  for (const s of settingsRows) {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, row_uuid, op, queued_at) VALUES ('settings', ?, 'upsert', datetime('now'));`,
      [s.key]
    );
    enqueued++;
  }

  return enqueued;
}

/**
 * Retrieves all buyers.
 */
export async function getAllBuyers(db: SQLiteDatabase): Promise<Buyer[]> {
  return await db.getAllAsync<Buyer>(
    'SELECT * FROM buyers ORDER BY is_default DESC, name ASC;'
  );
}

/**
 * Retrieves the default buyer.
 */
export async function getDefaultBuyer(db: SQLiteDatabase): Promise<Buyer | null> {
  const buyer = await db.getFirstAsync<Buyer>(
    'SELECT * FROM buyers WHERE is_default = 1 LIMIT 1;'
  );
  if (buyer) return buyer;

  // Fallback to the first available buyer
  return await db.getFirstAsync<Buyer>('SELECT * FROM buyers LIMIT 1;');
}

/**
 * Adds a new buyer.
 */
export async function addBuyer(
  db: SQLiteDatabase,
  name: string,
  phone?: string,
  address?: string,
  isDefault: boolean = false
): Promise<number> {
  const now = new Date().toISOString();
  if (isDefault) {
    // Reset existing default
    await db.runAsync('UPDATE buyers SET is_default = 0;');
  }
  const result = await db.runAsync(
    'INSERT INTO buyers (name, phone, address, is_default, created_at) VALUES (?, ?, ?, ?, ?);',
    [name.trim(), phone?.trim() || null, address?.trim() || null, isDefault ? 1 : 0, now]
  );
  return result.lastInsertRowId;
}

export interface BuyerWithStats extends Buyer {
  totalLiters: number;
  totalRevenue: number;
  entriesCount: number;
  lastSaleDate: string | null;
}

/**
 * Retrieves all buyers with real-time aggregated collection statistics.
 */
export async function getBuyersWithStats(db: SQLiteDatabase): Promise<BuyerWithStats[]> {
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    phone: string | null;
    address: string | null;
    is_default: number;
    created_at: string;
    total_liters: number | null;
    total_revenue: number | null;
    entries_count: number;
    last_sale_date: string | null;
  }>(`
    SELECT 
      b.id,
      b.name,
      b.phone,
      b.address,
      b.is_default,
      b.created_at,
      COALESCE(SUM(m.liters), 0) AS total_liters,
      COALESCE(SUM(m.total_amount), 0) AS total_revenue,
      COUNT(m.id) AS entries_count,
      MAX(m.date) AS last_sale_date
    FROM buyers b
    LEFT JOIN milk_entries m ON b.id = m.buyer_id
    GROUP BY b.id
    ORDER BY b.is_default DESC, b.name ASC;
  `);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    is_default: r.is_default,
    created_at: r.created_at,
    totalLiters: Number((r.total_liters ?? 0).toFixed(2)),
    totalRevenue: Number((r.total_revenue ?? 0).toFixed(2)),
    entriesCount: r.entries_count,
    lastSaleDate: r.last_sale_date,
  }));
}

/**
 * Sets a buyer as the primary default buyer and clears previous defaults.
 */
export async function setDefaultBuyer(
  db: SQLiteDatabase,
  buyerId: number
): Promise<void> {
  await db.runAsync('UPDATE buyers SET is_default = 0;');
  await db.runAsync('UPDATE buyers SET is_default = 1 WHERE id = ?;', [buyerId]);
}

/**
 * Returns the count of historical milk entries associated with a buyer.
 */
export async function getBuyerEntriesCount(
  db: SQLiteDatabase,
  buyerId: number
): Promise<number> {
  const res = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM milk_entries WHERE buyer_id = ?;',
    [buyerId]
  );
  return res?.count ?? 0;
}

/**
 * Safely deletes a buyer only if no historical milk entries exist.
 */
export async function deleteBuyer(
  db: SQLiteDatabase,
  buyerId: number
): Promise<void> {
  const count = await getBuyerEntriesCount(db, buyerId);
  if (count > 0) {
    throw new Error(
      `Cannot delete buyer with ${count} existing milk collection records. SQLite foreign keys protect historical records.`
    );
  }
  await db.runAsync('DELETE FROM buyers WHERE id = ?;', [buyerId]);
}

/**
 * Inserts a new milk entry and returns its ID.
 */
export async function insertMilkEntry(
  db: SQLiteDatabase,
  entry: NewMilkEntry
): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO milk_entries (
      date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      entry.date,
      entry.shift,
      entry.liters,
      entry.fat_percentage,
      entry.rate_per_liter,
      entry.total_amount,
      entry.buyer_id,
      entry.buyer_name,
      entry.notes?.trim() || null,
      now,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Retrieves milk entries for a specific date (YYYY-MM-DD), optionally filtered by shift.
 */
export async function getEntriesForDate(
  db: SQLiteDatabase,
  date: string,
  shift?: ShiftType | 'All'
): Promise<MilkEntry[]> {
  if (shift && shift !== 'All') {
    return await db.getAllAsync<MilkEntry>(
      'SELECT * FROM milk_entries WHERE date = ? AND shift = ? ORDER BY id DESC;',
      [date, shift]
    );
  }
  return await db.getAllAsync<MilkEntry>(
    'SELECT * FROM milk_entries WHERE date = ? ORDER BY id DESC;',
    [date]
  );
}

/**
 * Retrieves all entries across the whole app.
 */
export async function getAllEntries(
  db: SQLiteDatabase,
  limit: number = 200
): Promise<MilkEntry[]> {
  return await db.getAllAsync<MilkEntry>(
    'SELECT * FROM milk_entries ORDER BY date DESC, id DESC LIMIT ?;',
    [limit]
  );
}

export interface FilterMilkEntriesOptions {
  startDate?: string;
  endDate?: string;
  shift?: ShiftType | 'All';
  buyerId?: number;
  searchQuery?: string;
  limit?: number;
}

/**
 * Retrieves milk entries with optional date-range, shift, and search filtering.
 */
export async function getFilteredEntries(
  db: SQLiteDatabase,
  options: FilterMilkEntriesOptions = {}
): Promise<MilkEntry[]> {
  const { startDate, endDate, shift, buyerId, searchQuery, limit = 500 } = options;
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (startDate) {
    whereClauses.push('date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('date <= ?');
    params.push(endDate);
  }
  if (shift && shift !== 'All') {
    whereClauses.push('shift = ?');
    params.push(shift);
  }
  if (buyerId !== undefined && buyerId !== null) {
    whereClauses.push('buyer_id = ?');
    params.push(buyerId);
  }
  if (searchQuery && searchQuery.trim()) {
    whereClauses.push('(buyer_name LIKE ? OR notes LIKE ? OR date LIKE ?)');
    const term = `%${searchQuery.trim()}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM milk_entries ${whereSql} ORDER BY date DESC, id DESC LIMIT ?;`;
  params.push(limit);

  return await db.getAllAsync<MilkEntry>(sql, params);
}

/**
 * Calculates aggregated summary metrics for a given date.
 */
export async function getDaySummary(
  db: SQLiteDatabase,
  date: string
): Promise<DaySummary> {
  const rows = await db.getAllAsync<MilkEntry>(
    'SELECT * FROM milk_entries WHERE date = ?;',
    [date]
  );

  let totalLiters = 0;
  let totalRevenue = 0;
  let morningLiters = 0;
  let eveningLiters = 0;
  let morningRevenue = 0;
  let eveningRevenue = 0;
  let weightedFatSum = 0;

  for (const row of rows) {
    totalLiters += row.liters;
    totalRevenue += row.total_amount;
    weightedFatSum += row.fat_percentage * row.liters;

    if (row.shift === 'Morning') {
      morningLiters += row.liters;
      morningRevenue += row.total_amount;
    } else {
      eveningLiters += row.liters;
      eveningRevenue += row.total_amount;
    }
  }

  const avgFat = totalLiters > 0 ? weightedFatSum / totalLiters : 0;

  return {
    totalLiters: Number(totalLiters.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    morningLiters: Number(morningLiters.toFixed(2)),
    eveningLiters: Number(eveningLiters.toFixed(2)),
    morningRevenue: Number(morningRevenue.toFixed(2)),
    eveningRevenue: Number(eveningRevenue.toFixed(2)),
    avgFat: Number(avgFat.toFixed(2)),
    entriesCount: rows.length,
  };
}

/**
 * Deletes a milk entry by ID.
 */
export async function deleteMilkEntry(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM milk_entries WHERE id = ?;', [id]);
}

/**
 * Updates an existing milk entry by ID.
 */
export async function updateMilkEntry(
  db: SQLiteDatabase,
  id: number,
  entry: Partial<NewMilkEntry>
): Promise<void> {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`Invalid milk entry ID: "${id}". Must be a positive integer.`);
  }

  const existing = await db.getFirstAsync<MilkEntry>(
    'SELECT * FROM milk_entries WHERE id = ?;',
    [id]
  );
  if (!existing) {
    throw new Error(`Milk entry with ID ${id} does not exist.`);
  }

  const updatedDate = entry.date !== undefined ? entry.date.trim() : existing.date;
  const updatedShift = entry.shift !== undefined ? entry.shift : existing.shift;
  if (updatedShift !== 'Morning' && updatedShift !== 'Evening') {
    throw new Error(`Invalid shift: "${updatedShift}". Must be Morning or Evening.`);
  }
  const updatedLiters = entry.liters !== undefined ? entry.liters : existing.liters;
  const updatedFat = entry.fat_percentage !== undefined ? entry.fat_percentage : existing.fat_percentage;
  const updatedRate = entry.rate_per_liter !== undefined ? entry.rate_per_liter : existing.rate_per_liter;
  const updatedAmount =
    entry.total_amount !== undefined
      ? entry.total_amount
      : Number((updatedLiters * updatedRate).toFixed(2));
  const updatedBuyerId = entry.buyer_id !== undefined ? entry.buyer_id : existing.buyer_id;
  const updatedBuyerName = entry.buyer_name !== undefined ? entry.buyer_name.trim() : existing.buyer_name;
  const updatedNotes = entry.notes !== undefined ? (entry.notes?.trim() || null) : existing.notes;

  await db.runAsync(
    `UPDATE milk_entries SET
      date = ?,
      shift = ?,
      liters = ?,
      fat_percentage = ?,
      rate_per_liter = ?,
      total_amount = ?,
      buyer_id = ?,
      buyer_name = ?,
      notes = ?
    WHERE id = ?;`,
    [
      updatedDate,
      updatedShift,
      updatedLiters,
      updatedFat,
      updatedRate,
      updatedAmount,
      updatedBuyerId,
      updatedBuyerName,
      updatedNotes ?? null,
      id,
    ]
  );
}

const VALID_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Feed',
  'Labour',
  'Veterinary',
  'Transport',
  'Utilities',
  'Maintenance',
  'Other',
];

/**
 * Validates an expense entry for numeric, date, and calculation consistency.
 */
export function validateExpenseInput(expense: NewExpense): void {
  // 1. Date validation (YYYY-MM-DD)
  if (!expense.date || !/^\d{4}-\d{2}-\d{2}$/.test(expense.date.trim())) {
    throw new Error(`Invalid date format: "${expense.date}". Expected YYYY-MM-DD.`);
  }

  // 2. Title validation
  if (!expense.title || !expense.title.trim()) {
    throw new Error('Expense title cannot be empty.');
  }

  // 3. Category validation
  if (!VALID_EXPENSE_CATEGORIES.includes(expense.category)) {
    throw new Error(`Invalid expense category: "${expense.category}".`);
  }

  // 4. Amount validation
  if (
    typeof expense.amount !== 'number' ||
    !Number.isFinite(expense.amount) ||
    expense.amount <= 0
  ) {
    throw new Error(`Invalid expense amount: "${expense.amount}". Amount must be a positive number.`);
  }

  // 5. Quantity validation (optional, but if provided must be finite and > 0)
  if (expense.quantity !== undefined && expense.quantity !== null) {
    if (
      typeof expense.quantity !== 'number' ||
      !Number.isFinite(expense.quantity) ||
      expense.quantity <= 0
    ) {
      throw new Error(`Invalid quantity: "${expense.quantity}". Quantity must be a positive number.`);
    }
  }

  // 6. Unit price validation (optional, but if provided must be finite and > 0)
  if (expense.unit_price !== undefined && expense.unit_price !== null) {
    if (
      typeof expense.unit_price !== 'number' ||
      !Number.isFinite(expense.unit_price) ||
      expense.unit_price <= 0
    ) {
      throw new Error(`Invalid unit price: "${expense.unit_price}". Unit price must be a positive number.`);
    }
  }

  // 7. Feed quantity × unit price consistency check
  if (
    expense.quantity !== undefined &&
    expense.quantity !== null &&
    expense.unit_price !== undefined &&
    expense.unit_price !== null
  ) {
    const expectedAmount = Number((expense.quantity * expense.unit_price).toFixed(2));
    const roundedAmount = Number(expense.amount.toFixed(2));
    // Allow small rounding tolerance of Rs 1 for fractional quantities or taxes
    if (Math.abs(roundedAmount - expectedAmount) > 1.0) {
      throw new Error(
        `Inconsistent feed calculation: quantity (${expense.quantity}) × unit price (Rs ${expense.unit_price}) = Rs ${expectedAmount}, but total amount was given as Rs ${roundedAmount}.`
      );
    }
  }
}

/**
 * Inserts a new expense and returns its ID.
 */
export async function insertExpense(
  db: SQLiteDatabase,
  expense: NewExpense
): Promise<number> {
  validateExpenseInput(expense);

  const now = new Date().toISOString();
  const cleanTitle = expense.title.trim();
  const cleanSupplier = expense.supplier_or_payee?.trim() || null;
  const cleanUnit = expense.unit?.trim() || null;
  const cleanPaymentMethod = expense.payment_method?.trim() || 'Cash';
  const cleanNotes = expense.notes?.trim() || null;

  const result = await db.runAsync(
    `INSERT INTO expenses (
      date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      expense.date.trim(),
      expense.category,
      cleanTitle,
      expense.amount,
      expense.quantity ?? null,
      cleanUnit,
      expense.unit_price ?? null,
      cleanSupplier,
      cleanPaymentMethod,
      cleanNotes,
      now,
    ]
  );

  return result.lastInsertRowId;
}

/**
 * Retrieves expenses with optional date-range, category, and search query filters.
 */
export async function getFilteredExpenses(
  db: SQLiteDatabase,
  options: FilterExpensesOptions = {}
): Promise<Expense[]> {
  const { startDate, endDate, category, searchQuery, limit = 500 } = options;
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (startDate) {
    whereClauses.push('date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('date <= ?');
    params.push(endDate);
  }
  if (category && category !== 'All') {
    whereClauses.push('category = ?');
    params.push(category);
  }
  if (searchQuery && searchQuery.trim()) {
    whereClauses.push('(title LIKE ? OR supplier_or_payee LIKE ? OR notes LIKE ?)');
    const term = `%${searchQuery.trim()}%`;
    params.push(term, term, term);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM expenses ${whereSql} ORDER BY date DESC, id DESC LIMIT ?;`;
  params.push(limit);

  return await db.getAllAsync<Expense>(sql, params);
}

/**
 * Aggregates summary statistics for expenses within the specified filter bounds.
 */
export async function getExpenseSummary(
  db: SQLiteDatabase,
  options: FilterExpensesOptions = {}
): Promise<ExpenseSummary> {
  const expenses = await getFilteredExpenses(db, { ...options, limit: 10000 });

  let totalExpenses = 0;
  let feedExpenses = 0;
  let otherExpenses = 0;
  let totalFeedQuantity = 0;
  let feedCount = 0;
  let otherCount = 0;

  const categoryBreakdown: Record<ExpenseCategory, number> = {
    Feed: 0,
    Labour: 0,
    Veterinary: 0,
    Transport: 0,
    Utilities: 0,
    Maintenance: 0,
    Other: 0,
  };

  for (const exp of expenses) {
    totalExpenses += exp.amount;
    if (exp.category in categoryBreakdown) {
      categoryBreakdown[exp.category] += exp.amount;
    } else {
      categoryBreakdown.Other += exp.amount;
    }

    if (exp.category === 'Feed') {
      feedExpenses += exp.amount;
      feedCount += 1;
      if (exp.quantity && exp.quantity > 0) {
        totalFeedQuantity += exp.quantity;
      }
    } else {
      otherExpenses += exp.amount;
      otherCount += 1;
    }
  }

  return {
    totalExpenses: Number(totalExpenses.toFixed(2)),
    feedExpenses: Number(feedExpenses.toFixed(2)),
    otherExpenses: Number(otherExpenses.toFixed(2)),
    totalFeedQuantity: Number(totalFeedQuantity.toFixed(2)),
    expenseCount: expenses.length,
    feedCount,
    otherCount,
    categoryBreakdown,
  };
}

/**
 * Calculates an operating financial report comparing recorded milk sales against recorded farm expenses.
 */
export async function getOperatingFinancialReport(
  db: SQLiteDatabase,
  options: FinancialReportFilterOptions = {}
): Promise<OperatingFinancialReport> {
  const { startDate, endDate } = options;

  // 1. Fetch milk sales aggregate from milk_entries in date range
  const milkWhere: string[] = [];
  const milkParams: string[] = [];
  if (startDate) {
    milkWhere.push('date >= ?');
    milkParams.push(startDate);
  }
  if (endDate) {
    milkWhere.push('date <= ?');
    milkParams.push(endDate);
  }
  const milkWhereSql = milkWhere.length > 0 ? `WHERE ${milkWhere.join(' AND ')}` : '';
  const milkResult = await db.getFirstAsync<{
    total_revenue: number | null;
    total_liters: number | null;
    entries_count: number;
  }>(
    `SELECT 
       COALESCE(SUM(total_amount), 0) AS total_revenue,
       COALESCE(SUM(liters), 0) AS total_liters,
       COUNT(id) AS entries_count
     FROM milk_entries ${milkWhereSql};`,
    milkParams
  );

  const totalMilkSalesRevenue = Number((milkResult?.total_revenue ?? 0).toFixed(2));
  const totalMilkLiters = Number((milkResult?.total_liters ?? 0).toFixed(2));
  const milkEntriesCount = milkResult?.entries_count ?? 0;

  // 2. Fetch expenses aggregate in date range
  const expenseSummary = await getExpenseSummary(db, { startDate, endDate });

  const totalExpenses = expenseSummary.totalExpenses;
  const feedExpenses = expenseSummary.feedExpenses;
  const otherExpenses = expenseSummary.otherExpenses;
  const expensesCount = expenseSummary.expenseCount;

  // 3. Operating balance: recorded milk sales revenue - recorded farm expenses
  const operatingBalance = Number((totalMilkSalesRevenue - totalExpenses).toFixed(2));

  // 4. Operating margin %: safely handle zero revenue
  const operatingMarginPercentage =
    totalMilkSalesRevenue > 0
      ? Number(((operatingBalance / totalMilkSalesRevenue) * 100).toFixed(1))
      : 0;

  const disclaimer =
    'Estimated operating balance based on recorded milk sales and farm expenses. Does not include livestock depreciation, asset valuation, or unrecorded costs. Sales revenue reflects recorded delivery receivables, not confirmed physical cash.';

  return {
    startDate,
    endDate,
    totalMilkSalesRevenue,
    totalMilkLiters,
    totalExpenses,
    feedExpenses,
    otherExpenses,
    operatingBalance,
    operatingMarginPercentage,
    milkEntriesCount,
    expensesCount,
    disclaimer,
  };
}

/**
 * Deletes an expense record by its ID.
 */
export async function deleteExpense(
  db: SQLiteDatabase,
  expenseId: number
): Promise<void> {
  if (typeof expenseId !== 'number' || !Number.isFinite(expenseId) || expenseId <= 0) {
    throw new Error(`Invalid expense ID: "${expenseId}". Must be a positive integer.`);
  }

  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM expenses WHERE id = ?;',
    [expenseId]
  );
  if (!existing) {
    throw new Error(`Expense with ID ${expenseId} does not exist.`);
  }

  await db.runAsync('DELETE FROM expenses WHERE id = ?;', [expenseId]);
}

/**
 * Updates an existing expense by ID.
 */
export async function updateExpense(
  db: SQLiteDatabase,
  id: number,
  expense: Partial<NewExpense>
): Promise<void> {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`Invalid expense ID: "${id}". Must be a positive integer.`);
  }

  const existing = await db.getFirstAsync<Expense>(
    'SELECT * FROM expenses WHERE id = ?;',
    [id]
  );
  if (!existing) {
    throw new Error(`Expense with ID ${id} does not exist.`);
  }

  const updatedDate = expense.date !== undefined ? expense.date.trim() : existing.date;
  const updatedCategory = expense.category !== undefined ? expense.category : existing.category;
  const updatedTitle = expense.title !== undefined ? expense.title.trim() : existing.title;
  const updatedAmount = expense.amount !== undefined ? expense.amount : existing.amount;
  const updatedQuantity = expense.quantity !== undefined ? expense.quantity : existing.quantity;
  const updatedUnit = expense.unit !== undefined ? (expense.unit?.trim() || null) : existing.unit;
  const updatedUnitPrice = expense.unit_price !== undefined ? expense.unit_price : existing.unit_price;
  const updatedSupplier =
    expense.supplier_or_payee !== undefined
      ? (expense.supplier_or_payee?.trim() || null)
      : existing.supplier_or_payee;
  const updatedPaymentMethod =
    expense.payment_method !== undefined
      ? (expense.payment_method?.trim() || 'Cash')
      : existing.payment_method;
  const updatedNotes = expense.notes !== undefined ? (expense.notes?.trim() || null) : existing.notes;

  const toValidate: NewExpense = {
    date: updatedDate,
    category: updatedCategory,
    title: updatedTitle,
    amount: updatedAmount,
    quantity: updatedQuantity,
    unit: updatedUnit,
    unit_price: updatedUnitPrice,
    supplier_or_payee: updatedSupplier,
    payment_method: updatedPaymentMethod,
    notes: updatedNotes,
  };
  validateExpenseInput(toValidate);

  await db.runAsync(
    `UPDATE expenses SET
      date = ?,
      category = ?,
      title = ?,
      amount = ?,
      quantity = ?,
      unit = ?,
      unit_price = ?,
      supplier_or_payee = ?,
      payment_method = ?,
      notes = ?
    WHERE id = ?;`,
    [
      updatedDate,
      updatedCategory,
      updatedTitle,
      updatedAmount,
      updatedQuantity,
      updatedUnit,
      updatedUnitPrice,
      updatedSupplier,
      updatedPaymentMethod,
      updatedNotes,
      id,
    ]
  );
}

export interface RestoreResult {
  success: boolean;
  restoredCounts: {
    buyers: number;
    milkEntries: number;
    expenses: number;
    buyerPayments?: number;
    livestock?: number;
    livestockActivities?: number;
  };
}

/**
 * Reads a complete, consistent snapshot of all DairyFlow application tables
 * (buyers, milk_entries, expenses, buyer_payments, livestock, livestock_activities)
 * and returns a versioned backup envelope.
 */
export async function getAllDataForBackup(db: SQLiteDatabase): Promise<DairyFlowBackupEnvelope> {
  const buyers = await db.getAllAsync<Buyer>(
    'SELECT * FROM buyers ORDER BY id ASC;'
  );
  const milkEntries = await db.getAllAsync<MilkEntry>(
    'SELECT * FROM milk_entries ORDER BY id ASC;'
  );
  const expenses = await db.getAllAsync<Expense>(
    'SELECT * FROM expenses ORDER BY id ASC;'
  );
  const buyerPayments = await db.getAllAsync<BuyerPayment>(
    'SELECT * FROM buyer_payments ORDER BY id ASC;'
  );
  const livestock = await db.getAllAsync<LivestockAnimal>(
    'SELECT * FROM livestock ORDER BY id ASC;'
  );
  const livestockActivities = await db.getAllAsync<LivestockActivity>(
    'SELECT * FROM livestock_activities ORDER BY id ASC;'
  );

  return createBackupEnvelope({
    buyers,
    milk_entries: milkEntries,
    expenses,
    buyer_payments: buyerPayments,
    livestock,
    livestock_activities: livestockActivities,
  });
}

/**
 * Restores all DairyFlow data from a validated backup envelope or JSON string.
 * 
 * Safety & Transaction Guarantees:
 * 1. Pre-validates the entire backup structure, types, primary keys, and foreign keys BEFORE touching the database.
 * 2. Operates entirely inside db.withTransactionAsync() on the existing active SQLite connection.
 * 3. Never disables foreign-key enforcement.
 * 4. Deletes dependent child records (milk_entries, payments, activities) before parent records to honor ON DELETE RESTRICT.
 * 5. Inserts parent buyers & livestock first, preserving exact IDs, before inserting child entries referencing them.
 * 6. Executes PRAGMA foreign_key_check and PRAGMA quick_check before commit.
 * 7. Enqueues a full re-upsert into sync_queue so cloud sync remains converged.
 * 8. Any error or constraint violation triggers an automatic ROLLBACK, preserving original database state completely.
 */
export async function restoreAllDataFromBackup(
  db: SQLiteDatabase,
  backupData: unknown
): Promise<RestoreResult> {
  let envelope: DairyFlowBackupEnvelope;

  if (typeof backupData === 'string') {
    envelope = parseAndValidateBackupJson(backupData);
  } else {
    const valResult = validateBackupPayload(backupData);
    if (!valResult.isValid || !valResult.envelope) {
      throw new Error(
        `Backup validation failed with ${valResult.errors.length} error(s):\n• ${valResult.errors.join('\n• ')}`
      );
    }
    envelope = valResult.envelope;
  }

  const {
    buyers,
    milk_entries,
    expenses,
    buyer_payments = [],
    livestock = [],
    livestock_activities = [],
  } = envelope.data;

  const executeRestoreOperations = async (target: SQLiteDatabase) => {
    // 0. Disable sync trigger noise during bulk restore
    await target.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('sync_applying', '1');");

    // 1. Delete dependent child records first to satisfy foreign keys
    await target.runAsync('DELETE FROM milk_entries;');
    await target.runAsync('DELETE FROM buyer_payments;');
    await target.runAsync('DELETE FROM livestock_activities;');
    await target.runAsync('DELETE FROM expenses;');

    // 2. Delete parent records
    await target.runAsync('DELETE FROM livestock;');
    await target.runAsync('DELETE FROM buyers;');

    // 3. Insert parent buyers preserving original IDs
    for (const buyer of buyers) {
      await target.runAsync(
        `INSERT INTO buyers (id, name, phone, address, is_default, created_at, uuid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, lower(hex(randomblob(16)))), COALESCE(?, datetime('now')));`,
        [
          buyer.id,
          buyer.name,
          buyer.phone ?? null,
          buyer.address ?? null,
          buyer.is_default,
          buyer.created_at,
          buyer.uuid ?? null,
          buyer.updated_at ?? null,
        ]
      );
    }

    // 4. Insert livestock
    for (const animal of livestock) {
      await target.runAsync(
        `INSERT INTO livestock (id, tag_number, name, species, gender, status, breed, birth_date, notes, created_at, uuid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, lower(hex(randomblob(16)))), COALESCE(?, datetime('now')));`,
        [
          animal.id,
          animal.tag_number,
          animal.name ?? null,
          animal.species,
          animal.gender,
          animal.status,
          animal.breed ?? null,
          animal.birth_date ?? null,
          animal.notes ?? null,
          animal.created_at,
          animal.uuid ?? null,
          animal.updated_at ?? null,
        ]
      );
    }

    // 5. Insert milk entries referencing buyers
    for (const entry of milk_entries) {
      await target.runAsync(
        `INSERT INTO milk_entries (id, date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, notes, created_at, uuid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, lower(hex(randomblob(16)))), COALESCE(?, datetime('now')));`,
        [
          entry.id,
          entry.date,
          entry.shift,
          entry.liters,
          entry.fat_percentage,
          entry.rate_per_liter,
          entry.total_amount,
          entry.buyer_id,
          entry.buyer_name,
          entry.notes ?? null,
          entry.created_at,
          entry.uuid ?? null,
          entry.updated_at ?? null,
        ]
      );
    }

    // 6. Insert buyer payments referencing buyers
    for (const payment of buyer_payments) {
      await target.runAsync(
        `INSERT INTO buyer_payments (id, buyer_id, date, amount, payment_method, received_by, notes, created_at, uuid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, lower(hex(randomblob(16)))), COALESCE(?, datetime('now')));`,
        [
          payment.id,
          payment.buyer_id,
          payment.date,
          payment.amount,
          payment.payment_method || 'Cash',
          payment.received_by ?? null,
          payment.notes ?? null,
          payment.created_at,
          payment.uuid ?? null,
          payment.updated_at ?? null,
        ]
      );
    }

    // 7. Insert livestock activities referencing livestock
    for (const act of livestock_activities) {
      await target.runAsync(
        `INSERT INTO livestock_activities (id, animal_id, animal_tag, activity_type, title, date, notes, created_at, uuid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, lower(hex(randomblob(16)))), COALESCE(?, datetime('now')));`,
        [
          act.id,
          act.animal_id ?? null,
          act.animal_tag,
          act.activity_type,
          act.title,
          act.date,
          act.notes ?? null,
          act.created_at,
          act.uuid ?? null,
          act.updated_at ?? null,
        ]
      );
    }

    // 8. Insert farm expenses
    for (const exp of expenses) {
      await target.runAsync(
        `INSERT INTO expenses (id, date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, notes, created_at, uuid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, lower(hex(randomblob(16)))), COALESCE(?, datetime('now')));`,
        [
          exp.id,
          exp.date,
          exp.category,
          exp.title,
          exp.amount,
          exp.quantity ?? null,
          exp.unit ?? null,
          exp.unit_price ?? null,
          exp.supplier_or_payee ?? null,
          exp.payment_method ?? 'Cash',
          exp.notes ?? null,
          exp.created_at,
          exp.uuid ?? null,
          exp.updated_at ?? null,
        ]
      );
    }

    // 9. Pre-commit Foreign Key Integrity Check
    const fkViolations = await target.getAllAsync<{
      table: string;
      rowid: number;
      parent: string;
      fkid: number;
    }>('PRAGMA foreign_key_check;');

    if (fkViolations && fkViolations.length > 0) {
      throw new Error(
        `Foreign key integrity check failed after restore: ${JSON.stringify(fkViolations)}`
      );
    }

    // 10. Pre-commit Quick Database Integrity Check
    const quickCheck = await target.getAllAsync<{ integrity_check?: string; quick_check?: string }>(
      'PRAGMA quick_check;'
    );
    const checkStatus = quickCheck[0]?.integrity_check || quickCheck[0]?.quick_check;
    if (checkStatus !== 'ok') {
      throw new Error(`Database integrity quick check failed: ${JSON.stringify(quickCheck)}`);
    }

    // 11. Clear existing sync_queue and enqueue full re-upsert of restored data
    await target.runAsync('DELETE FROM sync_queue;');
    await target.runAsync(`
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      SELECT 'buyers', uuid, 'upsert', datetime('now') FROM buyers;
    `);
    await target.runAsync(`
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      SELECT 'livestock', uuid, 'upsert', datetime('now') FROM livestock;
    `);
    await target.runAsync(`
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      SELECT 'milk_entries', uuid, 'upsert', datetime('now') FROM milk_entries;
    `);
    await target.runAsync(`
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      SELECT 'buyer_payments', uuid, 'upsert', datetime('now') FROM buyer_payments;
    `);
    await target.runAsync(`
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      SELECT 'livestock_activities', uuid, 'upsert', datetime('now') FROM livestock_activities;
    `);
    await target.runAsync(`
      INSERT INTO sync_queue (table_name, row_uuid, op, queued_at)
      SELECT 'expenses', uuid, 'upsert', datetime('now') FROM expenses;
    `);

    // 12. Clear sync_applying flag
    await target.runAsync("DELETE FROM app_settings WHERE key = 'sync_applying';");
  };

  // On native platforms (iOS/Android), use withExclusiveTransactionAsync to open a dedicated connection
  // with an exclusive lock, ensuring other async queries cannot interleave during data replacement.
  // Fall back to withTransactionAsync on web or environments where exclusive transactions are not available.
  if (Platform.OS !== 'web' && typeof (db as any).withExclusiveTransactionAsync === 'function') {
    await (db as any).withExclusiveTransactionAsync(async (txn: unknown) => {
      await executeRestoreOperations(txn as SQLiteDatabase);
    });
  } else {
    await db.withTransactionAsync(async () => {
      await executeRestoreOperations(db);
    });
  }

  return {
    success: true,
    restoredCounts: {
      buyers: buyers.length,
      milkEntries: milk_entries.length,
      expenses: expenses.length,
      buyerPayments: buyer_payments.length,
      livestock: livestock.length,
      livestockActivities: livestock_activities.length,
    },
  };
}

// ==========================================
// LIVESTOCK & HERD QUERIES & MUTATIONS
// ==========================================

/**
 * Retrieves the aggregated summary of the livestock herd.
 */
export async function getLivestockSummary(db: SQLiteDatabase): Promise<LivestockSummary> {
  const animals = await db.getAllAsync<{ species: AnimalSpecies; gender: AnimalGender; status: AnimalStatus }>(
    'SELECT species, gender, status FROM livestock;'
  );

  let lactatingCount = 0;
  let cowsCount = 0;
  let cowsLactating = 0;
  let buffaloesCount = 0;
  let buffaloesLactating = 0;
  let calvesCount = 0;
  let calvesFemale = 0;
  let calvesMale = 0;

  for (const a of animals) {
    if (a.species === 'Cow') {
      cowsCount++;
      if (a.status === 'Lactating') {
        cowsLactating++;
        lactatingCount++;
      }
    } else if (a.species === 'Buffalo') {
      buffaloesCount++;
      if (a.status === 'Lactating') {
        buffaloesLactating++;
        lactatingCount++;
      }
    } else if (a.species === 'Calf') {
      calvesCount++;
      if (a.gender === 'Female') calvesFemale++;
      else calvesMale++;
    }
  }

  return {
    totalAnimals: animals.length,
    lactatingCount,
    cowsCount,
    cowsLactating,
    buffaloesCount,
    buffaloesLactating,
    calvesCount,
    calvesFemale,
    calvesMale,
  };
}

/**
 * Retrieves livestock animals, optionally filtered by species.
 */
export async function getAllLivestock(
  db: SQLiteDatabase,
  species?: AnimalSpecies
): Promise<LivestockAnimal[]> {
  if (species) {
    return await db.getAllAsync<LivestockAnimal>(
      'SELECT * FROM livestock WHERE species = ? ORDER BY tag_number ASC;',
      [species]
    );
  }
  return await db.getAllAsync<LivestockAnimal>(
    'SELECT * FROM livestock ORDER BY species ASC, tag_number ASC;'
  );
}

/**
 * Inserts a new livestock animal into the database.
 */
export async function insertLivestockAnimal(
  db: SQLiteDatabase,
  animal: NewLivestockAnimal
): Promise<number> {
  if (!animal.tag_number || !animal.tag_number.trim()) {
    throw new Error('Animal tag number is required.');
  }

  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO livestock (tag_number, name, species, gender, status, breed, birth_date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      animal.tag_number.trim(),
      animal.name?.trim() || null,
      animal.species,
      animal.gender,
      animal.status,
      animal.breed?.trim() || null,
      animal.birth_date?.trim() || null,
      animal.notes?.trim() || null,
      now,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Deletes a livestock animal from the database.
 */
export async function deleteLivestockAnimal(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM livestock WHERE id = ?;', [id]);
}

/**
 * Updates an existing livestock animal by ID.
 */
export async function updateLivestockAnimal(
  db: SQLiteDatabase,
  id: number,
  animal: Partial<NewLivestockAnimal>
): Promise<void> {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`Invalid livestock animal ID: "${id}". Must be a positive integer.`);
  }

  const existing = await db.getFirstAsync<LivestockAnimal>(
    'SELECT * FROM livestock WHERE id = ?;',
    [id]
  );
  if (!existing) {
    throw new Error(`Livestock animal with ID ${id} does not exist.`);
  }

  const updatedTag = animal.tag_number !== undefined ? animal.tag_number.trim() : existing.tag_number;
  const updatedName = animal.name !== undefined ? (animal.name?.trim() || null) : existing.name;
  const updatedSpecies = animal.species !== undefined ? animal.species : existing.species;
  const updatedGender = animal.gender !== undefined ? animal.gender : existing.gender;
  const updatedStatus = animal.status !== undefined ? animal.status : existing.status;
  const updatedBreed = animal.breed !== undefined ? (animal.breed?.trim() || null) : existing.breed;
  const updatedBirthDate = animal.birth_date !== undefined ? (animal.birth_date?.trim() || null) : existing.birth_date;
  const updatedNotes = animal.notes !== undefined ? (animal.notes?.trim() || null) : existing.notes;

  await db.runAsync(
    `UPDATE livestock SET
      tag_number = ?,
      name = ?,
      species = ?,
      gender = ?,
      status = ?,
      breed = ?,
      birth_date = ?,
      notes = ?
    WHERE id = ?;`,
    [
      updatedTag,
      updatedName ?? null,
      updatedSpecies,
      updatedGender,
      updatedStatus,
      updatedBreed ?? null,
      updatedBirthDate ?? null,
      updatedNotes ?? null,
      id,
    ]
  );
}

/**
 * Retrieves recent livestock activities.
 */
export async function getRecentActivities(
  db: SQLiteDatabase,
  limit: number = 20
): Promise<LivestockActivity[]> {
  return await db.getAllAsync<LivestockActivity>(
    'SELECT * FROM livestock_activities ORDER BY date DESC, id DESC LIMIT ?;',
    [limit]
  );
}

/**
 * Inserts a new livestock activity.
 */
export async function insertLivestockActivity(
  db: SQLiteDatabase,
  activity: NewLivestockActivity
): Promise<number> {
  if (!activity.title || !activity.title.trim()) {
    throw new Error('Activity title is required.');
  }
  if (!activity.animal_tag || !activity.animal_tag.trim()) {
    throw new Error('Animal tag is required.');
  }

  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT INTO livestock_activities (animal_id, animal_tag, activity_type, title, date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      activity.animal_id ?? null,
      activity.animal_tag.trim(),
      activity.activity_type,
      activity.title.trim(),
      activity.date || now.split('T')[0],
      activity.notes?.trim() || null,
      now,
    ]
  );
  return result.lastInsertRowId;
}

// ==========================================
// BUYER PAYMENTS & LEDGER QUERIES
// ==========================================

/**
 * Retrieves a single buyer by ID.
 */
export async function getBuyerById(
  db: SQLiteDatabase,
  id: number
): Promise<Buyer | null> {
  return await db.getFirstAsync<Buyer>(
    'SELECT * FROM buyers WHERE id = ? LIMIT 1;',
    [id]
  );
}

/**
 * Records a new payment received from a buyer.
 */
export async function recordBuyerPayment(
  db: SQLiteDatabase,
  payment: NewBuyerPayment
): Promise<number> {
  if (!payment.buyer_id) {
    throw new Error('Buyer ID is required.');
  }
  if (!payment.amount || payment.amount <= 0 || isNaN(payment.amount)) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const now = new Date().toISOString();
  const date = payment.date || now.split('T')[0];

  const result = await db.runAsync(
    `INSERT INTO buyer_payments (buyer_id, date, amount, payment_method, received_by, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      payment.buyer_id,
      date,
      payment.amount,
      payment.payment_method || 'Cash',
      payment.received_by?.trim() || null,
      payment.notes?.trim() || null,
      now,
    ]
  );
  return result.lastInsertRowId;
}

/**
 * Deletes a recorded buyer payment.
 */
export async function deleteBuyerPayment(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM buyer_payments WHERE id = ?;', [id]);
}

/**
 * Retrieves payment history for a buyer, optionally within a date range.
 */
export async function getBuyerPayments(
  db: SQLiteDatabase,
  buyerId: number,
  startDate?: string,
  endDate?: string
): Promise<BuyerPayment[]> {
  const whereClauses: string[] = ['buyer_id = ?'];
  const params: (string | number)[] = [buyerId];

  if (startDate) {
    whereClauses.push('date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    whereClauses.push('date <= ?');
    params.push(endDate);
  }

  return await db.getAllAsync<BuyerPayment>(
    `SELECT * FROM buyer_payments WHERE ${whereClauses.join(' AND ')} ORDER BY date DESC, id DESC;`,
    params
  );
}

/**
 * Calculates a complete ledger statement for a buyer within an optional date range.
 * Opening balance reflects cumulative net position prior to startDate.
 */
export async function getBuyerLedger(
  db: SQLiteDatabase,
  buyerId: number,
  startDate?: string,
  endDate?: string
): Promise<BuyerLedgerSummary | null> {
  const buyer = await getBuyerById(db, buyerId);
  if (!buyer) return null;

  // Calculate opening balance before startDate
  let openingBalance = 0;
  if (startDate) {
    const priorSalesRow = await db.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(total_amount) as total FROM milk_entries WHERE buyer_id = ? AND date < ?;',
      [buyerId, startDate]
    );
    const priorPaymentsRow = await db.getFirstAsync<{ total: number | null }>(
      'SELECT SUM(amount) as total FROM buyer_payments WHERE buyer_id = ? AND date < ?;',
      [buyerId, startDate]
    );
    const priorSales = priorSalesRow?.total ?? 0;
    const priorPayments = priorPaymentsRow?.total ?? 0;
    openingBalance = priorSales - priorPayments;
  }

  // Filtered milk entries in the current period
  const entriesWhere: string[] = ['buyer_id = ?'];
  const entriesParams: (string | number)[] = [buyerId];
  if (startDate) {
    entriesWhere.push('date >= ?');
    entriesParams.push(startDate);
  }
  if (endDate) {
    entriesWhere.push('date <= ?');
    entriesParams.push(endDate);
  }

  const entries = await db.getAllAsync<MilkEntry>(
    `SELECT * FROM milk_entries WHERE ${entriesWhere.join(' AND ')} ORDER BY date DESC, shift DESC, id DESC;`,
    entriesParams
  );

  // Payments in the current period
  const payments = await getBuyerPayments(db, buyerId, startDate, endDate);

  let totalSalesVolume = 0;
  let totalSalesAmount = 0;
  for (const entry of entries) {
    totalSalesVolume += entry.liters;
    totalSalesAmount += entry.total_amount;
  }

  let totalPaymentsReceived = 0;
  for (const payment of payments) {
    totalPaymentsReceived += payment.amount;
  }

  const outstandingBalance = openingBalance + totalSalesAmount - totalPaymentsReceived;

  return {
    buyer,
    openingBalance: Math.round(openingBalance),
    totalSalesVolume: Number(totalSalesVolume.toFixed(2)),
    totalSalesAmount: Math.round(totalSalesAmount),
    totalPaymentsReceived: Math.round(totalPaymentsReceived),
    outstandingBalance: Math.round(outstandingBalance),
    payments,
    entries,
  };
}

/**
 * Retrieves aggregated financial metrics for all buyers (for directory & balances list).
 */
export async function getBuyersOverview(
  db: SQLiteDatabase,
  startDate?: string,
  endDate?: string
): Promise<BuyerOverviewItem[]> {
  const buyers = await getAllBuyers(db);
  const items: BuyerOverviewItem[] = [];

  for (const buyer of buyers) {
    // Current period volume
    let weeklyLiters = 0;
    if (startDate && endDate) {
      const volRow = await db.getFirstAsync<{ liters: number | null }>(
        'SELECT SUM(liters) as liters FROM milk_entries WHERE buyer_id = ? AND date >= ? AND date <= ?;',
        [buyer.id, startDate, endDate]
      );
      weeklyLiters = volRow?.liters ?? 0;
    } else {
      const volRow = await db.getFirstAsync<{ liters: number | null }>(
        'SELECT SUM(liters) as liters FROM milk_entries WHERE buyer_id = ?;',
        [buyer.id]
      );
      weeklyLiters = volRow?.liters ?? 0;
    }

    // Cumulative sales up to endDate or all-time
    const salesRow = await db.getFirstAsync<{ total: number | null }>(
      endDate
        ? 'SELECT SUM(total_amount) as total FROM milk_entries WHERE buyer_id = ? AND date <= ?;'
        : 'SELECT SUM(total_amount) as total FROM milk_entries WHERE buyer_id = ?;',
      endDate ? [buyer.id, endDate] : [buyer.id]
    );
    const totalSalesAmount = salesRow?.total ?? 0;

    // Cumulative payments up to endDate or all-time
    const paidRow = await db.getFirstAsync<{ total: number | null }>(
      endDate
        ? 'SELECT SUM(amount) as total FROM buyer_payments WHERE buyer_id = ? AND date <= ?;'
        : 'SELECT SUM(amount) as total FROM buyer_payments WHERE buyer_id = ?;',
      endDate ? [buyer.id, endDate] : [buyer.id]
    );
    const totalPaidAmount = paidRow?.total ?? 0;

    const balanceDue = totalSalesAmount - totalPaidAmount;
    const percentagePaid =
      totalSalesAmount > 0
        ? Math.min(100, Math.max(0, Math.round((totalPaidAmount / totalSalesAmount) * 100)))
        : 100;

    items.push({
      buyer,
      weeklyLiters: Number(weeklyLiters.toFixed(2)),
      totalSalesAmount: Math.round(totalSalesAmount),
      totalPaidAmount: Math.round(totalPaidAmount),
      balanceDue: Math.round(balanceDue),
      percentagePaid,
    });
  }

  // Sort: default buyer first, then descending by balance due
  return items.sort((a, b) => {
    if (a.buyer.is_default !== b.buyer.is_default) {
      return b.buyer.is_default - a.buyer.is_default;
    }
    return b.balanceDue - a.balanceDue;
  });
}

// ==========================================
// WEEKLY ACCOUNTS & SETTLEMENT QUERIES
// ==========================================

export interface WeeklyExpenseCategoryItem {
  category: ExpenseCategory;
  amount: number;
  percentage: number;
}

export interface WeeklyFinancialReport {
  startDate: string;
  endDate: string;
  totalMilkLiters: number;
  morningLiters: number;
  eveningLiters: number;
  avgDailyLiters: number;
  totalMilkRevenue: number;
  totalExpenses: number;
  feedExpenses: number;
  otherExpenses: number;
  netOperatingProfit: number;
  totalCollections: number;
  totalReceivables: number;
  expenseCategories: WeeklyExpenseCategoryItem[];
  entriesCount: number;
  expensesCount: number;
}

/**
 * Calculates a complete financial settlement report for a Friday-to-Thursday weekly cycle.
 * Aggregates milk deliveries, shift breakdowns, category expenses, net profit, and receivables.
 */
export async function getWeeklyFinancialReport(
  db: SQLiteDatabase,
  startDate: string,
  endDate: string
): Promise<WeeklyFinancialReport> {
  // 1. Milk entries in the date range
  const milkRows = await db.getAllAsync<MilkEntry>(
    'SELECT * FROM milk_entries WHERE date >= ? AND date <= ?;',
    [startDate, endDate]
  );

  let totalMilkLiters = 0;
  let morningLiters = 0;
  let eveningLiters = 0;
  let totalMilkRevenue = 0;

  for (const m of milkRows) {
    totalMilkLiters += m.liters;
    totalMilkRevenue += m.total_amount;
    if (m.shift === 'Morning') {
      morningLiters += m.liters;
    } else {
      eveningLiters += m.liters;
    }
  }

  const avgDailyLiters = Number((totalMilkLiters / 7).toFixed(1));

  // 2. Expenses in the date range
  const expenseRows = await db.getAllAsync<Expense>(
    'SELECT * FROM expenses WHERE date >= ? AND date <= ?;',
    [startDate, endDate]
  );

  let totalExpenses = 0;
  let feedExpenses = 0;
  let otherExpenses = 0;
  const categoryTotals = new Map<ExpenseCategory, number>();

  for (const exp of expenseRows) {
    totalExpenses += exp.amount;
    if (exp.category === 'Feed') {
      feedExpenses += exp.amount;
    } else {
      otherExpenses += exp.amount;
    }
    const current = categoryTotals.get(exp.category) ?? 0;
    categoryTotals.set(exp.category, current + exp.amount);
  }

  const expenseCategories: WeeklyExpenseCategoryItem[] = [];
  categoryTotals.forEach((amt, cat) => {
    const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
    expenseCategories.push({
      category: cat,
      amount: Math.round(amt),
      percentage: pct,
    });
  });
  expenseCategories.sort((a, b) => b.amount - a.amount);

  // 3. Buyer payments in this period
  const paymentRow = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(amount) as total FROM buyer_payments WHERE date >= ? AND date <= ?;',
    [startDate, endDate]
  );
  const totalCollections = paymentRow?.total ?? 0;

  // 4. Total cumulative receivables across all buyers up to endDate
  const buyersOverview = await getBuyersOverview(db, undefined, endDate);
  const totalReceivables = buyersOverview.reduce(
    (sum, item) => sum + (item.balanceDue > 0 ? item.balanceDue : 0),
    0
  );

  // 5. Net operating profit
  const netOperatingProfit = Math.round(totalMilkRevenue - totalExpenses);

  return {
    startDate,
    endDate,
    totalMilkLiters: Number(totalMilkLiters.toFixed(2)),
    morningLiters: Number(morningLiters.toFixed(2)),
    eveningLiters: Number(eveningLiters.toFixed(2)),
    avgDailyLiters,
    totalMilkRevenue: Math.round(totalMilkRevenue),
    totalExpenses: Math.round(totalExpenses),
    feedExpenses: Math.round(feedExpenses),
    otherExpenses: Math.round(otherExpenses),
    netOperatingProfit,
    totalCollections: Math.round(totalCollections),
    totalReceivables: Math.round(totalReceivables),
    expenseCategories,
    entriesCount: milkRows.length,
    expensesCount: expenseRows.length,
  };
}

/**
 * Retrieve a persistent application setting (e.g. language, farm name, default rate).
 */
export async function getAppSetting(
  db: SQLiteDatabase,
  key: string,
  defaultValue: string = ''
): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
      [key]
    );
    return row?.value ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Store a persistent application setting.
 */
export async function setAppSetting(
  db: SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  try {
    await db.runAsync(
      'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
      [key, value]
    );
  } catch (err) {
    console.error('Error saving app setting:', err);
  }
}

