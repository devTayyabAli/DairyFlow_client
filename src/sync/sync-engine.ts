import * as Network from 'expo-network';
import { SQLiteDatabase } from 'expo-sqlite';
import {
  clearSyncQueueRows,
  getDefaultBuyer,
  getPendingSyncQueue,
  resolveAnimalId,
  resolveBuyerId,
  resolveBuyerUuid,
  resolveAnimalUuid,
} from '@/db/database';
import { describeError, fetchWithTimeout, isNetworkError } from './network-errors';
import { getApiEndpoint } from './sync-config';
import {
  getAuthToken,
  getSyncCursor,
  setLastSyncedAt,
  setSyncCursor,
} from './sync-storage';
import {
  ClientSyncChange,
  PullResponse,
  PushResponse,
  ServerSyncChange,
  SyncResult,
} from './sync-types';

let isSyncInProgress = false;
let sessionExpiredCallback: (() => void) | null = null;

export function isSyncRunning(): boolean {
  return isSyncInProgress;
}

/**
 * Normalises timestamps to ISO-8601 UTC. SQLite's datetime('now') yields "YYYY-MM-DD HH:MM:SS"
 * (UTC, no zone); rows backfilled from created_at are already ISO. Sending one format keeps
 * last-write-wins comparisons on the server consistent.
 */
export function toIsoTimestamp(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value;
  const ms = Date.parse(normalized);
  return Number.isNaN(ms) ? fallback : new Date(ms).toISOString();
}

