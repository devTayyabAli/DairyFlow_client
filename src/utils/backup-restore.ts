/**
 * DairyFlow Versioned Backup & Restore Engine
 * 
 * Provides:
 * - Strongly-typed, versioned JSON backup format with format identifier and metadata
 * - Pre-mutation validation verifying data structures, constraints, and foreign-key invariants
 * - Serialization and parsing helpers
 * - Zero silent coercion: strict structural and semantic integrity checking
 */

import type {
  Buyer,
  MilkEntry,
  Expense,
  ExpenseCategory,
  BuyerPayment,
  LivestockAnimal,
  LivestockActivity,
} from '../db/database';

export const BACKUP_FORMAT_IDENTIFIER = 'DAIRYFLOW_BACKUP' as const;
export const CURRENT_BACKUP_VERSION = 1;
export const SUPPORTED_BACKUP_VERSIONS = [1] as const;

export const VALID_EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  'Feed',
  'Labour',
  'Veterinary',
  'Transport',
  'Utilities',
  'Maintenance',
  'Other',
];

export interface BackupMetadata {
  buyersCount: number;
  milkEntriesCount: number;
  expensesCount: number;
  buyerPaymentsCount?: number;
  livestockCount?: number;
  activitiesCount?: number;
  totalMilkLiters: number;
  totalMilkRevenue: number;
  totalExpensesAmount: number;
}

export interface BackupDataPayload {
  buyers: Buyer[];
  milk_entries: MilkEntry[];
  expenses: Expense[];
  buyer_payments?: BuyerPayment[];
  livestock?: LivestockAnimal[];
  livestock_activities?: LivestockActivity[];
}

export interface DairyFlowBackupEnvelope {
  format: typeof BACKUP_FORMAT_IDENTIFIER;
  version: number;
  createdAt: string;
  appVersion: string;
  metadata: BackupMetadata;
  data: BackupDataPayload;
}

export interface BackupValidationError {
  field?: string;
  message: string;
}

export interface BackupValidationResult {
  isValid: boolean;
  errors: string[];
  envelope?: DairyFlowBackupEnvelope;
}

/**
 * Calculates metadata summary counts and totals from exact snapshot data.
 */
export function calculateBackupMetadata(data: BackupDataPayload): BackupMetadata {
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
    buyerPaymentsCount: data.buyer_payments?.length ?? 0,
    livestockCount: data.livestock?.length ?? 0,
    activitiesCount: data.livestock_activities?.length ?? 0,
    totalMilkLiters: Number(totalMilkLiters.toFixed(2)),
    totalMilkRevenue: Number(totalMilkRevenue.toFixed(2)),
    totalExpensesAmount: Number(totalExpensesAmount.toFixed(2)),
  };
}

/**
 * Creates a versioned DairyFlow backup envelope from given table data.
 */
export function createBackupEnvelope(
  data: BackupDataPayload,
  appVersion: string = '1.0.0'
): DairyFlowBackupEnvelope {
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
      buyer_payments: data.buyer_payments ?? [],
      livestock: data.livestock ?? [],
      livestock_activities: data.livestock_activities ?? [],
    },
  };
}

/**
 * Serializes a backup envelope to formatted JSON preserving numeric and nullable fields.
 */
