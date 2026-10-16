import * as Crypto from 'expo-crypto';

import {
  checkPinAgainst,
  createStoredPin,
  PIN_SALT_BYTES,
  type Digest,
  type StoredPin,
} from '@/utils/pin-security';

const sha256: Digest = async (data) =>
  new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data as Uint8Array<ArrayBuffer>));

/** Hash a PIN with a fresh random salt (v1 format). */
export async function hashPin(pin: string): Promise<string> {
  return createStoredPin(pin, Crypto.getRandomBytes(PIN_SALT_BYTES), sha256);
}

/** Constant-time check of an attempt against a parsed stored value. */
export function checkPin(stored: StoredPin, input: string): Promise<boolean> {
  return checkPinAgainst(stored, input, sha256);
}
