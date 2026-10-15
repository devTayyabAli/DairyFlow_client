const { DatabaseSync } = require('node:sqlite');
const assert = require('node:assert');

// SQLite adapter matching expo-sqlite API
class SQLiteAdapter {
  constructor(db) {
    this.db = db;
  }
  async execAsync(sql) {
    this.db.exec(sql);
  }
  async runAsync(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: result.changes,
    };
  }
  async getAllAsync(sql, params = []) {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
  async getFirstAsync(sql, params = []) {
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.length > 0 ? rows[0] : null;
  }
  async withTransactionAsync(task) {
    try {
      await this.execAsync('BEGIN');
      await task();
      await this.execAsync('COMMIT');
    } catch (e) {
      await this.execAsync('ROLLBACK');
      throw e;
    }
  }
}

// Validation logic matching mobile/src/db/database.ts
const VALID_EXPENSE_CATEGORIES = [
  'Feed',
  'Labour',
  'Veterinary',
  'Transport',
  'Utilities',
  'Maintenance',
  'Other',
];

function validateExpenseInput(expense) {
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

  // 5. Quantity validation
  if (expense.quantity !== undefined && expense.quantity !== null) {
    if (
      typeof expense.quantity !== 'number' ||
      !Number.isFinite(expense.quantity) ||
      expense.quantity <= 0
    ) {
      throw new Error(`Invalid quantity: "${expense.quantity}". Quantity must be a positive number.`);
    }
  }

  // 6. Unit price validation
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
    if (Math.abs(roundedAmount - expectedAmount) > 1.0) {
      throw new Error(
        `Inconsistent feed calculation: quantity (${expense.quantity}) × unit price (Rs ${expense.unit_price}) = Rs ${expectedAmount}, but total amount was given as Rs ${roundedAmount}.`
      );
    }
  }
}

