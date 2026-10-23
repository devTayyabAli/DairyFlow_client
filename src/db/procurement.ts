/**
 * Local procurement tables: fat-rate bands, collector assignments,
 * supplier payments, and parked sync rejections.
 * Synced tables are created in initDatabase and listed in SYNCED_TABLES.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { bandConflicts, type FatBand } from '@/utils/fat-bands';
import { roundMoney } from '@/utils/money';

export interface FatBandRow {
  id: number;
  uuid: string;
  min_fat: number;
  max_fat: number;
  rate_per_liter: number;
  effective_from: string;
  effective_to: string | null;
  active: number;
  label: string | null;
  created_at: string;
}

export function toFatBand(row: FatBandRow): FatBand {
  return {
    uuid: row.uuid,
    minFat: row.min_fat,
    maxFat: row.max_fat,
    ratePerLiter: row.rate_per_liter,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    active: row.active === 1,
    label: row.label,
  };
}

export async function listFatBands(db: SQLiteDatabase): Promise<FatBandRow[]> {
  return (
    (await db.getAllAsync<FatBandRow>(
      `SELECT id, uuid, min_fat, max_fat, rate_per_liter, effective_from, effective_to, active, label, created_at
       FROM fat_rate_bands ORDER BY effective_from DESC, min_fat ASC;`
    )) || []
  );
}

export async function saveFatBand(
  db: SQLiteDatabase,
  input: {
    minFat: number;
    maxFat: number;
    ratePerLiter: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    label: string | null;
  }
): Promise<void> {
  const existing = (await listFatBands(db)).map(toFatBand);
  const candidate: FatBand = {
    uuid: 'new',
    minFat: input.minFat,
    maxFat: input.maxFat,
    ratePerLiter: input.ratePerLiter,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    active: true,
    label: input.label,
  };
  if (bandConflicts(candidate, existing)) {
    throw new Error('BAND_CONFLICT');
  }
  await db.runAsync(
    `INSERT INTO fat_rate_bands (min_fat, max_fat, rate_per_liter, effective_from, effective_to, active, label, created_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?);`,
    [
      input.minFat,
      input.maxFat,
      input.ratePerLiter,
      input.effectiveFrom,
      input.effectiveTo,
      input.label,
      new Date().toISOString(),
    ]
  );
}

export async function deactivateFatBand(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(`UPDATE fat_rate_bands SET active = 0 WHERE id = ?;`, [id]);
}

export async function assignedSupplierIds(db: SQLiteDatabase, collectorUserId: string): Promise<Set<number>> {
  const rows =
    (await db.getAllAsync<{ supplier_id: number }>(
      `SELECT supplier_id FROM collector_assignments WHERE collector_user_id = ? AND active = 1;`,
      [collectorUserId]
    )) || [];
  return new Set(rows.map((row) => row.supplier_id));
}

export async function setCollectorAssignment(
  db: SQLiteDatabase,
  collectorUserId: string,
  supplierId: number,
  active: boolean
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>(
    `SELECT id FROM collector_assignments WHERE collector_user_id = ? AND supplier_id = ? LIMIT 1;`,
    [collectorUserId, supplierId]
  );
  if (existing) {
    await db.runAsync(`UPDATE collector_assignments SET active = ? WHERE id = ?;`, [active ? 1 : 0, existing.id]);
    return;
  }
  if (!active) return;
  await db.runAsync(
    `INSERT INTO collector_assignments (collector_user_id, supplier_id, active, created_at) VALUES (?, ?, 1, ?);`,
    [collectorUserId, supplierId, new Date().toISOString()]
  );
}

export async function reconcileSupplierBalance(db: SQLiteDatabase, supplierId: number): Promise<number> {
  const milk = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(total_amount), 0) AS total FROM milk_collections WHERE supplier_id = ?;`,
    [supplierId]
  );
  const ledger = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM ledger_entries
     WHERE account_type = 'supplier' AND account_id = ? AND entry_type != 'milk_collection';`,
    [supplierId]
  );
  const balance = roundMoney((milk?.total ?? 0) + (ledger?.total ?? 0));
  await db.runAsync(`UPDATE suppliers SET balance = ? WHERE id = ?;`, [balance, supplierId]);
  return balance;
}

export async function recordSupplierPayment(
  db: SQLiteDatabase,
  input: {
    supplierId: number;
    supplierName: string;
    amount: number;
    date: string;
    method: string;
    reference: string | null;
    notes: string | null;
  }
): Promise<void> {
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new Error('PAYMENT_AMOUNT');
  if (input.reference) {
    const duplicate = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM ledger_entries
       WHERE account_type = 'supplier' AND account_id = ? AND entry_type = 'settlement_payout'
         AND payment_reference = ? LIMIT 1;`,
      [input.supplierId, input.reference]
    );
    if (duplicate) throw new Error('DUPLICATE_PAYMENT');
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO ledger_entries (account_type, account_id, account_name, entry_type, amount, reference_id, date, notes, payment_method, payment_reference, created_at)
       VALUES ('supplier', ?, ?, 'settlement_payout', ?, ?, ?, ?, ?, ?, ?);`,
      [
        input.supplierId,
        input.supplierName,
        -amount,
        input.reference,
        input.date,
        input.notes,
        input.method || 'Cash',
        input.reference,
        new Date().toISOString(),
      ]
    );
    await reconcileSupplierBalance(db, input.supplierId);
  });
}

const RETRY_TABLES = new Set([
  'buyers',
  'milk_entries',
  'expenses',
  'buyer_payments',
  'livestock',
  'livestock_activities',
  'suppliers',
  'milk_collections',
  'advances',
  'settlements',
  'ledger_entries',
  'fat_rate_bands',
  'collector_assignments',
]);

export interface SyncRejectionRow {
  id: number;
  table_name: string;
  record_uuid: string;
  op: string;
  reason: string;
  status: string;
  created_at: string;
}

export async function listOpenRejections(db: SQLiteDatabase): Promise<SyncRejectionRow[]> {
  return (
    (await db.getAllAsync<SyncRejectionRow>(
      `SELECT id, table_name, record_uuid, op, reason, status, created_at
       FROM sync_rejections WHERE status = 'open' ORDER BY id DESC;`
    )) || []
  );
}

export async function parkSyncRejection(
  db: SQLiteDatabase,
  row: { table: string; uuid: string; op: string; reason: string }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_rejections (table_name, record_uuid, op, reason, status, created_at) VALUES (?, ?, ?, ?, 'open', ?);`,
    [row.table, row.uuid, row.op, row.reason, new Date().toISOString()]
  );
}

export async function dismissSyncRejection(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync(`UPDATE sync_rejections SET status = 'dismissed' WHERE id = ?;`, [id]);
}

export async function retrySyncRejection(db: SQLiteDatabase, id: number): Promise<void> {
  const row = await db.getFirstAsync<SyncRejectionRow>(
    `SELECT id, table_name, record_uuid, op, reason, status, created_at FROM sync_rejections WHERE id = ?;`,
    [id]
  );
  if (!row || row.status !== 'open') return;
  if (row.table_name === 'settings') {
    await db.runAsync(`UPDATE app_settings SET value = value WHERE key = ?;`, [row.record_uuid]);
  } else if (RETRY_TABLES.has(row.table_name)) {
    await db.runAsync(`UPDATE ${row.table_name} SET id = id WHERE uuid = ?;`, [row.record_uuid]);
  } else {
    throw new Error('REJECTED_TABLE');
  }
  await db.runAsync(`UPDATE sync_rejections SET status = 'retried' WHERE id = ?;`, [id]);
}

export async function updateMilkCollection(
  db: SQLiteDatabase,
  id: number,
  input: {
    liters: number;
    fat: number;
    rate: number;
    total: number;
    bandUuid: string | null;
    notes: string | null;
    actorId: string | null;
  }
): Promise<void> {
  const existing = await db.getFirstAsync<{
    uuid: string | null;
    supplier_id: number;
    liters: number;
    fat_percentage: number;
    rate_per_liter: number;
    total_amount: number;
  }>(`SELECT uuid, supplier_id, liters, fat_percentage, rate_per_liter, total_amount FROM milk_collections WHERE id = ?;`, [
    id,
  ]);
  if (!existing) throw new Error('MISSING_COLLECTION');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE milk_collections
       SET liters = ?, fat_percentage = ?, rate_per_liter = ?, total_amount = ?, pricing_band_uuid = ?, notes = ?
       WHERE id = ?;`,
      [input.liters, input.fat, input.rate, input.total, input.bandUuid, input.notes, id]
    );
    await writeCollectionAudit(db, {
      collectionUuid: existing.uuid,
      action: 'correct',
      detail: `Was ${existing.liters}L at ${existing.fat_percentage}% (Rs ${existing.rate_per_liter}). Now ${input.liters}L at ${input.fat}% (Rs ${input.rate}).`,
      actorId: input.actorId,
    });
    await reconcileSupplierBalance(db, existing.supplier_id);
  });
}

export async function writeCollectionAudit(
  db: SQLiteDatabase,
  entry: { collectionUuid: string | null; action: string; detail: string; actorId: string | null }
): Promise<void> {
  await db.runAsync(
    `INSERT INTO collection_audit (collection_uuid, action, detail, actor_id, created_at) VALUES (?, ?, ?, ?, ?);`,
    [entry.collectionUuid, entry.action, entry.detail, entry.actorId, new Date().toISOString()]
  );
}
