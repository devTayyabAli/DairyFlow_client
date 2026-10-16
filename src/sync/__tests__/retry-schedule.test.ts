import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { RETRY_DELAYS_MS, retryDelayMs } from '../retry-schedule.ts';

describe('retry schedule', () => {
  test('30 seconds, then 1 minute, then 5 minutes', () => {
    assert.equal(retryDelayMs(0), 30_000);
    assert.equal(retryDelayMs(1), 60_000);
    assert.equal(retryDelayMs(2), 300_000);
  });

  test('stays at 5 minutes for every later attempt', () => {
    for (const n of [3, 4, 10, 1000]) assert.equal(retryDelayMs(n), 300_000);
  });

  test('bad input falls back to the first delay instead of throwing', () => {
    assert.equal(retryDelayMs(-5), 30_000);
    assert.equal(retryDelayMs(Number.NaN), 30_000);
  });

  test('delays never decrease', () => {
    for (let i = 1; i < RETRY_DELAYS_MS.length; i++) assert.ok(RETRY_DELAYS_MS[i] >= RETRY_DELAYS_MS[i - 1]);
  });
});
