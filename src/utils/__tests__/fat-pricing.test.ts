import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { effectiveSlope, formatRate, parseFatPricing, rateForFat } from '../fat-pricing.ts';

const on = (base: string, ref = '6', slope = '') =>
  parseFatPricing({ enabled: '1', baseRate: base, referenceFat: ref, slope });

describe('proportional pricing (180 at 6% fat = Rs 30 per fat point)', () => {
  const p = on('180');

  test('the anchor itself is unchanged', () => {
    assert.equal(rateForFat(p, 6), 180);
  });

  test('rate rises and falls with fat', () => {
    assert.equal(rateForFat(p, 5), 150);
    assert.equal(rateForFat(p, 7), 210);
    assert.equal(rateForFat(p, 4.5), 135);
    assert.equal(rateForFat(p, 5.2), 156);
  });

  test('slope is derived from the anchor', () => {
    assert.equal(effectiveSlope(p), 30);
  });
});

describe('explicit step per 1% fat', () => {
  test('uses the admin step around the anchor', () => {
    const p = on('180', '6', '20');
    assert.equal(rateForFat(p, 6), 180);
    assert.equal(rateForFat(p, 5), 160);
    assert.equal(rateForFat(p, 7), 200);
  });

  test('a different reference fat shifts the anchor', () => {
    const p = on('200', '4.5', '25');
    assert.equal(rateForFat(p, 4.5), 200);
    assert.equal(rateForFat(p, 5.5), 225);
  });
});

describe('safety', () => {
  test('flat pricing when switched off', () => {
    const p = parseFatPricing({ enabled: '0', baseRate: '180', referenceFat: '6', slope: '' });
    assert.equal(rateForFat(p, 3), 180);
    assert.equal(rateForFat(p, 9), 180);
  });

  test('never negative, never NaN', () => {
    const p = on('180', '6', '50');
    assert.equal(rateForFat(p, 0), 0);
    assert.equal(rateForFat(p, Number.NaN), 180);
    assert.equal(rateForFat(p, -2), 180);
  });

  test('bad or missing settings fall back to flat pricing', () => {
    assert.equal(parseFatPricing({ enabled: '1', baseRate: '', referenceFat: '6' }).enabled, false);
    assert.equal(parseFatPricing({ enabled: '1', baseRate: 'abc' }).enabled, false);
    const noRef = parseFatPricing({ enabled: '1', baseRate: '180', referenceFat: '0' });
    assert.equal(noRef.referenceFat, 6);
    assert.equal(noRef.enabled, true);
  });

  test('rounds to 2 decimals', () => {
    const p = on('190', '4.5');
    assert.equal(rateForFat(p, 4.7), 198.44);
  });

  test('formatRate trims trailing zeros', () => {
    assert.equal(formatRate(150), '150');
    assert.equal(formatRate(142.5), '142.5');
    assert.equal(formatRate(198.44), '198.44');
  });
});
