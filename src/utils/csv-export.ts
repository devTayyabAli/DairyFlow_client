/**
 * DairyFlow CSV Export Engine
 * 
 * Reusable, typed CSV serialization for:
 * - Milk collection records
 * - Buyers directory (with real-time aggregated metrics)
 * - Farm operating expenses
 * 
 * Complies with RFC 4180:
 * - Prepends UTF-8 BOM (\uFEFF) for Microsoft Excel compatibility
 * - Escapes commas, quotes, newlines, and carriage returns
 * - Mitigates CSV Formula Injection (DDE) by single-quoting leading formula characters (=, +, -, @, \t, \r)
 *   without corrupting pure numeric values
 * - Exports nullable/empty fields as empty strings, never "null" or "undefined"
 * - Preserves exact numeric values without locale-dependent comma grouping
 * 
 * NOTE: CSV export is intended for external analysis, reporting, and spreadsheet applications.
 * It does NOT represent a complete, transactional, relational database backup and cannot be restored
 * directly into SQLite. For full backup and restoration with foreign-key guarantees, use the JSON Backup Engine.
 */

import type { Buyer, BuyerWithStats, MilkEntry, Expense } from '../db/database';

/**
 * UTF-8 Byte Order Mark (BOM)
 * Ensures Excel on Windows and macOS correctly identifies the file as UTF-8,
 * preventing corrupted rendering of special characters, currency symbols, and Urdu text.
 */
export const CSV_UTF8_BOM = '\uFEFF';

/**
 * Standard RFC 4180 line ending
 */
export const CSV_LINE_ENDING = '\r\n';

/**
 * Mitigates spreadsheet formula injection (CSV/DDE injection) for text fields,
 * while preserving RFC 4180 formatting and pure numeric columns.
 */
export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  // Pure numbers are preserved as standard numeric strings so spreadsheets can calculate with them
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  let str = String(value);

  // If a text string begins with an active spreadsheet formula trigger,
  // prefix with a single quote (') to force spreadsheets to treat it as plain text.
  // Formula trigger characters: =, +, -, @, Tab (\t), Carriage Return (\r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 Escaping:
  // If the cell contains quotes, commas, newlines, or carriage returns, wrap in double quotes
  // and double any internal double-quote characters.
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of fields into a single RFC 4180 CSV line.
 */
export function formatCsvRow(fields: unknown[]): string {
  return fields.map(sanitizeCsvField).join(',');
}

/**
 * Stable, documented column headers for Milk Records CSV export.
 */
export const MILK_ENTRIES_CSV_HEADERS = [
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

/**
 * Exports milk collection entries to RFC 4180 CSV format with UTF-8 BOM.
 */
export function exportMilkEntriesToCsv(entries: MilkEntry[]): string {
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

/**
 * Stable, documented column headers for Buyers CSV export.
 */
export const BUYERS_CSV_HEADERS = [
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

/**
 * Exports buyers (and their calculated collection stats if available) to RFC 4180 CSV format with UTF-8 BOM.
 */
export function exportBuyersToCsv(buyers: (Buyer | BuyerWithStats)[]): string {
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
      isStats ? (b as BuyerWithStats).totalLiters : '',
      isStats ? (b as BuyerWithStats).totalRevenue : '',
      isStats ? (b as BuyerWithStats).entriesCount : '',
      isStats ? ((b as BuyerWithStats).lastSaleDate ?? '') : '',
    ]);
  });

  return `${CSV_UTF8_BOM}${headerRow}${CSV_LINE_ENDING}${dataRows.join(CSV_LINE_ENDING)}${dataRows.length > 0 ? CSV_LINE_ENDING : ''}`;
}

/**
 * Stable, documented column headers for Farm Expenses CSV export.
 */
export const EXPENSES_CSV_HEADERS = [
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

/**
 * Exports farm operating expenses to RFC 4180 CSV format with UTF-8 BOM.
 */
export function exportExpensesToCsv(expenses: Expense[]): string {
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