export function serializeBackupToJson(envelope: DairyFlowBackupEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

/**
 * Validates a date string in YYYY-MM-DD format.
 */
function isValidDateString(dateStr: unknown): boolean {
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

/**
 * Validates an ISO timestamp or date string.
 */
function isValidTimestamp(val: unknown): boolean {
  if (typeof val !== 'string' || !val.trim()) return false;
  return !isNaN(Date.parse(val));
}

/**
 * Validates positive integer primary keys.
 */
function isPositiveInteger(val: unknown): boolean {
  return typeof val === 'number' && Number.isInteger(val) && val > 0;
}

/**
 * Comprehensive pre-mutation validator for DairyFlow backup payloads.
 * Checks format, version, metadata consistency, table schemas,
 * primary key uniqueness, data types, and foreign key references.
 */
export function validateBackupPayload(payload: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      isValid: false,
      errors: ['Invalid backup payload: Expected a JSON object.'],
    };
  }

  const envelope = payload as Partial<DairyFlowBackupEnvelope>;

  // 1. Format Identifier Check
  if (envelope.format !== BACKUP_FORMAT_IDENTIFIER) {
    errors.push(
      `Unsupported backup format: Expected "${BACKUP_FORMAT_IDENTIFIER}", got "${String(
        envelope.format
      )}".`
    );
  }

  // 2. Version Check
  if (
    typeof envelope.version !== 'number' ||
    !SUPPORTED_BACKUP_VERSIONS.includes(envelope.version as 1)
  ) {
    errors.push(
      `Unsupported backup version: "${String(
        envelope.version
      )}". Supported versions are: ${SUPPORTED_BACKUP_VERSIONS.join(', ')}.`
    );
  }

  // 3. CreatedAt Check
  if (!isValidTimestamp(envelope.createdAt)) {
    errors.push('Backup envelope is missing a valid "createdAt" timestamp.');
  }

  // 4. Data Object Check
  if (!envelope.data || typeof envelope.data !== 'object' || Array.isArray(envelope.data)) {
    errors.push('Backup envelope is missing the required "data" container object.');
    return { isValid: false, errors };
  }

  const { buyers, milk_entries, expenses } = envelope.data as Partial<BackupDataPayload>;

  if (!Array.isArray(buyers)) {
    errors.push('Backup data is missing the "buyers" array.');
  }
  if (!Array.isArray(milk_entries)) {
    errors.push('Backup data is missing the "milk_entries" array.');
  }
  if (!Array.isArray(expenses)) {
    errors.push('Backup data is missing the "expenses" array.');
  }

  // If top-level arrays are missing, abort further deep checks
  if (errors.length > 0 && (!Array.isArray(buyers) || !Array.isArray(milk_entries) || !Array.isArray(expenses))) {
    return { isValid: false, errors };
  }

  const safeBuyers = buyers as Buyer[];
  const safeMilkEntries = milk_entries as MilkEntry[];
  const safeExpenses = expenses as Expense[];

  // 5. Metadata Count Consistency
  if (!envelope.metadata || typeof envelope.metadata !== 'object') {
    errors.push('Backup envelope is missing the required "metadata" object.');
  } else {
    const meta = envelope.metadata as Partial<BackupMetadata>;
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

  // 6. Validate Buyers Table
  const buyerIdSet = new Set<number>();
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

  // 7. Validate Milk Entries Table & Foreign Key Integrity
  const milkEntryIdSet = new Set<number>();

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

    // FOREIGN KEY VALIDATION: buyer_id must exist in data.buyers
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

  // 8. Validate Expenses Table
  const expenseIdSet = new Set<number>();

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

  // 9. Validate Buyer Payments Table if present
  if (envelope.data.buyer_payments !== undefined) {
    if (!Array.isArray(envelope.data.buyer_payments)) {
      errors.push('Backup data "buyer_payments" must be an array.');
    } else {
      envelope.data.buyer_payments.forEach((payment, idx) => {
        const itemPrefix = `BuyerPayment[${idx}]`;
        if (!payment || typeof payment !== 'object') {
          errors.push(`${itemPrefix}: Record is not a valid object.`);
          return;
        }
        if (!isPositiveInteger(payment.id)) {
          errors.push(`${itemPrefix}: Invalid id "${payment.id}".`);
        }
        if (!isPositiveInteger(payment.buyer_id) || !buyerIdSet.has(payment.buyer_id)) {
          errors.push(`${itemPrefix}: Invalid or missing buyer_id "${payment.buyer_id}".`);
        }
        if (typeof payment.amount !== 'number' || !Number.isFinite(payment.amount) || payment.amount <= 0) {
          errors.push(`${itemPrefix}: "amount" must be a positive number.`);
        }
        if (!isValidDateString(payment.date)) {
          errors.push(`${itemPrefix}: Invalid date "${payment.date}". Expected YYYY-MM-DD.`);
        }
      });
    }
  }

  // 10. Validate Livestock Table if present
  const animalIdSet = new Set<number>();
  if (envelope.data.livestock !== undefined) {
    if (!Array.isArray(envelope.data.livestock)) {
      errors.push('Backup data "livestock" must be an array.');
    } else {
      envelope.data.livestock.forEach((animal, idx) => {
        const itemPrefix = `Livestock[${idx}]`;
        if (!animal || typeof animal !== 'object') {
          errors.push(`${itemPrefix}: Record is not a valid object.`);
          return;
        }
        if (!isPositiveInteger(animal.id)) {
          errors.push(`${itemPrefix}: Invalid id "${animal.id}".`);
        } else {
          animalIdSet.add(animal.id);
        }
        if (typeof animal.tag_number !== 'string' || !animal.tag_number.trim()) {
          errors.push(`${itemPrefix}: "tag_number" is required.`);
        }
        if (!['Cow', 'Buffalo', 'Calf'].includes(animal.species)) {
          errors.push(`${itemPrefix}: Invalid species "${animal.species}".`);
        }
      });
    }
  }

  // 11. Validate Livestock Activities Table if present
  if (envelope.data.livestock_activities !== undefined) {
    if (!Array.isArray(envelope.data.livestock_activities)) {
      errors.push('Backup data "livestock_activities" must be an array.');
    } else {
      envelope.data.livestock_activities.forEach((act, idx) => {
        const itemPrefix = `LivestockActivity[${idx}]`;
        if (!act || typeof act !== 'object') {
          errors.push(`${itemPrefix}: Record is not a valid object.`);
          return;
        }
        if (!isPositiveInteger(act.id)) {
          errors.push(`${itemPrefix}: Invalid id "${act.id}".`);
        }
        if (typeof act.title !== 'string' || !act.title.trim()) {
          errors.push(`${itemPrefix}: "title" is required.`);
        }
        if (!isValidDateString(act.date)) {
          errors.push(`${itemPrefix}: Invalid date "${act.date}". Expected YYYY-MM-DD.`);
        }
      });
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
    };
  }

  return {
    isValid: true,
    errors: [],
    envelope: payload as DairyFlowBackupEnvelope,
  };
}

/**
 * Parses a JSON backup string and validates the entire envelope.
 * Throws a descriptive Error if parsing or validation fails.
 */
export function parseAndValidateBackupJson(jsonString: string): DairyFlowBackupEnvelope {
  let parsed: unknown;
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