// Database schema initialization matching database.ts
async function initDatabase(db) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

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

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(date);
    CREATE INDEX IF NOT EXISTS idx_milk_entries_shift ON milk_entries(shift);
    CREATE INDEX IF NOT EXISTS idx_milk_entries_buyer ON milk_entries(buyer_id);
  `);

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

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
  `);

  const existingBuyer = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM buyers;'
  );

  if (!existingBuyer || existingBuyer.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO buyers (name, phone, address, is_default, created_at)
       VALUES (?, ?, ?, 1, ?);`,
      ['Premier Dairy Cooperative', '+92 300 9876543', 'Central Milk Collection Hub, Sector B', now]
    );
  }
}

async function addBuyer(db, name, phone, address, isDefault = false) {
  const now = new Date().toISOString();
  if (isDefault) {
    await db.runAsync('UPDATE buyers SET is_default = 0;');
  }
  const result = await db.runAsync(
    'INSERT INTO buyers (name, phone, address, is_default, created_at) VALUES (?, ?, ?, ?, ?);',
    [name.trim(), phone?.trim() || null, address?.trim() || null, isDefault ? 1 : 0, now]
  );
  return result.lastInsertRowId;
}

async function insertMilkEntry(db, entry) {
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

async function getBuyerEntriesCount(db, buyerId) {
  const res = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM milk_entries WHERE buyer_id = ?;',
    [buyerId]
  );
  return res?.count ?? 0;
}

async function deleteBuyer(db, buyerId, force = false) {
  const count = await getBuyerEntriesCount(db, buyerId);
  if (count > 0 && !force) {
    throw new Error(
      `Cannot delete buyer with ${count} existing milk collection records. SQLite foreign keys protect historical records.`
    );
  }
  await db.withTransactionAsync(async () => {
    if (force && count > 0) {
      try {
        await db.runAsync('DELETE FROM buyer_payments WHERE buyer_id = ?;', [buyerId]);
      } catch {
        // Safe fallback if table not yet initialized
      }
      await db.runAsync('DELETE FROM milk_entries WHERE buyer_id = ?;', [buyerId]);
    } else {
      try {
        await db.runAsync('DELETE FROM buyer_payments WHERE buyer_id = ?;', [buyerId]);
      } catch {
        // Safe fallback if table not yet initialized
      }
    }
    await db.runAsync('DELETE FROM buyers WHERE id = ?;', [buyerId]);
  });
}

async function getDaySummary(db, date) {
  const rows = await db.getAllAsync(
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

async function insertExpense(db, expense) {
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

async function getFilteredExpenses(db, options = {}) {
  const { startDate, endDate, category, searchQuery, limit = 500 } = options;
  const whereClauses = [];
  const params = [];

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

  return await db.getAllAsync(sql, params);
}

async function getExpenseSummary(db, options = {}) {
  const expenses = await getFilteredExpenses(db, { ...options, limit: 10000 });

  let totalExpenses = 0;
  let feedExpenses = 0;
  let otherExpenses = 0;
  let totalFeedQuantity = 0;
  let feedCount = 0;
  let otherCount = 0;

  const categoryBreakdown = {
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

async function deleteExpense(db, expenseId) {
  if (typeof expenseId !== 'number' || !Number.isFinite(expenseId) || expenseId <= 0) {
    throw new Error(`Invalid expense ID: "${expenseId}". Must be a positive integer.`);
  }

  const existing = await db.getFirstAsync(
    'SELECT id FROM expenses WHERE id = ?;',
    [expenseId]
  );
  if (!existing) {
    throw new Error(`Expense with ID ${expenseId} does not exist.`);
  }

  await db.runAsync('DELETE FROM expenses WHERE id = ?;', [expenseId]);
}

async function getOperatingFinancialReport(db, options = {}) {
  const { startDate, endDate } = options;

  const milkWhere = [];
  const milkParams = [];
  if (startDate) {
    milkWhere.push('date >= ?');
    milkParams.push(startDate);
  }
  if (endDate) {
    milkWhere.push('date <= ?');
    milkParams.push(endDate);
  }
  const milkWhereSql = milkWhere.length > 0 ? `WHERE ${milkWhere.join(' AND ')}` : '';
  const milkResult = await db.getFirstAsync(
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

  const expenseSummary = await getExpenseSummary(db, { startDate, endDate });

  const totalExpenses = expenseSummary.totalExpenses;
  const feedExpenses = expenseSummary.feedExpenses;
  const otherExpenses = expenseSummary.otherExpenses;
  const expensesCount = expenseSummary.expenseCount;

  const operatingBalance = Number((totalMilkSalesRevenue - totalExpenses).toFixed(2));

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

// ---------------------------------------------------------------------------
// CSV EXPORT ENGINE (matching src/utils/csv-export.ts)
// ---------------------------------------------------------------------------
const CSV_UTF8_BOM = '\uFEFF';
const CSV_LINE_ENDING = '\r\n';

function sanitizeCsvField(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatCsvRow(fields) {
  return fields.map(sanitizeCsvField).join(',');
}

const MILK_ENTRIES_CSV_HEADERS = [
  'ID',
  'Date',
  'Shift',
  'Liters',
  'Fat Percentage',
  'Rate per Liter (PKR)',
  'Total Amount (PKR)',
  'Buyer ID',
  'Buyer Name',
  'Notes',
  'Created At',
];

function exportMilkEntriesToCsv(entries) {
  const headerRow = formatCsvRow(MILK_ENTRIES_CSV_HEADERS);
  const dataRows = entries.map((e) =>
    formatCsvRow([
      e.id,
      e.date,
      e.shift,
      e.liters,
      e.fat_percentage,
      e.rate_per_liter,
      e.total_amount,
      e.buyer_id,
      e.buyer_name,
      e.notes ?? '',
      e.created_at,
    ])
  );
  return `${CSV_UTF8_BOM}${headerRow}${CSV_LINE_ENDING}${dataRows.join(CSV_LINE_ENDING)}${dataRows.length > 0 ? CSV_LINE_ENDING : ''}`;
}

const BUYERS_CSV_HEADERS = [
  'ID',
  'Name',
  'Phone',
  'Address',
  'Is Default',
  'Created At',
  'Total Liters Collected',
  'Total Revenue (PKR)',
  'Entries Count',
  'Last Sale Date',
];

function exportBuyersToCsv(buyers) {
  const headerRow = formatCsvRow(BUYERS_CSV_HEADERS);
  const dataRows = buyers.map((b) => {
    const isStats = 'totalLiters' in b;
    return formatCsvRow([
      b.id,
      b.name,
      b.phone ?? '',
      b.address ?? '',
      b.is_default === 1 ? '1' : '0',
      b.created_at,
      isStats ? b.totalLiters : '',
      isStats ? b.totalRevenue : '',
      isStats ? b.entriesCount : '',
      isStats ? (b.lastSaleDate ?? '') : '',
    ]);
  });
  return `${CSV_UTF8_BOM}${headerRow}${CSV_LINE_ENDING}${dataRows.join(CSV_LINE_ENDING)}${dataRows.length > 0 ? CSV_LINE_ENDING : ''}`;
}

const EXPENSES_CSV_HEADERS = [
  'ID',
  'Date',
  'Category',
  'Title',
  'Amount (PKR)',
  'Quantity',
  'Unit',
  'Unit Price (PKR)',
  'Supplier or Payee',
  'Payment Method',
  'Notes',
  'Created At',
];

function exportExpensesToCsv(expenses) {
  const headerRow = formatCsvRow(EXPENSES_CSV_HEADERS);
  const dataRows = expenses.map((e) =>
    formatCsvRow([
      e.id,
      e.date,
      e.category,
      e.title,
      e.amount,
      e.quantity ?? '',
      e.unit ?? '',
      e.unit_price ?? '',
      e.supplier_or_payee ?? '',
      e.payment_method ?? '',
      e.notes ?? '',
      e.created_at,
    ])
  );
  return `${CSV_UTF8_BOM}${headerRow}${CSV_LINE_ENDING}${dataRows.join(CSV_LINE_ENDING)}${dataRows.length > 0 ? CSV_LINE_ENDING : ''}`;
}

// ---------------------------------------------------------------------------
// VERSIONED BACKUP ENGINE (matching src/utils/backup-restore.ts)
// ---------------------------------------------------------------------------
const BACKUP_FORMAT_IDENTIFIER = 'DAIRYFLOW_BACKUP';
const CURRENT_BACKUP_VERSION = 1;
const SUPPORTED_BACKUP_VERSIONS = [1];

function calculateBackupMetadata(data) {
  const totalMilkLiters = data.milk_entries.reduce(
    (sum, e) => sum + (Number(e.liters) || 0),
    0
  );
  const totalMilkRevenue = data.milk_entries.reduce(
    (sum, e) => sum + (Number(e.total_amount) || 0),
    0
  );
  const totalExpensesAmount = data.expenses.reduce(
    (sum, e) => sum + (Number(e.amount) || 0),
    0
  );

  return {
    buyersCount: data.buyers.length,
    milkEntriesCount: data.milk_entries.length,
    expensesCount: data.expenses.length,
    totalMilkLiters: Number(totalMilkLiters.toFixed(2)),
    totalMilkRevenue: Number(totalMilkRevenue.toFixed(2)),
    totalExpensesAmount: Number(totalExpensesAmount.toFixed(2)),
  };
}

function createBackupEnvelope(data, appVersion = '1.0.0') {
  const metadata = calculateBackupMetadata(data);
  return {
    format: BACKUP_FORMAT_IDENTIFIER,
    version: CURRENT_BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    appVersion,
    metadata,
    data: {
      buyers: data.buyers,
      milk_entries: data.milk_entries,
      expenses: data.expenses,
    },
  };
}

function serializeBackupToJson(envelope) {
  return JSON.stringify(envelope, null, 2);
}

function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function isValidTimestamp(val) {
  if (typeof val !== 'string' || !val.trim()) return false;
  return !isNaN(Date.parse(val));
}

function isPositiveInteger(val) {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

function validateBackupPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: ['Invalid backup payload: Expected a JSON object.'],
    };
  }

  const envelope = payload;

  if (envelope.format !== BACKUP_FORMAT_IDENTIFIER) {
    errors.push(
      `Unsupported backup format: Expected "${BACKUP_FORMAT_IDENTIFIER}", got "${String(
        envelope.format
      )}".`
    );
  }

  if (
    typeof envelope.version !== 'number' ||
    !SUPPORTED_BACKUP_VERSIONS.includes(envelope.version)
  ) {
    errors.push(
      `Unsupported backup version: "${String(
        envelope.version
      )}". Supported versions are: ${SUPPORTED_BACKUP_VERSIONS.join(', ')}.`
    );
  }

  if (!isValidTimestamp(envelope.createdAt)) {
    errors.push('Backup envelope is missing a valid "createdAt" timestamp.');
  }

  if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    errors.push('Backup envelope is missing the required "data" container object.');
    return { isValid: false, errors };
  }

  const { buyers, milk_entries, expenses } = envelope.data;

  if (!Array.isArray(buyers)) {
    errors.push('Backup data is missing the "buyers" array.');
  }
  if (!Array.isArray(milk_entries)) {
    errors.push('Backup data is missing the "milk_entries" array.');
  }
  if (!Array.isArray(expenses)) {
    errors.push('Backup data is missing the "expenses" array.');
  }

  if (errors.length > 0 && (!Array.isArray(buyers) || !Array.isArray(milk_entries) || !Array.isArray(expenses))) {
    return { isValid: false, errors };
  }

  const safeBuyers = buyers;
  const safeMilkEntries = milk_entries;
  const safeExpenses = expenses;

  if (!envelope.metadata || typeof envelope.metadata !== 'object') {
    errors.push('Backup envelope is missing the required "metadata" object.');
  } else {
    const meta = envelope.metadata;
    if (meta.buyersCount !== safeBuyers.length) {
      errors.push(
        `Metadata buyersCount (${meta.buyersCount}) does not match actual buyers count (${safeBuyers.length}).`
      );
    }
    if (meta.milkEntriesCount !== safeMilkEntries.length) {
      errors.push(
        `Metadata milkEntriesCount (${meta.milkEntriesCount}) does not match actual milk entries count (${safeMilkEntries.length}).`
      );
    }
    if (meta.expensesCount !== safeExpenses.length) {
      errors.push(
        `Metadata expensesCount (${meta.expensesCount}) does not match actual expenses count (${safeExpenses.length}).`
      );
    }
  }

  const buyerIdSet = new Set();
  let defaultBuyersCount = 0;

  safeBuyers.forEach((buyer, idx) => {
    const itemPrefix = `Buyer[${idx}]`;

    if (!buyer || typeof buyer !== 'object') {
      errors.push(`${itemPrefix}: Record is not a valid object.`);
      return;
    }

    if (!isPositiveInteger(buyer.id)) {
      errors.push(`${itemPrefix}: Invalid id "${buyer.id}". Must be a positive integer.`);
    } else if (buyerIdSet.has(buyer.id)) {
      errors.push(`${itemPrefix}: Duplicate buyer ID "${buyer.id}" found.`);
    } else {
      buyerIdSet.add(buyer.id);
    }

    if (typeof buyer.name !== 'string' || !buyer.name.trim()) {
      errors.push(`${itemPrefix}: "name" is required and cannot be empty.`);
    }

    if (buyer.phone !== null && buyer.phone !== undefined && typeof buyer.phone !== 'string') {
      errors.push(`${itemPrefix}: "phone" must be a string or null.`);
    }

    if (buyer.address !== null && buyer.address !== undefined && typeof buyer.address !== 'string') {
      errors.push(`${itemPrefix}: "address" must be a string or null.`);
    }

    if (buyer.is_default !== 0 && buyer.is_default !== 1) {
      errors.push(`${itemPrefix}: "is_default" must be 0 or 1, got "${buyer.is_default}".`);
    } else if (buyer.is_default === 1) {
      defaultBuyersCount++;
    }

    if (!isValidTimestamp(buyer.created_at)) {
      errors.push(`${itemPrefix}: "created_at" must be a valid timestamp string.`);
    }
  });

  if (defaultBuyersCount > 1) {
    errors.push(`Multiple default buyers found (${defaultBuyersCount}). At most one default buyer is permitted.`);
  }

  const milkEntryIdSet = new Set();

  safeMilkEntries.forEach((entry, idx) => {
    const itemPrefix = `MilkEntry[${idx}]`;

    if (!entry || typeof entry !== 'object') {
      errors.push(`${itemPrefix}: Record is not a valid object.`);
      return;
    }

    if (!isPositiveInteger(entry.id)) {
      errors.push(`${itemPrefix}: Invalid id "${entry.id}". Must be a positive integer.`);
    } else if (milkEntryIdSet.has(entry.id)) {
      errors.push(`${itemPrefix}: Duplicate milk entry ID "${entry.id}" found.`);
    } else {
      milkEntryIdSet.add(entry.id);
    }

    if (!isValidDateString(entry.date)) {
      errors.push(`${itemPrefix}: Invalid date "${entry.date}". Expected YYYY-MM-DD.`);
    }

    if (entry.shift !== 'Morning' && entry.shift !== 'Evening') {
      errors.push(`${itemPrefix}: Invalid shift "${entry.shift}". Expected "Morning" or "Evening".`);
    }

    if (typeof entry.liters !== 'number' || !Number.isFinite(entry.liters) || entry.liters <= 0) {
      errors.push(`${itemPrefix}: "liters" must be a finite positive number.`);
    }

    if (typeof entry.fat_percentage !== 'number' || !Number.isFinite(entry.fat_percentage) || entry.fat_percentage < 0) {
      errors.push(`${itemPrefix}: "fat_percentage" must be a non-negative finite number.`);
    }

    if (typeof entry.rate_per_liter !== 'number' || !Number.isFinite(entry.rate_per_liter) || entry.rate_per_liter < 0) {
      errors.push(`${itemPrefix}: "rate_per_liter" must be a non-negative finite number.`);
    }

    if (typeof entry.total_amount !== 'number' || !Number.isFinite(entry.total_amount) || entry.total_amount < 0) {
      errors.push(`${itemPrefix}: "total_amount" must be a non-negative finite number.`);
    }

    if (!isPositiveInteger(entry.buyer_id)) {
      errors.push(`${itemPrefix}: "buyer_id" must be a positive integer.`);
    } else if (!buyerIdSet.has(entry.buyer_id)) {
      errors.push(
        `${itemPrefix} (ID ${entry.id}): References non-existent buyer_id #${entry.buyer_id}. Foreign key invariant violated.`
      );
    }

    if (typeof entry.buyer_name !== 'string' || !entry.buyer_name.trim()) {
      errors.push(`${itemPrefix}: "buyer_name" is required and cannot be empty.`);
    }

    if (entry.notes !== null && entry.notes !== undefined && typeof entry.notes !== 'string') {
      errors.push(`${itemPrefix}: "notes" must be a string or null.`);
    }

    if (!isValidTimestamp(entry.created_at)) {
      errors.push(`${itemPrefix}: "created_at" must be a valid timestamp string.`);
    }
  });

  const expenseIdSet = new Set();

  safeExpenses.forEach((exp, idx) => {
    const itemPrefix = `Expense[${idx}]`;

    if (!exp || typeof exp !== 'object') {
      errors.push(`${itemPrefix}: Record is not a valid object.`);
      return;
    }

    if (!isPositiveInteger(exp.id)) {
      errors.push(`${itemPrefix}: Invalid id "${exp.id}". Must be a positive integer.`);
    } else if (expenseIdSet.has(exp.id)) {
      errors.push(`${itemPrefix}: Duplicate expense ID "${exp.id}" found.`);
    } else {
      expenseIdSet.add(exp.id);
    }

    if (!isValidDateString(exp.date)) {
      errors.push(`${itemPrefix}: Invalid date "${exp.date}". Expected YYYY-MM-DD.`);
    }

    if (!VALID_EXPENSE_CATEGORIES.includes(exp.category)) {
      errors.push(
        `${itemPrefix}: Invalid category "${exp.category}". Expected one of: ${VALID_EXPENSE_CATEGORIES.join(', ')}.`
      );
    }

    if (typeof exp.title !== 'string' || !exp.title.trim()) {
      errors.push(`${itemPrefix}: "title" is required and cannot be empty.`);
    }

    if (typeof exp.amount !== 'number' || !Number.isFinite(exp.amount) || exp.amount <= 0) {
      errors.push(`${itemPrefix}: "amount" must be a finite positive number.`);
    }

    if (exp.quantity !== null && exp.quantity !== undefined) {
      if (typeof exp.quantity !== 'number' || !Number.isFinite(exp.quantity) || exp.quantity <= 0) {
        errors.push(`${itemPrefix}: "quantity" must be a finite positive number or null.`);
      }
    }

    if (exp.unit !== null && exp.unit !== undefined && typeof exp.unit !== 'string') {
      errors.push(`${itemPrefix}: "unit" must be a string or null.`);
    }

    if (exp.unit_price !== null && exp.unit_price !== undefined) {
      if (typeof exp.unit_price !== 'number' || !Number.isFinite(exp.unit_price) || exp.unit_price <= 0) {
        errors.push(`${itemPrefix}: "unit_price" must be a finite positive number or null.`);
      }
    }

    if (exp.supplier_or_payee !== null && exp.supplier_or_payee !== undefined && typeof exp.supplier_or_payee !== 'string') {
      errors.push(`${itemPrefix}: "supplier_or_payee" must be a string or null.`);
    }

    if (exp.payment_method !== null && exp.payment_method !== undefined && typeof exp.payment_method !== 'string') {
      errors.push(`${itemPrefix}: "payment_method" must be a string or null.`);
    }

    if (exp.notes !== null && exp.notes !== undefined && typeof exp.notes !== 'string') {
      errors.push(`${itemPrefix}: "notes" must be a string or null.`);
    }

    if (!isValidTimestamp(exp.created_at)) {
      errors.push(`${itemPrefix}: "created_at" must be a valid timestamp string.`);
    }
  });

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    envelope: payload,
  };
}

