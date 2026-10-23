/**
 * Money is stored in rupees with 2 decimal places.
 * A line amount is Math.round(liters * rate * 100) / 100 (half away from zero).
 * The same formula is used on the phone and the server so a saved total does not drift.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function lineAmount(liters: number, ratePerLiter: number): number {
  if (!Number.isFinite(liters) || !Number.isFinite(ratePerLiter)) return 0;
  return Math.round(liters * ratePerLiter * 100) / 100;
}
