// Run: node --experimental-strip-types --test src/utils/pin-security.test.ts
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  attemptsRemaining,
  checkPinAgainst,
  constantTimeEqual,
  createStoredPin,
  formatCountdown,
  lockoutSecondsFor,
  lockRemainingMs,
  MAX_LOCKOUT_SECONDS,
  needsMigration,
  parseStoredPin,
  recordFailure,
  type Digest,
} from './pin-security.ts';

const digest: Digest = async (data) => new Uint8Array(createHash('sha256').update(data).digest());
const salt = new Uint8Array(16).map((_, i) => i + 1);

describe('lockout schedule', () => {
  it('does not lock before the 5th wrong attempt', () => {
    for (let n = 0; n < 5; n++) assert.equal(lockoutSecondsFor(n), 0);
  });
  it('escalates 30s, 1m, 5m, 15m, 30m and caps', () => {
    const at = [5, 10, 15, 20, 25, 30, 100].map(lockoutSecondsFor);
    assert.deepEqual(at, [30, 60, 300, 900, 1800, 1800, 1800]);
    assert.ok(at.every((s) => s <= MAX_LOCKOUT_SECONDS));
  });
  it('does not lock between blocks of 5', () => {
    assert.equal(lockoutSecondsFor(6), 0);
    assert.equal(lockoutSecondsFor(9), 0);
  });
  it('reports attempts remaining', () => {
    assert.equal(attemptsRemaining(0), 5);
    assert.equal(attemptsRemaining(1), 4);
    assert.equal(attemptsRemaining(4), 1);
    assert.equal(attemptsRemaining(5), 5);
  });
  it('recordFailure sets lockedUntil only on the 5th failure', () => {
    let s = { failedAttempts: 0, lockedUntil: 0 };
    for (let i = 0; i < 4; i++) s = recordFailure(s, 1000);
    assert.deepEqual(s, { failedAttempts: 4, lockedUntil: 0 });
    s = recordFailure(s, 1000);
    assert.deepEqual(s, { failedAttempts: 5, lockedUntil: 1000 + 30_000 });
  });
  it('lockRemainingMs handles expiry and clamps absurd timestamps', () => {
    assert.equal(lockRemainingMs(0, 5000), 0);
    assert.equal(lockRemainingMs(4000, 5000), 0);
    assert.equal(lockRemainingMs(15_000, 5000), 10_000);
    assert.equal(lockRemainingMs(5000 + 10 * 3600_000, 5000), MAX_LOCKOUT_SECONDS * 1000);
    assert.equal(lockRemainingMs(NaN, 5000), 0);
  });
  it('formats countdown', () => {
    assert.equal(formatCountdown(30), '0:30');
    assert.equal(formatCountdown(61), '1:01');
    assert.equal(formatCountdown(0.2), '0:01');
    assert.equal(formatCountdown(-3), '0:00');
  });
});

describe('stored format and migration', () => {
  it('detects legacy, none, v1 and invalid values', () => {
    assert.deepEqual(parseStoredPin(''), { kind: 'none' });
    assert.deepEqual(parseStoredPin(undefined), { kind: 'none' });
    assert.deepEqual(parseStoredPin(' 1234 '), { kind: 'legacy', pin: '1234' });
    assert.equal(parseStoredPin('12345').kind, 'invalid');
    assert.equal(parseStoredPin('abcd').kind, 'invalid');
    assert.equal(parseStoredPin('v1$500$zz$00').kind, 'invalid');
    assert.equal(parseStoredPin('v2$500$aa$' + 'a'.repeat(64)).kind, 'invalid');
  });
  it('flags only legacy values for migration', async () => {
    assert.equal(needsMigration('0042'), true);
    assert.equal(needsMigration(await createStoredPin('0042', salt, digest)), false);
    assert.equal(needsMigration(''), false);
  });
  it('round-trips a hashed PIN and never stores the plain PIN', async () => {
    const stored = await createStoredPin('4821', salt, digest);
    assert.match(stored, /^v1\$500\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    assert.ok(!stored.includes('4821'));
    const parsed = parseStoredPin(stored);
    assert.equal(parsed.kind, 'v1');
    assert.equal(await checkPinAgainst(parsed, '4821', digest), true);
    assert.equal(await checkPinAgainst(parsed, '4822', digest), false);
  });
  it('different salts give different hashes', async () => {
    const other = new Uint8Array(16).fill(9);
    assert.notEqual(await createStoredPin('4821', salt, digest), await createStoredPin('4821', other, digest));
  });
  it('legacy plain values still verify until upgraded', async () => {
    const legacy = parseStoredPin('7788');
    assert.equal(await checkPinAgainst(legacy, '7788', digest), true);
    assert.equal(await checkPinAgainst(legacy, '7789', digest), false);
    assert.equal(await checkPinAgainst({ kind: 'invalid' }, '7788', digest), false);
  });
  it('constantTimeEqual compares correctly', () => {
    assert.equal(constantTimeEqual('abc', 'abc'), true);
    assert.equal(constantTimeEqual('abc', 'abd'), false);
    assert.equal(constantTimeEqual('abc', 'abcd'), false);
  });
});
