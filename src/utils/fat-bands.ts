/**
 * Admin fat-rate table.
 *
 * A band is a closed range: minFat <= fat <= maxFat, and
 * effectiveFrom <= collection date <= effectiveTo (or no end date).
 * Both ends are inclusive, so two bands that touch on one fat point overlap
 * and cannot both be active on the same dates. Example: 3.0–4.0 and 4.0–5.0
 * conflict at 4.0. Use 3.0–3.9 and 4.0–4.9 when 4.0 should belong to the higher band.
 *
 * A fat value in a gap matches nothing. The app does not invent a rate.
 * More than one match is refused as ambiguous.
 * Deactivating a band or changing its rate never rewrites milk rows.
 * A saved entry keeps the rate and band id it was given.
 *
 * lineAmount is copied from money.ts so this file can run under Node's test
 * runner, which cannot resolve an extensionless import.
 */
function lineAmount(liters: number, ratePerLiter: number): number {
  if (!Number.isFinite(liters) || !Number.isFinite(ratePerLiter)) return 0;
  return Math.round(liters * ratePerLiter * 100) / 100;
}

export interface FatBand {
  uuid: string;
  minFat: number;
  maxFat: number;
  ratePerLiter: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  active: boolean;
  label?: string | null;
}

export type QuoteResult =
  | { ok: true; band: FatBand; rate: number; amount: number }
  | { ok: false; reason: 'none' | 'ambiguous' | 'invalid' };

const OPEN_END = '9999-12-31';

export function rangesOverlap(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 <= b1 && b0 <= a1;
}

export function datesOverlap(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null
): boolean {
  return aFrom <= (bTo ?? OPEN_END) && bFrom <= (aTo ?? OPEN_END);
}

export function bandConflicts(candidate: FatBand, others: FatBand[]): boolean {
  if (!candidate.active) return false;
  if (candidate.minFat > candidate.maxFat) return true;
  if (candidate.effectiveTo && candidate.effectiveFrom > candidate.effectiveTo) return true;
  return others.some(
    (other) =>
      other.uuid !== candidate.uuid &&
      other.active &&
      rangesOverlap(candidate.minFat, candidate.maxFat, other.minFat, other.maxFat) &&
      datesOverlap(candidate.effectiveFrom, candidate.effectiveTo, other.effectiveFrom, other.effectiveTo)
  );
}

export function quoteCollection(
  bands: FatBand[],
  date: string,
  fat: number,
  liters: number
): QuoteResult {
  if (!Number.isFinite(fat) || fat <= 0 || fat > 15) return { ok: false, reason: 'invalid' };
  if (!Number.isFinite(liters) || liters <= 0) return { ok: false, reason: 'invalid' };
  const matches = bands.filter(
    (band) =>
      band.active &&
      fat >= band.minFat &&
      fat <= band.maxFat &&
      date >= band.effectiveFrom &&
      date <= (band.effectiveTo ?? OPEN_END)
  );
  if (matches.length === 0) return { ok: false, reason: 'none' };
  if (matches.length > 1) return { ok: false, reason: 'ambiguous' };
  const band = matches[0];
  return { ok: true, band, rate: band.ratePerLiter, amount: lineAmount(liters, band.ratePerLiter) };
}