/** True when the farm already has records on the server (used to decide about demo data). */
export async function serverHasData(token: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(getApiEndpoint('/sync/pull?since=0&limit=1'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return false;
    const body = (await res.json()) as PullResponse;
    return (body.changes?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

const DEFER = Symbol('defer');

export function onSessionExpired(callback: () => void) {
  sessionExpiredCallback = callback;
}

export async function isNetworkConnected(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return Boolean(state.isConnected && state.isInternetReachable !== false);
  } catch {
    return false;
  }
}

/**
 * Execute full bidirectional sync (Push local changes, Pull remote changes).
 * Guarantees single-flight execution and safe error handling without throwing into UI.
 */
export async function syncNow(db: SQLiteDatabase): Promise<SyncResult> {
  if (isSyncInProgress) {
    return { status: 'skipped', message: 'Sync already in progress' };
  }

  const token = await getAuthToken();
  if (!token) {
    return { status: 'skipped', message: 'Not signed in' };
  }

  const online = await isNetworkConnected();
  if (!online) {
    return { status: 'skipped', message: 'No internet connection' };
  }

  isSyncInProgress = true;
  let totalApplied = 0;
  let totalPulled = 0;
  let rejectedCount = 0;
  let rejectedSample = '';

  try {
    // -----------------------------------------------------------
    // PART 1: PUSH LOCAL CHANGES
    // -----------------------------------------------------------
    const queueRows = await getPendingSyncQueue(db, 500);

    if (queueRows.length > 0) {
      // Collapse multiple modifications on the same (table_name, row_uuid) to the latest op
      const latestOpMap = new Map<
        string,
        {
          queueIds: number[];
          table_name: string;
          row_uuid: string;
          op: 'upsert' | 'delete';
          queuedAt: string;
        }
      >();

      for (const row of queueRows) {
        const key = `${row.table_name}:${row.row_uuid}`;
        const existing = latestOpMap.get(key);
        if (!existing) {
          latestOpMap.set(key, {
            queueIds: [row.id],
            table_name: row.table_name,
            row_uuid: row.row_uuid,
            op: row.op,
            queuedAt: row.queued_at,
          });
        } else {
          existing.queueIds.push(row.id);
          existing.op = row.op; // overwrite with newest op
          existing.queuedAt = row.queued_at;
        }
      }

      const clientChanges: ClientSyncChange[] = [];
      const queueIdsToClear: number[] = [];

      for (const item of latestOpMap.values()) {
        const { table_name, row_uuid, op } = item;
        // Use when the change happened locally, not when it is pushed: a phone that was offline
        // for days must not let an old delete override a newer edit made on another device.
        const queuedAtIso = toIsoTimestamp(item.queuedAt, new Date().toISOString());

        if (op === 'delete') {
          clientChanges.push({
            table: table_name,
            uuid: row_uuid,
            op: 'delete',
            clientUpdatedAt: queuedAtIso,
          });
          queueIdsToClear.push(...item.queueIds);
          continue;
        }

        // Handle Upsert: load current entity from SQLite
        const payload = await loadWirePayload(db, table_name, row_uuid);
        if (payload === DEFER) {
          // Dependency (e.g. its buyer) not resolvable yet: keep it queued and retry next sync.
          continue;
        }
        if (payload) {
          clientChanges.push(payload);
          queueIdsToClear.push(...item.queueIds);
        } else {
          // Row was deleted locally prior to push
          clientChanges.push({
            table: table_name,
            uuid: row_uuid,
            op: 'delete',
            clientUpdatedAt: queuedAtIso,
          });
          queueIdsToClear.push(...item.queueIds);
        }
      }

      if (clientChanges.length > 0) {
        const pushUrl = getApiEndpoint('/sync/push');
        const pushRes = await fetchWithTimeout(pushUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ changes: clientChanges }),
        });

        if (pushRes.status === 401) {
          sessionExpiredCallback?.();
          return { status: 'error', message: 'Session expired. Please sign in again.' };
        }

        if (!pushRes.ok) {
          const errText = await pushRes.text().catch(() => '');
          console.warn('Sync push failed with status:', pushRes.status, errText);
          return {
            status: 'error',
            kind: pushRes.status >= 500 ? 'server' : undefined,
            message: `Server error during push (${pushRes.status})`,
          };
        }

        const pushData = (await pushRes.json()) as PushResponse;
        totalApplied += pushData.applied;

        // The server drops invalid changes without failing the batch. They leave the queue below,
        // so report them instead of letting sync look fully successful.
        if (pushData.rejected?.length) {
          rejectedCount += pushData.rejected.length;
          const first = pushData.rejected[0];
          rejectedSample = `${first.table}: ${first.reason}`;
          console.warn('[Sync] Server rejected changes:', pushData.rejected);
        }

        // Clear exactly the queue IDs that were pushed (newly queued rows survive)
        await clearSyncQueueRows(db, queueIdsToClear);
      }
    }

    // -----------------------------------------------------------
    // PART 2: PULL REMOTE CHANGES
    // -----------------------------------------------------------
    let hasMore = true;

    while (hasMore) {
      const currentCursor = await getSyncCursor(db);
      const pullUrl = getApiEndpoint(`/sync/pull?since=${currentCursor}&limit=500`);

      const pullRes = await fetchWithTimeout(pullUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (pullRes.status === 401) {
        sessionExpiredCallback?.();
        return { status: 'error', message: 'Session expired. Please sign in again.' };
      }

      if (!pullRes.ok) {
        const errText = await pullRes.text().catch(() => '');
        console.warn('Sync pull failed with status:', pullRes.status, errText);
        return {
          status: 'error',
          kind: pullRes.status >= 500 ? 'server' : undefined,
          message: `Server error during pull (${pullRes.status})`,
        };
      }

      const pullData = (await pullRes.json()) as PullResponse;
      const changes = pullData.changes || [];

      if (changes.length > 0) {
        await applyRemoteChangesToDatabase(db, changes);
        totalPulled += changes.length;
      }

      await setSyncCursor(db, pullData.cursor);
      await setLastSyncedAt(db, new Date().toISOString());

      hasMore = pullData.hasMore === true && changes.length > 0;
    }

    return {
      status: 'success',
      appliedCount: totalApplied,
      pulledCount: totalPulled,
      rejectedCount,
      rejectedSample,
    };
  } catch (err) {
    console.warn('Unexpected error during sync:', err);
    return {
      status: 'error',
      kind: isNetworkError(err) ? 'network' : undefined,
      message: describeError(err, 'en'),
    };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Loads a row from local SQLite and serializes it to the API wire format.
 */
async function loadWirePayload(
  db: SQLiteDatabase,
  table: string,
  uuid: string
): Promise<ClientSyncChange | null | typeof DEFER> {
  const now = new Date().toISOString();

  switch (table) {
    case 'buyers': {
      const row = await db.getFirstAsync<{
        name: string;
        phone: string | null;
        address: string | null;
        is_default: number;
        created_at: string;
        updated_at: string | null;
      }>('SELECT name, phone, address, is_default, created_at, updated_at FROM buyers WHERE uuid = ? LIMIT 1;', [uuid]);

      if (!row) return null;
      return {
        table,
        uuid,
        op: 'upsert',
        data: {
          name: row.name,
          phone: row.phone,
          address: row.address,
          is_default: row.is_default,
          created_at: row.created_at,
        },
        clientUpdatedAt: toIsoTimestamp(row.updated_at || row.created_at, now),
      };
    }

    case 'milk_entries': {
      const row = await db.getFirstAsync<{
        date: string;
        shift: string;
        liters: number;
        fat_percentage: number;
        rate_per_liter: number;
        total_amount: number;
        buyer_id: number;
        buyer_name: string;
        notes: string | null;
        created_at: string;
        updated_at: string | null;
      }>(
        'SELECT date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, notes, created_at, updated_at FROM milk_entries WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (!row) return null;
      const buyerUuid = await resolveBuyerUuid(db, row.buyer_id);
      if (!buyerUuid) return DEFER; // never invent a buyer: that would book the sale to the wrong one

      return {
        table,
        uuid,
        op: 'upsert',
        data: {
          date: row.date,
          shift: row.shift,
          liters: row.liters,
          fat_percentage: row.fat_percentage,
          rate_per_liter: row.rate_per_liter,
          total_amount: row.total_amount,
          buyer_uuid: buyerUuid,
          buyer_name: row.buyer_name,
          notes: row.notes,
          created_at: row.created_at,
        },
        clientUpdatedAt: toIsoTimestamp(row.updated_at || row.created_at, now),
      };
    }

    case 'expenses': {
      const row = await db.getFirstAsync<{
        date: string;
        category: string;
        title: string;
        amount: number;
        quantity: number | null;
        unit: string | null;
        unit_price: number | null;
        supplier_or_payee: string | null;
        payment_method: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string | null;
      }>(
        'SELECT date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, notes, created_at, updated_at FROM expenses WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (!row) return null;
      return {
        table,
        uuid,
        op: 'upsert',
        data: {
          date: row.date,
          category: row.category,
          title: row.title,
          amount: row.amount,
          quantity: row.quantity,
          unit: row.unit,
          unit_price: row.unit_price,
          supplier_or_payee: row.supplier_or_payee,
          payment_method: row.payment_method,
          notes: row.notes,
          created_at: row.created_at,
        },
        clientUpdatedAt: toIsoTimestamp(row.updated_at || row.created_at, now),
      };
    }

    case 'buyer_payments': {
      const row = await db.getFirstAsync<{
        buyer_id: number;
        date: string;
        amount: number;
        payment_method: string;
        received_by: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string | null;
      }>(
        'SELECT buyer_id, date, amount, payment_method, received_by, notes, created_at, updated_at FROM buyer_payments WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (!row) return null;
      const buyerUuid = await resolveBuyerUuid(db, row.buyer_id);
      if (!buyerUuid) return DEFER;

      return {
        table,
        uuid,
        op: 'upsert',
        data: {
          buyer_uuid: buyerUuid,
          date: row.date,
          amount: row.amount,
          payment_method: row.payment_method || 'Cash',
          received_by: row.received_by,
          notes: row.notes,
          created_at: row.created_at,
        },
        clientUpdatedAt: toIsoTimestamp(row.updated_at || row.created_at, now),
      };
    }

    case 'livestock': {
      const row = await db.getFirstAsync<{
        tag_number: string;
        name: string | null;
        species: string;
        gender: string;
        status: string;
        breed: string | null;
        birth_date: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string | null;
      }>(
        'SELECT tag_number, name, species, gender, status, breed, birth_date, notes, created_at, updated_at FROM livestock WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (!row) return null;
      return {
        table,
        uuid,
        op: 'upsert',
        data: {
          tag_number: row.tag_number,
          name: row.name,
          species: row.species,
          gender: row.gender,
          status: row.status,
          breed: row.breed,
          birth_date: row.birth_date,
          notes: row.notes,
          created_at: row.created_at,
        },
        clientUpdatedAt: toIsoTimestamp(row.updated_at || row.created_at, now),
      };
    }

    case 'livestock_activities': {
      const row = await db.getFirstAsync<{
        animal_id: number | null;
        animal_tag: string;
        activity_type: string;
        title: string;
        date: string;
        notes: string | null;
        created_at: string;
        updated_at: string | null;
      }>(
        'SELECT animal_id, animal_tag, activity_type, title, date, notes, created_at, updated_at FROM livestock_activities WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (!row) return null;
      const animalUuid = row.animal_id ? await resolveAnimalUuid(db, row.animal_id) : null;

      return {
        table,
        uuid,
        op: 'upsert',
        data: {
          animal_uuid: animalUuid,
          animal_tag: row.animal_tag,
          activity_type: row.activity_type,
          title: row.title,
          date: row.date,
          notes: row.notes,
          created_at: row.created_at,
        },
        clientUpdatedAt: toIsoTimestamp(row.updated_at || row.created_at, now),
      };
    }

    case 'settings': {
      const row = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_settings WHERE key = ? LIMIT 1;',
        [uuid]
      );
      if (!row) return null;
      return {
        table: 'settings',
        uuid,
        op: 'upsert',
        data: { value: row.value },
        clientUpdatedAt: now,
      };
    }

    default:
      return null;
  }
}

/**
 * Apply remote pulled changes to local SQLite in FK-safe dependency order.
 * Triggers are bypassed via `sync_applying = '1'` to avoid ping-pong.
 */
async function applyRemoteChangesToDatabase(
  db: SQLiteDatabase,
  changes: ServerSyncChange[]
): Promise<void> {
  // Sort changes in FK dependency order:
  // 1. buyers, 2. livestock, 3. milk_entries, 4. buyer_payments, 5. livestock_activities, 6. expenses, 7. settings
  const tablePriority: Record<string, number> = {
    buyers: 1,
    livestock: 2,
    milk_entries: 3,
    buyer_payments: 4,
    livestock_activities: 5,
    expenses: 6,
    settings: 7,
  };

  const sortedChanges = [...changes].sort((a, b) => {
    const pA = tablePriority[a.table] || 99;
    const pB = tablePriority[b.table] || 99;
    return pA - pB;
  });

  await db.withTransactionAsync(async () => {
    // Suppress local trigger enqueues while applying remote rows
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('sync_applying', '1');");

    try {
      for (const change of sortedChanges) {
        await applySingleChange(db, change);
      }
    } finally {
      await db.runAsync("DELETE FROM app_settings WHERE key = 'sync_applying';");
    }
  });
}

/**
 * Maps a buyer uuid to the local buyer id. If that buyer has not been pulled yet (it can arrive
 * in a later page), create a placeholder with the same uuid: the real buyer record then updates
 * it in place, so the sale/payment stays attributed to the right buyer instead of a default one.
 * Legacy changes with an unusable uuid fall back to the default buyer.
 */
async function resolveOrCreateBuyerId(
  db: SQLiteDatabase,
  buyerUuid: string | undefined,
  buyerName: string
): Promise<number> {
  if (buyerUuid && buyerUuid !== 'default-buyer-uuid') {
    const existingId = await resolveBuyerId(db, buyerUuid);
    if (existingId) return existingId;

    const now = new Date().toISOString();
    const res = await db.runAsync(
      `INSERT INTO buyers (name, phone, address, is_default, created_at, uuid, updated_at)
       VALUES (?, NULL, NULL, 0, ?, ?, ?);`,
      [buyerName, now, buyerUuid, now]
    );
    return res.lastInsertRowId;
  }

  const def = await getDefaultBuyer(db);
  if (def) return def.id;
  const now = new Date().toISOString();
  const created = await db.runAsync(
    `INSERT INTO buyers (name, phone, address, is_default, created_at, uuid, updated_at)
     VALUES (?, NULL, NULL, 1, ?, lower(hex(randomblob(16))), ?);`,
    [buyerName, now, now]
  );
  return created.lastInsertRowId;
}

/**
 * Applies a single ServerSyncChange to local SQLite.
 */
async function applySingleChange(db: SQLiteDatabase, change: ServerSyncChange): Promise<void> {
  const { table, uuid, op, data } = change;
  const now = new Date().toISOString();

  if (table === 'buyers') {
    if (op === 'delete') {
      try {
        await db.runAsync('DELETE FROM buyers WHERE uuid = ?;', [uuid]);
      } catch (err) {
        console.warn(`[Sync] Cannot delete buyer ${uuid} (foreign key restriction). Skipped.`, err);
      }
    } else if (data) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM buyers WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE buyers SET
            name = ?, phone = ?, address = ?, is_default = ?, updated_at = datetime('now')
          WHERE uuid = ?;`,
          [
            data.name as string,
            (data.phone as string) || null,
            (data.address as string) || null,
            data.is_default ? 1 : 0,
            uuid,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO buyers (name, phone, address, is_default, created_at, uuid, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now'));`,
          [
            data.name as string,
            (data.phone as string) || null,
            (data.address as string) || null,
            data.is_default ? 1 : 0,
            (data.created_at as string) || now,
            uuid,
          ]
        );
      }
    }
    return;
  }

  if (table === 'livestock') {
    if (op === 'delete') {
      await db.runAsync('DELETE FROM livestock WHERE uuid = ?;', [uuid]);
    } else if (data) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM livestock WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE livestock SET
            tag_number = ?, name = ?, species = ?, gender = ?, status = ?, breed = ?, birth_date = ?, notes = ?, updated_at = datetime('now')
          WHERE uuid = ?;`,
          [
            data.tag_number as string,
            (data.name as string) || null,
            data.species as string,
            data.gender as string,
            data.status as string,
            (data.breed as string) || null,
            (data.birth_date as string) || null,
            (data.notes as string) || null,
            uuid,
          ]
        );
      } else {
        // Tag number uniqueness check: if tag exists under another uuid, update to newest
        const tagMatch = await db.getFirstAsync<{ id: number }>(
          'SELECT id FROM livestock WHERE tag_number = ? LIMIT 1;',
          [data.tag_number as string]
        );

        if (tagMatch) {
          await db.runAsync(
            `UPDATE livestock SET
              uuid = ?, name = ?, species = ?, gender = ?, status = ?, breed = ?, birth_date = ?, notes = ?, updated_at = datetime('now')
            WHERE id = ?;`,
            [
              uuid,
              (data.name as string) || null,
              data.species as string,
              data.gender as string,
              data.status as string,
              (data.breed as string) || null,
              (data.birth_date as string) || null,
              (data.notes as string) || null,
              tagMatch.id,
            ]
          );
        } else {
          await db.runAsync(
            `INSERT INTO livestock (tag_number, name, species, gender, status, breed, birth_date, notes, created_at, uuid, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
            [
              data.tag_number as string,
              (data.name as string) || null,
              data.species as string,
              data.gender as string,
              data.status as string,
              (data.breed as string) || null,
              (data.birth_date as string) || null,
              (data.notes as string) || null,
              (data.created_at as string) || now,
              uuid,
            ]
          );
        }
      }
    }
    return;
  }

  if (table === 'milk_entries') {
    if (op === 'delete') {
      await db.runAsync('DELETE FROM milk_entries WHERE uuid = ?;', [uuid]);
    } else if (data) {
      // Resolve buyer_uuid -> local integer buyer_id (placeholder if the buyer has not arrived yet)
      const localBuyerId = await resolveOrCreateBuyerId(
        db,
        data.buyer_uuid as string,
        (data.buyer_name as string) || 'Buyer'
      );

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM milk_entries WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE milk_entries SET
            date = ?, shift = ?, liters = ?, fat_percentage = ?, rate_per_liter = ?, total_amount = ?, buyer_id = ?, buyer_name = ?, notes = ?, updated_at = datetime('now')
          WHERE uuid = ?;`,
          [
            data.date as string,
            data.shift as string,
            Number(data.liters),
            Number(data.fat_percentage),
            Number(data.rate_per_liter),
            Number(data.total_amount),
            localBuyerId,
            (data.buyer_name as string) || 'Buyer',
            (data.notes as string) || null,
            uuid,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO milk_entries (date, shift, liters, fat_percentage, rate_per_liter, total_amount, buyer_id, buyer_name, notes, created_at, uuid, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
          [
            data.date as string,
            data.shift as string,
            Number(data.liters),
            Number(data.fat_percentage),
            Number(data.rate_per_liter),
            Number(data.total_amount),
            localBuyerId,
            (data.buyer_name as string) || 'Buyer',
            (data.notes as string) || null,
            (data.created_at as string) || now,
            uuid,
          ]
        );
      }
    }
    return;
  }

  if (table === 'buyer_payments') {
    if (op === 'delete') {
      await db.runAsync('DELETE FROM buyer_payments WHERE uuid = ?;', [uuid]);
    } else if (data) {
      const localBuyerId = await resolveOrCreateBuyerId(db, data.buyer_uuid as string, 'Buyer');

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM buyer_payments WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE buyer_payments SET
            buyer_id = ?, date = ?, amount = ?, payment_method = ?, received_by = ?, notes = ?, updated_at = datetime('now')
          WHERE uuid = ?;`,
          [
            localBuyerId,
            data.date as string,
            Number(data.amount),
            (data.payment_method as string) || 'Cash',
            (data.received_by as string) || null,
            (data.notes as string) || null,
            uuid,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO buyer_payments (buyer_id, date, amount, payment_method, received_by, notes, created_at, uuid, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
          [
            localBuyerId,
            data.date as string,
            Number(data.amount),
            (data.payment_method as string) || 'Cash',
            (data.received_by as string) || null,
            (data.notes as string) || null,
            (data.created_at as string) || now,
            uuid,
          ]
        );
      }
    }
    return;
  }

  if (table === 'livestock_activities') {
    if (op === 'delete') {
      await db.runAsync('DELETE FROM livestock_activities WHERE uuid = ?;', [uuid]);
    } else if (data) {
      let localAnimalId: number | null = null;
      if (data.animal_uuid) {
        localAnimalId = await resolveAnimalId(db, data.animal_uuid as string);
      }

      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM livestock_activities WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE livestock_activities SET
            animal_id = ?, animal_tag = ?, activity_type = ?, title = ?, date = ?, notes = ?, updated_at = datetime('now')
          WHERE uuid = ?;`,
          [
            localAnimalId,
            data.animal_tag as string,
            data.activity_type as string,
            data.title as string,
            data.date as string,
            (data.notes as string) || null,
            uuid,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO livestock_activities (animal_id, animal_tag, activity_type, title, date, notes, created_at, uuid, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
          [
            localAnimalId,
            data.animal_tag as string,
            data.activity_type as string,
            data.title as string,
            data.date as string,
            (data.notes as string) || null,
            (data.created_at as string) || now,
            uuid,
          ]
        );
      }
    }
    return;
  }

  if (table === 'expenses') {
    if (op === 'delete') {
      await db.runAsync('DELETE FROM expenses WHERE uuid = ?;', [uuid]);
    } else if (data) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM expenses WHERE uuid = ? LIMIT 1;',
        [uuid]
      );

      if (existing) {
        await db.runAsync(
          `UPDATE expenses SET
            date = ?, category = ?, title = ?, amount = ?, quantity = ?, unit = ?, unit_price = ?, supplier_or_payee = ?, payment_method = ?, notes = ?, updated_at = datetime('now')
          WHERE uuid = ?;`,
          [
            data.date as string,
            data.category as string,
            data.title as string,
            Number(data.amount),
            data.quantity !== undefined && data.quantity !== null ? Number(data.quantity) : null,
            (data.unit as string) || null,
            data.unit_price !== undefined && data.unit_price !== null ? Number(data.unit_price) : null,
            (data.supplier_or_payee as string) || null,
            (data.payment_method as string) || 'Cash',
            (data.notes as string) || null,
            uuid,
          ]
        );
      } else {
        await db.runAsync(
          `INSERT INTO expenses (date, category, title, amount, quantity, unit, unit_price, supplier_or_payee, payment_method, notes, created_at, uuid, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'));`,
          [
            data.date as string,
            data.category as string,
            data.title as string,
            Number(data.amount),
            data.quantity !== undefined && data.quantity !== null ? Number(data.quantity) : null,
            (data.unit as string) || null,
            data.unit_price !== undefined && data.unit_price !== null ? Number(data.unit_price) : null,
            (data.supplier_or_payee as string) || null,
            (data.payment_method as string) || 'Cash',
            (data.notes as string) || null,
            (data.created_at as string) || now,
            uuid,
          ]
        );
      }
    }
    return;
  }

  if (table === 'settings') {
    const allowed = ['farm_name', 'admin_name', 'admin_phone', 'default_milk_rate'];
    if (allowed.includes(uuid) && data && typeof data.value === 'string') {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
        [uuid, data.value]
      );
    }
  }
}