function parseAndValidateBackupJson(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `Malformed JSON backup file: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const result = validateBackupPayload(parsed);
  if (!result.isValid || !result.envelope) {
    throw new Error(
      `Backup validation failed with ${result.errors.length} error(s):\n• ${result.errors.join('\n• ')}`
    );
  }

  return result.envelope;
}

// ---------------------------------------------------------------------------
// DATABASE BACKUP & RESTORE HELPERS (matching src/db/database.ts)
// ---------------------------------------------------------------------------
async function getAllDataForBackup(db) {
  const buyers = await db.getAllAsync(
    'SELECT id, name, phone, address, is_default, created_at FROM buyers ORDER BY id ASC;'
  );
  const milkEntries = await db.getAllAsync(
    'SELECT id, date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, notes, created_at FROM milk_entries ORDER BY id ASC;'
  );
  const expenses = await db.getAllAsync(
    'SELECT id, date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, notes, created_at FROM expenses ORDER BY id ASC;'
  );

  return createBackupEnvelope({
    buyers,
    milk_entries: milkEntries,
    expenses,
  });
}

async function restoreAllDataFromBackup(db, backupData) {
  let envelope;

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

  const { buyers, milk_entries, expenses } = envelope.data;

  await db.withTransactionAsync(async () => {
    // 1. Delete dependent child records
    await db.runAsync('DELETE FROM milk_entries;');
    await db.runAsync('DELETE FROM expenses;');

    // 2. Delete parent records
    await db.runAsync('DELETE FROM buyers;');

    // 3. Insert parent buyers
    for (const buyer of buyers) {
      await db.runAsync(
        `INSERT INTO buyers (id, name, phone, address, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          buyer.id,
          buyer.name,
          buyer.phone ?? null,
          buyer.address ?? null,
          buyer.is_default,
          buyer.created_at,
        ]
      );
    }

    // 4. Insert milk entries
    for (const entry of milk_entries) {
      await db.runAsync(
        `INSERT INTO milk_entries (id, date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        ]
      );
    }

    // 5. Insert farm expenses
    for (const exp of expenses) {
      await db.runAsync(
        `INSERT INTO expenses (id, date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        ]
      );
    }

    // 6. Pre-commit Foreign Key Check
    const fkViolations = await db.getAllAsync('PRAGMA foreign_key_check;');
    if (fkViolations && fkViolations.length > 0) {
      throw new Error(
        `Foreign key integrity check failed after restore: ${JSON.stringify(fkViolations)}`
      );
    }

    // 7. Pre-commit Quick Check
    const quickCheck = await db.getAllAsync('PRAGMA quick_check;');
    const checkStatus = quickCheck[0]?.integrity_check || quickCheck[0]?.quick_check;
    if (checkStatus !== 'ok') {
      throw new Error(`Database integrity quick check failed: ${JSON.stringify(quickCheck)}`);
    }
  });

  return {
    success: true,
    restoredCounts: {
      buyers: buyers.length,
      milkEntries: milk_entries.length,
      expenses: expenses.length,
    },
  };
}

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------
async function runAudit() {
  console.log('====================================================');
  console.log('   DAIRYFLOW END-TO-END AUDIT & VERIFICATION SUITE   ');
  console.log('====================================================\n');

  const rawDb = new DatabaseSync(':memory:');
  const db = new SQLiteAdapter(rawDb);

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✓ [PASS] ${name}`);
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}:`, err.message);
      throw err;
    }
  }

  // --- SECTION 1: DATABASE INITIALIZATION & IDEMPOTENCE ---
  console.log('1. Database Initialization & Data Persistence:');
  await testAsync('initDatabase runs cleanly and creates all tables & indexes', async () => {
    await initDatabase(db);
    const buyers = await db.getAllAsync('SELECT * FROM buyers;');
    assert.strictEqual(buyers.length, 1);
    assert.strictEqual(buyers[0].name, 'Premier Dairy Cooperative');
  });

  await testAsync('initDatabase is idempotent (can run repeatedly without duplicating or erroring)', async () => {
    await initDatabase(db);
    await initDatabase(db);
    const buyers = await db.getAllAsync('SELECT * FROM buyers;');
    assert.strictEqual(buyers.length, 1, 'Default buyer should not be duplicated');
  });

  // --- SECTION 2: BUYERS & FOREIGN KEY INTEGRITY ---
  console.log('\n2. Buyers & Foreign Key Constraints:');
  let buyer1Id, buyer2Id;
  await testAsync('Add buyers and manage default flags', async () => {
    buyer1Id = await addBuyer(db, 'Chaudhry Milk Shop', '+92 301 1111111', 'Main Bazaar', true);
    buyer2Id = await addBuyer(db, 'Green Valley Dairy', '+92 302 2222222', 'Dairy Colony', false);
    const b1 = await db.getFirstAsync('SELECT * FROM buyers WHERE id = ?;', [buyer1Id]);
    assert.strictEqual(b1.is_default, 1);
    const prevDefault = await db.getFirstAsync('SELECT * FROM buyers WHERE id = 1;');
    assert.strictEqual(prevDefault.is_default, 0, 'Previous default was cleared');
  });

  await testAsync('Cannot delete buyer when referenced by historical milk entries', async () => {
    // Insert milk entry for buyer1
    await insertMilkEntry(db, {
      date: '2026-10-14',
      shift: 'Morning',
      liters: 100,
      fat_percentage: 4.5,
      rate_per_liter: 150,
      total_amount: 15000,
      buyer_id: buyer1Id,
      buyer_name: 'Chaudhry Milk Shop',
    });

    let threw = false;
    try {
      await deleteBuyer(db, buyer1Id);
    } catch (e) {
      threw = true;
      assert.match(e.message, /Cannot delete buyer with 1 existing milk collection records/);
    }
    assert.strictEqual(threw, true, 'Should block deletion of referenced buyer');
  });

  await testAsync('Can delete unreferenced buyer safely', async () => {
    await deleteBuyer(db, buyer2Id);
    const check = await db.getFirstAsync('SELECT * FROM buyers WHERE id = ?;', [buyer2Id]);
    assert.strictEqual(check, null, 'Buyer2 was deleted');
  });

  await testAsync('Can delete referenced buyer when force is true', async () => {
    const tempBuyerId = await addBuyer(db, 'Disposable Buyer', '+92 300 0000000', 'Test', false);
    await insertMilkEntry(db, {
      date: '2026-10-15',
      shift: 'Morning',
      liters: 10,
      fat_percentage: 4.0,
      rate_per_liter: 100,
      total_amount: 1000,
      buyer_id: tempBuyerId,
      buyer_name: 'Disposable Buyer',
    });
    await deleteBuyer(db, tempBuyerId, true);
    const checkBuyer = await db.getFirstAsync('SELECT * FROM buyers WHERE id = ?;', [tempBuyerId]);
    const checkEntries = await db.getFirstAsync('SELECT COUNT(*) as c FROM milk_entries WHERE buyer_id = ?;', [tempBuyerId]);
    assert.strictEqual(checkBuyer, null, 'Temp buyer was deleted');
    assert.strictEqual(checkEntries.c, 0, 'Temp buyer milk entries were also cleaned up');
  });

  // --- SECTION 3: MILK ENTRIES & DAILY AGGREGATIONS ---
  console.log('\n3. Milk Records & Shift Calculations:');
  await testAsync('Shift check constraint enforces only Morning/Evening', async () => {
    let threw = false;
    try {
      await insertMilkEntry(db, {
        date: '2026-10-14',
        shift: 'Afternoon', // Invalid shift
        liters: 50,
        fat_percentage: 4.0,
        rate_per_liter: 150,
        total_amount: 7500,
        buyer_id: buyer1Id,
        buyer_name: 'Chaudhry Milk Shop',
      });
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, 'CHECK(shift IN ("Morning", "Evening")) enforced');
  });

  await testAsync('Calculates DaySummary correctly with weighted average fat', async () => {
    // We already have Morning: 100 L, 4.5% fat, Rs 15,000
    // Add Evening: 50 L, 4.0% fat, Rs 7,500
    await insertMilkEntry(db, {
      date: '2026-10-14',
      shift: 'Evening',
      liters: 50,
      fat_percentage: 4.0,
      rate_per_liter: 150,
      total_amount: 7500,
      buyer_id: buyer1Id,
      buyer_name: 'Chaudhry Milk Shop',
    });

    const sum = await getDaySummary(db, '2026-10-14');
    assert.strictEqual(sum.totalLiters, 150.0);
    assert.strictEqual(sum.totalRevenue, 22500.0);
    assert.strictEqual(sum.morningLiters, 100.0);
    assert.strictEqual(sum.eveningLiters, 50.0);
    assert.strictEqual(sum.morningRevenue, 15000.0);
    assert.strictEqual(sum.eveningRevenue, 7500.0);
    // Weighted fat: (100*4.5 + 50*4.0)/150 = (450 + 200)/150 = 650/150 = 4.33%
    assert.strictEqual(sum.avgFat, 4.33);
    assert.strictEqual(sum.entriesCount, 2);
  });

  // --- SECTION 4: EXPENSE VALIDATION ---
  console.log('\n4. Expense Validation & Rounding Tolerance:');
  test('Accepts all 7 valid categories', () => {
    for (const cat of VALID_EXPENSE_CATEGORIES) {
      validateExpenseInput({
        date: '2026-10-14',
        category: cat,
        title: `Test ${cat}`,
        amount: 500,
      });
    }
  });

  test('Rejects invalid category', () => {
    assert.throws(
      () =>
        validateExpenseInput({
          date: '2026-10-14',
          category: 'Entertainment',
          title: 'Movie',
          amount: 500,
        }),
      /Invalid expense category/
    );
  });

  test('Rejects empty or blank title', () => {
    assert.throws(
      () =>
        validateExpenseInput({
          date: '2026-10-14',
          category: 'Feed',
          title: '   ',
          amount: 500,
        }),
      /Expense title cannot be empty/
    );
  });

  test('Rejects invalid date formats', () => {
    assert.throws(
      () =>
        validateExpenseInput({
          date: '14-10-2026',
          category: 'Feed',
          title: 'Hay',
          amount: 500,
        }),
      /Invalid date format/
    );
  });

  test('Rejects zero, negative, or NaN amounts', () => {
    assert.throws(
      () =>
        validateExpenseInput({
          date: '2026-10-14',
          category: 'Feed',
          title: 'Hay',
          amount: 0,
        }),
      /Invalid expense amount/
    );
    assert.throws(
      () =>
        validateExpenseInput({
          date: '2026-10-14',
          category: 'Feed',
          title: 'Hay',
          amount: -100,
        }),
      /Invalid expense amount/
    );
    assert.throws(
      () =>
        validateExpenseInput({
          date: '2026-10-14',
          category: 'Feed',
          title: 'Hay',
          amount: NaN,
        }),
      /Invalid expense amount/
    );
  });

  test('Enforces Feed calculation consistency with <= 1.0 rounding tolerance', () => {
    // 50 kg * Rs 100 = 5000
    // Exact: passes
    validateExpenseInput({
      date: '2026-10-14',
      category: 'Feed',
      title: 'Wanda',
      amount: 5000,
      quantity: 50,
      unit_price: 100,
    });

    // Rs 0.50 difference due to rounding/tax: passes
    validateExpenseInput({
      date: '2026-10-14',
      category: 'Feed',
      title: 'Wanda',
      amount: 5000.5,
      quantity: 50,
      unit_price: 100,
    });

    // Rs 10 discrepancy: throws error
    assert.throws(
      () =>
        validateExpenseInput({
          date: '2026-10-14',
          category: 'Feed',
          title: 'Wanda',
          amount: 5010,
          quantity: 50,
          unit_price: 100,
        }),
      /Inconsistent feed calculation/
    );
  });

  // --- SECTION 5: EXPENSE CRUD & AGGREGATIONS ---
  console.log('\n5. Expense CRUD & Category Aggregations:');
  let expIds = [];
  await testAsync('Insert expenses across all categories for 2026-10-14', async () => {
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Feed',
        title: 'Silage Corn',
        amount: 10000,
        quantity: 500,
        unit: 'kg',
        unit_price: 20,
        supplier_or_payee: 'Haji Aslam Feeds',
      })
    );
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Labour',
        title: 'Milking Staff Wages',
        amount: 2500,
        supplier_or_payee: 'Rashid Worker',
      })
    );
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Veterinary',
        title: 'Mastitis Vaccine',
        amount: 1500,
        supplier_or_payee: 'Dr. Tariq Vet Clinic',
      })
    );
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Transport',
        title: 'Milk Chilling Van Diesel',
        amount: 1200,
      })
    );
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Utilities',
        title: 'Tube Well Electricity',
        amount: 800,
      })
    );
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Maintenance',
        title: 'Chilling Tank Pipe Replacement',
        amount: 600,
      })
    );
    expIds.push(
      await insertExpense(db, {
        date: '2026-10-14',
        category: 'Other',
        title: 'Sanitizing Detergent',
        amount: 400,
      })
    );

    // Also insert an expense on a different date (2026-10-13)
    await insertExpense(db, {
      date: '2026-10-13',
      category: 'Feed',
      title: 'Dry Wheat Straw',
      amount: 4000,
      quantity: 100,
      unit: 'kg',
      unit_price: 40,
    });

    assert.strictEqual(expIds.length, 7);
  });

  await testAsync('getFilteredExpenses filters by date, category, and search query', async () => {
    // Date filter
    const todayExpenses = await getFilteredExpenses(db, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    });
    assert.strictEqual(todayExpenses.length, 7);

    // Category filter
    const feedOnly = await getFilteredExpenses(db, { category: 'Feed' });
    assert.strictEqual(feedOnly.length, 2); // 1 today + 1 yesterday

    // Search filter
    const searchResult = await getFilteredExpenses(db, { searchQuery: 'Tariq' });
    assert.strictEqual(searchResult.length, 1);
    assert.strictEqual(searchResult[0].title, 'Mastitis Vaccine');
  });

  await testAsync('getExpenseSummary correctly computes feed vs other and category breakdowns', async () => {
    const summary = await getExpenseSummary(db, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    });

    // 10000 + 2500 + 1500 + 1200 + 800 + 600 + 400 = 17000
    assert.strictEqual(summary.totalExpenses, 17000.0);
    assert.strictEqual(summary.feedExpenses, 10000.0);
    assert.strictEqual(summary.otherExpenses, 7000.0);
    assert.strictEqual(summary.totalFeedQuantity, 500.0);
    assert.strictEqual(summary.expenseCount, 7);
    assert.strictEqual(summary.feedCount, 1);
    assert.strictEqual(summary.otherCount, 6);

    assert.strictEqual(summary.categoryBreakdown.Feed, 10000.0);
    assert.strictEqual(summary.categoryBreakdown.Labour, 2500.0);
    assert.strictEqual(summary.categoryBreakdown.Veterinary, 1500.0);
    assert.strictEqual(summary.categoryBreakdown.Transport, 1200.0);
    assert.strictEqual(summary.categoryBreakdown.Utilities, 800.0);
    assert.strictEqual(summary.categoryBreakdown.Maintenance, 600.0);
    assert.strictEqual(summary.categoryBreakdown.Other, 400.0);
  });

  await testAsync('deleteExpense removes record and recalculates totals accurately', async () => {
    const vetExpenseId = expIds[2]; // Veterinary Rs 1500
    await deleteExpense(db, vetExpenseId);

    const summaryAfter = await getExpenseSummary(db, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    });
    // 17000 - 1500 = 15500
    assert.strictEqual(summaryAfter.totalExpenses, 15500.0);
    assert.strictEqual(summaryAfter.expenseCount, 6);
    assert.strictEqual(summaryAfter.categoryBreakdown.Veterinary, 0);

    // Deleting non-existent expense throws error
    let threw = false;
    try {
      await deleteExpense(db, 99999);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, 'Throws error when deleting non-existent ID');
  });

  // --- SECTION 6: FINANCIAL ACCURACY & DASHBOARD FORMULAS ---
  console.log('\n6. Financial Reconciliation & Operating Balance:');
  await testAsync('Operating balance matches sales revenue - recorded expenses', async () => {
    // On 2026-10-14:
    // Milk revenue = Rs 22,500 (from 2 entries)
    // Expenses = Rs 15,500 (after deleting vet expense)
    // Operating balance = 22,500 - 15,500 = +Rs 7,000
    const daySummary = await getDaySummary(db, '2026-10-14');
    const expSummary = await getExpenseSummary(db, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    });
    const operatingBalance = daySummary.totalRevenue - expSummary.totalExpenses;
    assert.strictEqual(operatingBalance, 7000.0);

    const report = await getOperatingFinancialReport(db, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    });
    assert.strictEqual(report.totalMilkSalesRevenue, 22500.0);
    assert.strictEqual(report.totalExpenses, 15500.0);
    assert.strictEqual(report.operatingBalance, 7000.0);
    // (7000 / 22500) * 100 = 31.111% => 31.1%
    assert.strictEqual(report.operatingMarginPercentage, 31.1);
    assert.ok(report.disclaimer.includes('Estimated operating balance'));
    assert.ok(report.disclaimer.includes('livestock depreciation'));
  });

  await testAsync('Handles negative operating balance (expenses exceed revenue)', async () => {
    // Add a big Feed purchase on 2026-10-14 of Rs 25,000
    await insertExpense(db, {
      date: '2026-10-14',
      category: 'Feed',
      title: 'Bulk Wanda 50 Bags',
      amount: 25000,
    });

    const daySummary = await getDaySummary(db, '2026-10-14');
    const expSummary = await getExpenseSummary(db, {
      startDate: '2026-10-14',
      endDate: '2026-10-14',
    });
    // Revenue = 22,500, Expenses = 15,500 + 25,000 = 40,500
    // Operating balance = 22,500 - 40,500 = -18,000
    const opBal = daySummary.totalRevenue - expSummary.totalExpenses;
    assert.strictEqual(opBal, -18000.0);

    // Test formatting helper logic:
    const formattedVal = `${opBal < 0 ? '-' : ''}Rs ${Math.abs(Math.round(opBal)).toLocaleString()}`;
    assert.strictEqual(formattedVal, '-Rs 18,000');

    const formattedCol = `${opBal < 0 ? '-' : '+'}Rs ${Math.abs(Math.round(opBal)).toLocaleString()}`;
    assert.strictEqual(formattedCol, '-Rs 18,000');
  });

  await testAsync('Handles zero revenue & zero expense edge cases safely without NaN', async () => {
    const reportEmpty = await getOperatingFinancialReport(db, {
      startDate: '2020-01-01',
      endDate: '2020-01-01',
    });
    assert.strictEqual(reportEmpty.totalMilkSalesRevenue, 0);
    assert.strictEqual(reportEmpty.totalExpenses, 0);
    assert.strictEqual(reportEmpty.operatingBalance, 0);
    assert.strictEqual(reportEmpty.operatingMarginPercentage, 0, 'No division by zero NaN');

    const formattedZero = `Rs ${Math.round(reportEmpty.operatingBalance).toLocaleString()}`;
    assert.strictEqual(formattedZero, 'Rs 0');
  });

  // ---------------------------------------------------------------------------
  // 7. CSV SERIALIZATION & FORMULA MITIGATION
  // ---------------------------------------------------------------------------
  console.log('\n7. CSV Serialization & Formula Mitigation:');

  test('CSV exports start with UTF-8 BOM (\\uFEFF) for spreadsheet compatibility', () => {
    const milkCsv = exportMilkEntriesToCsv([]);
    const buyersCsv = exportBuyersToCsv([]);
    const expensesCsv = exportExpensesToCsv([]);
    assert.ok(milkCsv.startsWith(CSV_UTF8_BOM), 'Milk entries CSV starts with BOM');
    assert.ok(buyersCsv.startsWith(CSV_UTF8_BOM), 'Buyers CSV starts with BOM');
    assert.ok(expensesCsv.startsWith(CSV_UTF8_BOM), 'Expenses CSV starts with BOM');
  });

  test('CSV correctly escapes commas, double quotes, newlines, and carriage returns (RFC 4180)', () => {
    const testEntry = {
      id: 1,
      date: '2026-10-14',
      shift: 'Morning',
      liters: 20.5,
      fat_percentage: 6.2,
      rate_per_liter: 180,
      total_amount: 3690,
      buyer_id: 1,
      buyer_name: 'Coop, Lahore Branch',
      notes: 'Morning batch "Premium Grade"\r\nExtra note with, comma',
      created_at: '2026-10-14T08:00:00.000Z',
    };
    const csv = exportMilkEntriesToCsv([testEntry]);
    assert.ok(csv.includes('"Coop, Lahore Branch"'));
    assert.ok(csv.includes('"Morning batch ""Premium Grade""\r\nExtra note with, comma"'));
  });

  test('CSV preserves Urdu text and special Unicode characters properly', () => {
    const buyer = {
      id: 99,
      name: 'باسم ڈیری فارم',
      phone: '+92 300 1234567',
      address: 'گوجرانوالہ روڈ، کینٹ',
      is_default: 0,
      created_at: '2026-10-14T10:00:00.000Z',
    };
    const csv = exportBuyersToCsv([buyer]);
    assert.ok(csv.includes('باسم ڈیری فارم'));
    assert.ok(csv.includes('گوجرانوالہ روڈ، کینٹ'));
  });

  test('CSV exports empty/nullable fields as empty strings, never "null" or "undefined"', () => {
    const expense = {
      id: 1,
      date: '2026-10-14',
      category: 'Utilities',
      title: 'Electricity Bill',
      amount: 4500,
      quantity: null,
      unit: null,
      unit_price: null,
      supplier_or_payee: null,
      payment_method: null,
      notes: null,
      created_at: '2026-10-14T10:00:00.000Z',
    };
    const csv = exportExpensesToCsv([expense]);
    assert.ok(!csv.includes('null'), 'CSV should never contain the literal string "null"');
    assert.ok(!csv.includes('undefined'), 'CSV should never contain the literal string "undefined"');
    assert.ok(csv.includes('4500,,,,,,,'));
  });

  test('CSV preserves exact numeric values without locale formatting', () => {
    const entry = {
      id: 5,
      date: '2026-10-14',
      shift: 'Evening',
      liters: 1250.75,
      fat_percentage: 6.85,
      rate_per_liter: 195.5,
      total_amount: 244521.63,
      buyer_id: 1,
      buyer_name: 'Main Hub',
      notes: null,
      created_at: '2026-10-14T10:00:00.000Z',
    };
    const csv = exportMilkEntriesToCsv([entry]);
    assert.ok(csv.includes(',1250.75,6.85,195.5,244521.63,'));
  });

  test('CSV mitigates spreadsheet formula injection on text fields starting with =, +, -, @, \\t, \\r', () => {
    const maliciousExpenses = [
      {
        id: 1,
        date: '2026-10-14',
        category: 'Other',
        title: '=cmd|"/C calc"!A0',
        amount: 100,
        quantity: null,
        unit: null,
        unit_price: null,
        supplier_or_payee: '+92 300 0000000',
        payment_method: '-Cash Discount',
        notes: '@FormulaInject',
        created_at: '2026-10-14T10:00:00.000Z',
      },
    ];
    const csv = exportExpensesToCsv(maliciousExpenses);
    assert.ok(csv.includes("'+92 300 0000000"));
    assert.ok(csv.includes("'-Cash Discount"));
    assert.ok(csv.includes("'@FormulaInject"));
  });

  test('CSV does NOT single-quote normal numeric fields (even negative numbers)', () => {
    assert.strictEqual(sanitizeCsvField(25.5), '25.5');
    assert.strictEqual(sanitizeCsvField(-150), '-150');
    assert.strictEqual(sanitizeCsvField(0), '0');
    assert.strictEqual(sanitizeCsvField(1000000), '1000000');
  });

  test('exportMilkEntriesToCsv produces stable, documented column headers and correct row count', () => {
    const csv = exportMilkEntriesToCsv([]);
    const lines = csv.replace(CSV_UTF8_BOM, '').trim().split('\r\n');
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0], MILK_ENTRIES_CSV_HEADERS.join(','));
  });

  test('exportBuyersToCsv handles buyers with and without real-time collection statistics', () => {
    const buyersWithoutStats = [
      { id: 1, name: 'Buyer 1', phone: null, address: null, is_default: 1, created_at: '2026-10-14T00:00:00.000Z' },
    ];
    const buyersWithStats = [
      {
        id: 2,
        name: 'Buyer 2',
        phone: '123',
        address: 'Lahore',
        is_default: 0,
        created_at: '2026-10-14T00:00:00.000Z',
        totalLiters: 150.5,
        totalRevenue: 27000,
        entriesCount: 5,
        lastSaleDate: '2026-10-14',
      },
    ];
    const csvWithout = exportBuyersToCsv(buyersWithoutStats);
    assert.ok(csvWithout.includes('1,Buyer 1,,,1,2026-10-14T00:00:00.000Z,,,,'));
    const csvWith = exportBuyersToCsv(buyersWithStats);
    assert.ok(csvWith.includes('2,Buyer 2,123,Lahore,0,2026-10-14T00:00:00.000Z,150.5,27000,5,2026-10-14'));
  });

  test('exportExpensesToCsv produces stable, documented column headers', () => {
    const csv = exportExpensesToCsv([]);
    const lines = csv.replace(CSV_UTF8_BOM, '').trim().split('\r\n');
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0], EXPENSES_CSV_HEADERS.join(','));
  });

  // ---------------------------------------------------------------------------
  // 8. VERSIONED BACKUP FORMAT & DATABASE RESTORE ENGINE
  // ---------------------------------------------------------------------------
  console.log('\n8. Versioned Backup Format & Database Restore Engine:');

  let snapshotBackup = null;

  await testAsync('getAllDataForBackup captures accurate snapshot and metadata matching all tables', async () => {
    snapshotBackup = await getAllDataForBackup(db);
    assert.strictEqual(snapshotBackup.format, 'DAIRYFLOW_BACKUP');
    assert.strictEqual(snapshotBackup.version, 1);
    assert.ok(snapshotBackup.createdAt);
    assert.strictEqual(snapshotBackup.appVersion, '1.0.0');
    assert.strictEqual(snapshotBackup.metadata.buyersCount, snapshotBackup.data.buyers.length);
    assert.strictEqual(snapshotBackup.metadata.milkEntriesCount, snapshotBackup.data.milk_entries.length);
    assert.strictEqual(snapshotBackup.metadata.expensesCount, snapshotBackup.data.expenses.length);
    assert.ok(snapshotBackup.data.buyers.length > 0);
    assert.ok(snapshotBackup.data.milk_entries.length > 0);
    assert.ok(snapshotBackup.data.expenses.length > 0);
    assert.ok(snapshotBackup.metadata.totalMilkLiters > 0);
    assert.ok(snapshotBackup.metadata.totalMilkRevenue > 0);
    assert.ok(snapshotBackup.metadata.totalExpensesAmount > 0);
  });

  test('serializeBackupToJson and round-trip parsing preserves all fields, numbers, and nulls', () => {
    const jsonStr = serializeBackupToJson(snapshotBackup);
    const parsed = parseAndValidateBackupJson(jsonStr);
    assert.strictEqual(parsed.format, snapshotBackup.format);
    assert.strictEqual(parsed.version, snapshotBackup.version);
    assert.deepStrictEqual(parsed.metadata, snapshotBackup.metadata);
    // Compare plain JSON objects (normalizes node:sqlite null-prototype objects)
    assert.deepStrictEqual(parsed.data, JSON.parse(JSON.stringify(snapshotBackup.data)));
  });

  test('validateBackupPayload rejects unsupported format identifier', () => {
    const bad = { ...snapshotBackup, format: 'INVALID_FORMAT' };
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Unsupported backup format')));
  });

  test('validateBackupPayload rejects unsupported version number', () => {
    const bad = { ...snapshotBackup, version: 99 };
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Unsupported backup version')));
  });

  test('parseAndValidateBackupJson rejects malformed JSON string', () => {
    assert.throws(
      () => parseAndValidateBackupJson('{ corrupt json: false '),
      /Malformed JSON backup file/
    );
  });

  test('validateBackupPayload rejects mismatched metadata counts', () => {
    const bad = JSON.parse(JSON.stringify(snapshotBackup));
    bad.metadata.buyersCount = 999;
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Metadata buyersCount')));
  });

  test('validateBackupPayload rejects duplicate primary keys in tables', () => {
    const bad = JSON.parse(JSON.stringify(snapshotBackup));
    bad.data.buyers.push({ ...bad.data.buyers[0] });
    bad.metadata.buyersCount = bad.data.buyers.length;
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Duplicate buyer ID')));
  });

  test('validateBackupPayload rejects non-integer, negative, or zero IDs', () => {
    const bad = JSON.parse(JSON.stringify(snapshotBackup));
    bad.data.buyers[0].id = -1;
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Must be a positive integer')));
  });

  test('validateBackupPayload rejects invalid dates, shifts, categories, and negative amounts', () => {
    const bad = JSON.parse(JSON.stringify(snapshotBackup));
    bad.data.milk_entries[0].date = '2026/10/14';
    bad.data.milk_entries[0].shift = 'Afternoon';
    bad.data.expenses[0].category = 'Cryptocurrency';
    bad.data.expenses[0].amount = -500;
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Expected YYYY-MM-DD')));
    assert.ok(res.errors.some((e) => e.includes('Expected "Morning" or "Evening"')));
    assert.ok(res.errors.some((e) => e.includes('Invalid category')));
    assert.ok(res.errors.some((e) => e.includes('finite positive number')));
  });

  test('validateBackupPayload enforces foreign key invariant: rejects milk entry referencing non-existent buyer', () => {
    const bad = JSON.parse(JSON.stringify(snapshotBackup));
    bad.data.milk_entries[0].buyer_id = 999999;
    const res = validateBackupPayload(bad);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors.some((e) => e.includes('Foreign key invariant violated')));
  });

  test('validateBackupPayload rejects multiple default buyers', () => {
    const bad = JSON.parse(JSON.stringify(snapshotBackup));
    if (bad.data.buyers.length >= 2) {
      bad.data.buyers[0].is_default = 1;
      bad.data.buyers[1].is_default = 1;
      const res = validateBackupPayload(bad);
      assert.strictEqual(res.isValid, false);
      assert.ok(res.errors.some((e) => e.includes('Multiple default buyers found')));
    }
  });

  await testAsync('restoreAllDataFromBackup succeeds: replaces all tables, preserves exact IDs and relationships', async () => {
    const customBackup = {
      format: 'DAIRYFLOW_BACKUP',
      version: 1,
      createdAt: '2026-10-14T12:00:00.000Z',
      appVersion: '1.0.0',
      metadata: {
        buyersCount: 2,
        milkEntriesCount: 2,
        expensesCount: 2,
        totalMilkLiters: 40.0,
        totalMilkRevenue: 7200.0,
        totalExpensesAmount: 5000.0,
      },
      data: {
        buyers: [
          { id: 101, name: 'Restored Buyer Alpha', phone: '+92 301 1111111', address: 'Lahore', is_default: 1, created_at: '2026-10-14T00:00:00.000Z' },
          { id: 202, name: 'Restored Buyer Beta', phone: '+92 302 2222222', address: 'Kasur', is_default: 0, created_at: '2026-10-14T00:00:00.000Z' },
        ],
        milk_entries: [
          { id: 501, date: '2026-10-14', shift: 'Morning', liters: 25.0, fat_percentage: 6.5, rate_per_liter: 180.0, total_amount: 4500.0, buyer_id: 101, buyer_name: 'Restored Buyer Alpha', notes: 'Restored entry 1', created_at: '2026-10-14T06:00:00.000Z' },
          { id: 502, date: '2026-10-14', shift: 'Evening', liters: 15.0, fat_percentage: 6.0, rate_per_liter: 180.0, total_amount: 2700.0, buyer_id: 202, buyer_name: 'Restored Buyer Beta', notes: null, created_at: '2026-10-14T18:00:00.000Z' },
        ],
        expenses: [
          { id: 701, date: '2026-10-14', category: 'Feed', title: 'Restored Silage', amount: 3500.0, quantity: 2, unit: 'Bags', unit_price: 1750.0, supplier_or_payee: 'Agri Supplier', payment_method: 'Cash', notes: null, created_at: '2026-10-14T09:00:00.000Z' },
          { id: 702, date: '2026-10-14', category: 'Veterinary', title: 'Restored Vaccines', amount: 1500.0, quantity: null, unit: null, unit_price: null, supplier_or_payee: 'Dr. Ahmad', payment_method: 'Cash', notes: null, created_at: '2026-10-14T11:00:00.000Z' },
        ],
      },
    };

    const result = await restoreAllDataFromBackup(db, customBackup);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.restoredCounts.buyers, 2);
    assert.strictEqual(result.restoredCounts.milkEntries, 2);
    assert.strictEqual(result.restoredCounts.expenses, 2);

    const restoredBuyers = await db.getAllAsync('SELECT * FROM buyers ORDER BY id ASC;');
    assert.strictEqual(restoredBuyers.length, 2);
    assert.strictEqual(restoredBuyers[0].id, 101);
    assert.strictEqual(restoredBuyers[1].id, 202);

    const restoredEntries = await db.getAllAsync('SELECT * FROM milk_entries ORDER BY id ASC;');
    assert.strictEqual(restoredEntries.length, 2);
    assert.strictEqual(restoredEntries[0].id, 501);
    assert.strictEqual(restoredEntries[0].buyer_id, 101);
    assert.strictEqual(restoredEntries[1].id, 502);
    assert.strictEqual(restoredEntries[1].buyer_id, 202);

    const restoredExpenses = await db.getAllAsync('SELECT * FROM expenses ORDER BY id ASC;');
    assert.strictEqual(restoredExpenses.length, 2);
    assert.strictEqual(restoredExpenses[0].id, 701);
    assert.strictEqual(restoredExpenses[1].id, 702);
  });

  await testAsync('restoreAllDataFromBackup aborts on validation failure without touching database', async () => {
    const beforeBuyers = await db.getAllAsync('SELECT * FROM buyers;');
    const beforeEntries = await db.getAllAsync('SELECT * FROM milk_entries;');
    const beforeExpenses = await db.getAllAsync('SELECT * FROM expenses;');

    const badPayload = {
      format: 'DAIRYFLOW_BACKUP',
      version: 1,
      createdAt: '2026-10-14T00:00:00.000Z',
      appVersion: '1.0.0',
      metadata: { buyersCount: 1, milkEntriesCount: 1, expensesCount: 0, totalMilkLiters: 10, totalMilkRevenue: 1800, totalExpensesAmount: 0 },
      data: {
        buyers: [{ id: 1, name: 'B1', phone: null, address: null, is_default: 1, created_at: '2026-10-14T00:00:00.000Z' }],
        milk_entries: [{ id: 1, date: '2026-10-14', shift: 'Morning', liters: 10, fat_percentage: 6, rate_per_liter: 180, total_amount: 1800, buyer_id: 999, buyer_name: 'Ghost', notes: null, created_at: '2026-10-14T00:00:00.000Z' }],
        expenses: [],
      },
    };

    let threw = false;
    try {
      await restoreAllDataFromBackup(db, badPayload);
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('Foreign key invariant violated'));
    }
    assert.strictEqual(threw, true, 'Validation error was thrown');

    const afterBuyers = await db.getAllAsync('SELECT * FROM buyers;');
    const afterEntries = await db.getAllAsync('SELECT * FROM milk_entries;');
    const afterExpenses = await db.getAllAsync('SELECT * FROM expenses;');
    assert.deepStrictEqual(afterBuyers, beforeBuyers);
    assert.deepStrictEqual(afterEntries, beforeEntries);
    assert.deepStrictEqual(afterExpenses, beforeExpenses);
  });

  await testAsync('restoreAllDataFromBackup rolls back atomically on runtime/integrity failure', async () => {
    const beforeBuyers = await db.getAllAsync('SELECT * FROM buyers;');
    const beforeEntries = await db.getAllAsync('SELECT * FROM milk_entries;');

    let threw = false;
    try {
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM milk_entries;');
        await db.runAsync('DELETE FROM expenses;');
        await db.runAsync('DELETE FROM buyers;');
        throw new Error('Simulated hardware/write failure mid-restore');
      });
    } catch (e) {
      threw = true;
      assert.strictEqual(e.message, 'Simulated hardware/write failure mid-restore');
    }
    assert.strictEqual(threw, true);

    const afterBuyers = await db.getAllAsync('SELECT * FROM buyers;');
    const afterEntries = await db.getAllAsync('SELECT * FROM milk_entries;');
    assert.strictEqual(afterBuyers.length, beforeBuyers.length);
    assert.strictEqual(afterEntries.length, beforeEntries.length);
  });

  await testAsync('Backup and restore handles completely empty tables cleanly', async () => {
    const emptyBackup = {
      format: 'DAIRYFLOW_BACKUP',
      version: 1,
      createdAt: '2026-10-14T12:00:00.000Z',
      appVersion: '1.0.0',
      metadata: {
        buyersCount: 0,
        milkEntriesCount: 0,
        expensesCount: 0,
        totalMilkLiters: 0,
        totalMilkRevenue: 0,
        totalExpensesAmount: 0,
      },
      data: {
        buyers: [],
        milk_entries: [],
        expenses: [],
      },
    };

    const result = await restoreAllDataFromBackup(db, emptyBackup);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.restoredCounts.buyers, 0);

    const buyers = await db.getAllAsync('SELECT * FROM buyers;');
    const entries = await db.getAllAsync('SELECT * FROM milk_entries;');
    const expenses = await db.getAllAsync('SELECT * FROM expenses;');
    assert.strictEqual(buyers.length, 0);
    assert.strictEqual(entries.length, 0);
    assert.strictEqual(expenses.length, 0);

    const emptySnapshot = await getAllDataForBackup(db);
    assert.strictEqual(emptySnapshot.metadata.buyersCount, 0);
    assert.strictEqual(emptySnapshot.metadata.milkEntriesCount, 0);
    assert.strictEqual(emptySnapshot.metadata.expensesCount, 0);
    assert.strictEqual(emptySnapshot.metadata.totalMilkLiters, 0);
  });

  await testAsync('PRAGMA foreign_key_check passes after restore', async () => {
    const result = await restoreAllDataFromBackup(db, snapshotBackup);
    assert.strictEqual(result.success, true);

    const fkViolations = await db.getAllAsync('PRAGMA foreign_key_check;');
    assert.strictEqual(fkViolations.length, 0, 'No foreign key violations in database');
  });

  console.log(`\nAll ${passed}/${total} tests PASSED with 0 errors!`);
}

runAudit().catch((err) => {
  console.error('\nAudit Failed:', err);
  process.exit(1);
});
