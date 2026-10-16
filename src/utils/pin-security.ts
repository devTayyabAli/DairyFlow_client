// Pure admin-PIN security logic (no React Native / Expo imports) so it can be unit tested
// with `node --experimental-strip-types --test`. The native digest and random-byte
// sources are injected by src/utils/pin-crypto.ts.
//
// Stored PIN format (self-describing):  v1$<rounds>$<saltHex>$<hashHex>
//   hash_0 = SHA-256(salt || pin)
//   hash_i = SHA-256(hash_{i-1} || salt || pin)            for i = 1 .. rounds-1
// Each round is one native digest call, so the round count is a trade-off between
// UX (the PIN is checked on every login) and cost for an attacker who copies the
// database file. The count is stored inside the value, so it can be raised later
// without breaking existing hashes. The real brute-force defence on the device is the
// persisted lockout below; the hash only protects the PIN at rest.

export const PIN_LENGTH = 4;
export const PIN_HASH_VERSION = 'v1';
export const PIN_HASH_ROUNDS = 500;
export const PIN_SALT_BYTES = 16;

// app_settings keys (none of these are watched by the sync triggers).
export const PIN_SETTING_KEY = 'admin_pin';
export const FAILED_ATTEMPTS_KEY = 'admin_pin_failed';
export const LOCKED_UNTIL_KEY = 'admin_pin_locked_until';

export const ATTEMPTS_PER_ROUND = 5;
// Lockout (seconds) after the 1st, 2nd, 3rd... block of 5 consecutive wrong PINs.
export const LOCKOUT_SCHEDULE_SECONDS = [30, 60, 300, 900, 1800];
export const MAX_LOCKOUT_SECONDS = 1800;

export type Digest = (data: Uint8Array) => Promise<Uint8Array>;

export type StoredPin =
  | { kind: 'none' }
  | { kind: 'legacy'; pin: string }
  | { kind: 'v1'; rounds: number; saltHex: string; hashHex: string }
  | { kind: 'invalid' };

const LEGACY_PIN_RE = /^\d{4}$/;
const HEX_RE = /^[0-9a-f]+$/;

export function isValidPin(pin: string): boolean {
  return LEGACY_PIN_RE.test(pin);
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function parseStoredPin(raw: string | null | undefined): StoredPin {
  const value = (raw ?? '').trim();
  if (!value) return { kind: 'none' };
  if (LEGACY_PIN_RE.test(value)) return { kind: 'legacy', pin: value };
  const parts = value.split('$');
  if (parts.length === 4 && parts[0] === PIN_HASH_VERSION) {
    const rounds = Number(parts[1]);
    const [, , saltHex, hashHex] = parts;
    if (
      Number.isInteger(rounds) &&
      rounds > 0 &&
      rounds <= 1_000_000 &&
      saltHex.length > 0 &&
      saltHex.length % 2 === 0 &&
      HEX_RE.test(saltHex) &&
      hashHex.length === 64 &&
      HEX_RE.test(hashHex)
    ) {
      return { kind: 'v1', rounds, saltHex, hashHex };
    }
  }
  return { kind: 'invalid' };
}

export function formatStoredPin(rounds: number, saltHex: string, hashHex: string): string {
  return `${PIN_HASH_VERSION}$${rounds}$${saltHex}$${hashHex}`;
}

/** True when a stored value is a plain 4-digit PIN that must be upgraded to a hash. */
export function needsMigration(raw: string | null | undefined): boolean {
  return parseStoredPin(raw).kind === 'legacy';
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

export async function derivePinHash(
  pin: string,
  saltHex: string,
  rounds: number,
  digest: Digest
): Promise<string> {
  const salt = hexToBytes(saltHex);
  const pinBytes = new Uint8Array(pin.length);
  for (let i = 0; i < pin.length; i++) pinBytes[i] = pin.charCodeAt(i) & 0xff;
  let h = await digest(concat(salt, pinBytes));
  for (let i = 1; i < rounds; i++) {
    h = await digest(concat(h, salt, pinBytes));
  }
  return bytesToHex(h);
}

/** Hash a new PIN with the given random salt bytes into the stored v1 format. */
export async function createStoredPin(pin: string, salt: Uint8Array, digest: Digest): Promise<string> {
  const saltHex = bytesToHex(salt);
  const hashHex = await derivePinHash(pin, saltHex, PIN_HASH_ROUNDS, digest);
  return formatStoredPin(PIN_HASH_ROUNDS, saltHex, hashHex);
}

/** Length-independent, early-exit-free string comparison. */
export function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Check a PIN attempt against a parsed stored value (legacy plain or v1 hash). */
export async function checkPinAgainst(stored: StoredPin, input: string, digest: Digest): Promise<boolean> {
  if (stored.kind === 'legacy') return constantTimeEqual(input, stored.pin);
  if (stored.kind === 'v1') {
    const candidate = await derivePinHash(input, stored.saltHex, stored.rounds, digest);
    return constantTimeEqual(candidate, stored.hashHex);
  }
  return false;
}

// ---- Lockout ---------------------------------------------------------------------

/** Lock duration (seconds) triggered by this failure count; 0 if it does not lock. */
export function lockoutSecondsFor(failedAttempts: number): number {
  if (failedAttempts <= 0 || failedAttempts % ATTEMPTS_PER_ROUND !== 0) return 0;
  const tier = failedAttempts / ATTEMPTS_PER_ROUND - 1;
  return LOCKOUT_SCHEDULE_SECONDS[Math.min(tier, LOCKOUT_SCHEDULE_SECONDS.length - 1)];
}

/** Wrong PINs still allowed before the next lockout. */
export function attemptsRemaining(failedAttempts: number): number {
  return ATTEMPTS_PER_ROUND - (Math.max(0, failedAttempts) % ATTEMPTS_PER_ROUND);
}

export interface LockState {
  failedAttempts: number;
  lockedUntil: number; // epoch ms, 0 = not locked
}

/** State after one more wrong PIN at time `now` (epoch ms). */
export function recordFailure(state: LockState, now: number): LockState {
  const failedAttempts = Math.max(0, state.failedAttempts) + 1;
  const seconds = lockoutSecondsFor(failedAttempts);
  return { failedAttempts, lockedUntil: seconds > 0 ? now + seconds * 1000 : state.lockedUntil };
}

/**
 * Milliseconds of lockout left. Clamped to the maximum lockout so a persisted
 * timestamp that is absurdly far in the future (clock rolled back, corrupt value)
 * can never lock the owner out for longer than the cap.
 */
export function lockRemainingMs(lockedUntil: number, now: number): number {
  if (!Number.isFinite(lockedUntil) || lockedUntil <= now) return 0;
  return Math.min(lockedUntil - now, MAX_LOCKOUT_SECONDS * 1000);
}

export function parseCounter(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** mm:ss countdown text. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
