import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BACKUP_FORMAT_IDENTIFIER,
  CURRENT_BACKUP_VERSION,
  calculateBackupMetadata,
  createBackupEnvelope,
  parseAndValidateBackupJson,
  serializeBackupToJson,
  validateBackupPayload,
} from '../backup-restore.ts';

const TS = '2026-10-15T05:00:00.000Z';

function data() {
  return {
    buyers: [
      { id: 1, name: 'Ali', phone: null, address: null, is_default: 1, created_at: TS },
      { id: 2, name: 'Bashir', phone: '0300', address: 'Lahore', is_default: 0, created_at: TS },
    ],
    milk_entries: [
      { id: 1, date: '2026-10-15', shift: 'Morning' as const, liters: 10, fat_percentage: 5, rate_per_liter: 150, total_amount: 1500.75, buyer_id: 1, buyer_name: 'Ali', notes: null, created_at: TS },
      { id: 2, date: '2026-10-15', shift: 'Evening' as const, liters: 4.1, fat_percentage: 5, rate_per_liter: 150, total_amount: 615.1, buyer_id: 2, buyer_name: 'Bashir', notes: null, created_at: TS },
    ],
    expenses: [
      { id: 1, date: '2026-10-14', category: 'Feed' as const, title: 'Wanda', amount: 3000, quantity: null, unit: null, unit_price: null, supplier_or_payee: null, payment_method: null, notes: null, created_at: TS },
    ],
    buyer_payments: [],
    livestock: [],
    livestock_activities: [],
  };
}

const valid = (): any => JSON.parse(serializeBackupToJson(createBackupEnvelope(data())));

describe('calculateBackupMetadata', () => {
  it('counts rows and rounds totals to 2 decimals', () => {
    const m = calculateBackupMetadata(data());
    assert.equal(m.buyersCount, 2);
    assert.equal(m.milkEntriesCount, 2);
    assert.equal(m.expensesCount, 1);
    assert.equal(m.totalMilkLiters, 14.1);
    assert.equal(m.totalMilkRevenue, 2115.85);
    assert.equal(m.totalExpensesAmount, 3000);
  });
});

describe('backup round trip', () => {
  it('create -> serialize -> parse -> validate succeeds', () => {
    const env = parseAndValidateBackupJson(serializeBackupToJson(createBackupEnvelope(data())));
    assert.equal(env.format, BACKUP_FORMAT_IDENTIFIER);
    assert.equal(env.version, CURRENT_BACKUP_VERSION);
    assert.equal(env.data.milk_entries.length, 2);
  });

  it('preserves Urdu text', () => {
    const d = data();
    d.buyers[0].name = 'علی خان';
    const env = parseAndValidateBackupJson(serializeBackupToJson(createBackupEnvelope(d)));
    assert.equal(env.data.buyers[0].name, 'علی خان');
  });
});

describe('validateBackupPayload', () => {
  const errorsOf = (p: unknown) => validateBackupPayload(p).errors.join('\n');

  it('rejects non-objects', () => {
    for (const bad of [null, 'x', 3, [], undefined]) {
      assert.equal(validateBackupPayload(bad).isValid, false);
    }
  });

  it('rejects wrong format and version', () => {
    const p = valid();
    p.format = 'OTHER';
    p.version = 99;
    const e = errorsOf(p);
    assert.match(e, /Unsupported backup format/);
    assert.match(e, /Unsupported backup version/);
  });

  it('detects metadata count mismatch', () => {
    const p = valid();
    p.metadata.buyersCount = 5;
    assert.match(errorsOf(p), /buyersCount/);
  });

  it('detects foreign-key violation (milk entry -> missing buyer)', () => {
    const p = valid();
    p.data.milk_entries[0].buyer_id = 99;
    assert.match(errorsOf(p), /non-existent buyer_id #99/);
  });

  it('detects duplicate ids and multiple default buyers', () => {
    const p = valid();
    p.data.buyers[1].id = 1;
    p.data.buyers[1].is_default = 1;
    const e = errorsOf(p);
    assert.match(e, /Duplicate buyer ID/);
    assert.match(e, /Multiple default buyers/);
  });

  it('rejects impossible calendar dates (2026-02-30) and bad shifts', () => {
    const p = valid();
    p.data.milk_entries[0].date = '2026-02-30';
    p.data.milk_entries[1].shift = 'Noon';
    const e = errorsOf(p);
    assert.match(e, /Invalid date "2026-02-30"/);
    assert.match(e, /Invalid shift "Noon"/);
  });

  it('accepts leap day', () => {
    const p = valid();
    p.data.milk_entries[0].date = '2028-02-29';
    assert.equal(validateBackupPayload(p).isValid, true);
  });

  it('rejects non-positive liters and negative rate', () => {
    const p = valid();
    p.data.milk_entries[0].liters = 0;
    p.data.milk_entries[1].rate_per_liter = -1;
    const e = errorsOf(p);
    assert.match(e, /liters/);
    assert.match(e, /rate_per_liter/);
  });

  it('rejects unknown expense category and non-positive amount', () => {
    const p = valid();
    p.data.expenses[0].category = 'Party';
    p.data.expenses[0].amount = 0;
    const e = errorsOf(p);
    assert.match(e, /Invalid category/);
    assert.match(e, /amount/);
  });

  it('validates optional tables when present', () => {
    const p = valid();
    p.data.buyer_payments = [{ id: 1, buyer_id: 42, date: '2026-10-01', amount: -5 }];
    p.data.livestock = [{ id: 1, tag_number: '', species: 'Goat' }];
    const e = errorsOf(p);
    assert.match(e, /BuyerPayment\[0\]/);
    assert.match(e, /tag_number/);
    assert.match(e, /Invalid species/);
  });

  it('accepts an old backup without optional tables', () => {
    const p = valid();
    delete p.data.buyer_payments;
    delete p.data.livestock;
    delete p.data.livestock_activities;
    assert.equal(validateBackupPayload(p).isValid, true);
  });

  it('missing data container is invalid', () => {
    const p = valid();
    delete p.data;
    assert.equal(validateBackupPayload(p).isValid, false);
  });
});

describe('parseAndValidateBackupJson', () => {
  it('throws a descriptive error on malformed JSON', () => {
    assert.throws(() => parseAndValidateBackupJson('{nope'), /Malformed JSON backup file/);
  });
  it('throws listing validation errors', () => {
    assert.throws(() => parseAndValidateBackupJson('{}'), /Backup validation failed with \d+ error/);
  });
});
