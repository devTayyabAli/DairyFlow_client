import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getFridayToThursdayWeek } from '../week-cycle.ts';

const week = (d: string, off = 0) => getFridayToThursdayWeek(d, off);

describe('getFridayToThursdayWeek', () => {
  it('Friday starts a new cycle', () => {
    // 2026-10-09 is a Friday
    const w = week('2026-10-09');
    assert.equal(w.startDate, '2026-10-09');
    assert.equal(w.endDate, '2026-10-15');
  });

  it('Thursday is the last day of the cycle', () => {
    const w = week('2026-10-15');
    assert.equal(w.startDate, '2026-10-09');
    assert.equal(w.endDate, '2026-10-15');
  });

  it('every day Fri..Thu maps to the same cycle, next Friday moves on', () => {
    for (let d = 9; d <= 15; d++) {
      const w = week(`2026-10-${String(d).padStart(2, '0')}`);
      assert.equal(w.startDate, '2026-10-09', `day ${d}`);
    }
    assert.equal(week('2026-10-16').startDate, '2026-10-16');
    assert.equal(week('2026-10-08').startDate, '2026-10-02');
  });

  it('weekOffset moves by whole weeks in both directions', () => {
    assert.equal(week('2026-10-12', -1).startDate, '2026-10-02');
    assert.equal(week('2026-10-12', 1).startDate, '2026-10-16');
    assert.equal(week('2026-10-12', 0).startDate, '2026-10-09');
    assert.equal(week('2026-10-12', 52).startDate, '2027-10-08');
  });

  it('crosses month boundaries', () => {
    const w = week('2026-10-30'); // Friday
    assert.equal(w.startDate, '2026-10-30');
    assert.equal(w.endDate, '2026-11-05');
    assert.equal(w.label, '30 Oct – 05 Nov 2026 (Fri–Thu)');
  });

  it('crosses year boundaries (label uses the Thursday year)', () => {
    const w = week('2026-12-31'); // Thursday
    assert.equal(w.startDate, '2026-12-25');
    assert.equal(w.endDate, '2026-12-31');
    const w2 = week('2027-01-02'); // Saturday
    assert.equal(w2.startDate, '2027-01-01');
    assert.equal(w2.endDate, '2027-01-07');
    assert.equal(w2.label, '01 Jan – 07 Jan 2027 (Fri–Thu)');
    // Cycle starting in one year and ending in the next
    const w3 = week('2027-12-31'); // Friday
    assert.equal(w3.endDate, '2028-01-06');
    assert.equal(w3.label, '31 Dec – 06 Jan 2028 (Fri–Thu)');
  });

  it('handles leap day', () => {
    const w = week('2028-02-29'); // Tuesday
    assert.equal(w.startDate, '2028-02-25');
    assert.equal(w.endDate, '2028-03-02');
  });

  it('accepts Date objects and ignores time of day', () => {
    const late = new Date(2026, 9, 15, 23, 59, 59);
    const early = new Date(2026, 9, 9, 0, 0, 1);
    assert.equal(getFridayToThursdayWeek(late).startDate, '2026-10-09');
    assert.equal(getFridayToThursdayWeek(early).startDate, '2026-10-09');
  });

  it('start is always Friday and end is always Thursday over 366 days', () => {
    const d = new Date(2026, 0, 1, 12);
    for (let i = 0; i < 366; i++) {
      const w = getFridayToThursdayWeek(d);
      assert.equal(new Date(`${w.startDate}T12:00:00`).getDay(), 5);
      assert.equal(new Date(`${w.endDate}T12:00:00`).getDay(), 4);
      d.setDate(d.getDate() + 1);
    }
  });
});
