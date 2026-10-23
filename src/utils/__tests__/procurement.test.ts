import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { bandConflicts, quoteCollection, type FatBand } from '../fat-bands.ts';
import { lineAmount, roundMoney } from '../money.ts';
import { payableBalance, statementForPeriod } from '../supplier-statement.ts';
import { getFridayToThursdayWeek } from '../week-cycle.ts';

const band = (partial: Partial<FatBand> & Pick<FatBand, 'uuid' | 'minFat' | 'maxFat' | 'ratePerLiter'>): FatBand => ({
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  active: true,
  ...partial,
});

describe('fat rate bands', () => {
  const low = band({ uuid: 'low', minFat: 3, maxFat: 3.9, ratePerLiter: 150 });
  const high = band({ uuid: 'high', minFat: 4, maxFat: 6, ratePerLiter: 180 });

  test('inclusive edges pick the band that owns that point', () => {
    const at39 = quoteCollection([low, high], '2026-10-23', 3.9, 10);
    const at40 = quoteCollection([low, high], '2026-10-23', 4, 10);
    assert.equal(at39.ok && at39.rate, 150);
    assert.equal(at40.ok && at40.amount, 1800);
  });

  test('a gap is not given a guessed rate', () => {
    const quote = quoteCollection([high], '2026-10-23', 3.5, 10);
    assert.deepEqual(quote, { ok: false, reason: 'none' });
  });

  test('touching ranges are an overlap', () => {
    const touching = band({ uuid: 'touch', minFat: 3, maxFat: 4, ratePerLiter: 160 });
    assert.equal(bandConflicts(touching, [high]), true);
  });

  test('a later effective date can reuse a fat range', () => {
    const next = band({
      uuid: 'next',
      minFat: 4,
      maxFat: 6,
      ratePerLiter: 200,
      effectiveFrom: '2026-11-01',
    });
    const closed = { ...high, effectiveTo: '2026-10-31' };
    assert.equal(bandConflicts(next, [closed]), false);
    const before = quoteCollection([closed, next], '2026-10-23', 5, 2);
    const after = quoteCollection([closed, next], '2026-11-02', 5, 2);
    assert.equal(before.ok && before.rate, 180);
    assert.equal(after.ok && after.rate, 200);
  });

  test('an inactive band does not price milk and does not block a replacement', () => {
    const retired = { ...high, active: false };
    const replacement = band({ uuid: 'new', minFat: 4, maxFat: 6, ratePerLiter: 190 });
    assert.equal(bandConflicts(replacement, [retired]), false);
    const quote = quoteCollection([retired], '2026-10-23', 5, 1);
    assert.equal(quote.ok, false);
  });
});

describe('money', () => {
  test('line amount rounds to 2 decimals', () => {
    assert.equal(lineAmount(10, 180.25), 1802.5);
    assert.equal(lineAmount(12.5, 10), 125);
    assert.equal(roundMoney(1802.5), 1802.5);
  });
});

describe('Friday to Thursday and supplier balance', () => {
  test('Friday opens the week and Thursday belongs to the week that started the Friday before', () => {
    const friday = getFridayToThursdayWeek('2026-10-23');
    assert.equal(friday.startDate, '2026-10-23');
    assert.equal(friday.endDate, '2026-10-29');
    const thursday = getFridayToThursdayWeek('2026-10-22');
    assert.equal(thursday.startDate, '2026-10-16');
    assert.equal(thursday.endDate, '2026-10-22');
  });

  test('opening plus milk minus payments is the remaining payable', () => {
    const statement = statementForPeriod(
      100,
      [],
      500,
      [{ date: '2026-10-23', entryType: 'settlement_payout', amount: -200 }]
    );
    assert.equal(statement.opening, 100);
    assert.equal(statement.milk, 500);
    assert.equal(statement.payments, -200);
    assert.equal(statement.closing, 400);
  });

  test('a milk ledger line is not added on top of the milk total', () => {
    const balance = payableBalance(500, [
      { date: '2026-10-23', entryType: 'milk_collection', amount: 500 },
      { date: '2026-10-23', entryType: 'settlement_payout', amount: -150 },
    ]);
    assert.equal(balance, 350);
  });

  test('a partial payment leaves the rest outstanding', () => {
    const statement = statementForPeriod(0, [], 800, [
      { date: '2026-10-23', entryType: 'settlement_payout', amount: -300 },
    ]);
    assert.equal(statement.closing, 500);
  });
});
