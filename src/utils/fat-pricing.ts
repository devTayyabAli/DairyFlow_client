/**
 * Fat-based milk pricing: the price per liter follows the fat percentage.
 *
 * The admin sets one anchor ("Rs 180 per liter at 6% fat") and optionally how much the rate moves
 * per 1% fat. With no explicit step the rate is proportional to fat, so 180 at 6% means Rs 30 per
 * fat point: 5% fat is Rs 150, 7% is Rs 210.
 *
 * Pure module (no React Native imports) so it can be unit-tested with plain Node.
 */

export const FAT_PRICING_ENABLED_KEY = 'fat_pricing_enabled';
export const FAT_PRICING_REFERENCE_FAT_KEY = 'fat_pricing_reference_fat';
export const FAT_PRICING_SLOPE_KEY = 'fat_pricing_slope';

export const DEFAULT_REFERENCE_FAT = 6;

export interface FatPricing {
  /** When false the rate is the flat default rate regardless of fat. */
  enabled: boolean;
  /** Rate per liter at `referenceFat` (the app's existing "default milk rate"). */
  baseRate: number;
  /** Fat % that `baseRate` is quoted for. */
  referenceFat: number;
  /** Rs change per 1% fat; null means proportional (baseRate / referenceFat). */
  slopePerPoint: number | null;
}

export interface RawFatPricingSettings {
  enabled?: string | null;
  baseRate?: string | null;
  referenceFat?: string | null;
  slope?: string | null;
}

const toNumber = (value: string | null | undefined): number => {
  const n = Number.parseFloat((value ?? '').trim());
  return Number.isFinite(n) ? n : Number.NaN;
};

/** Builds a pricing config from the stored settings, tolerating blanks and bad values. */
export function parseFatPricing(raw: RawFatPricingSettings): FatPricing {
  const baseRate = toNumber(raw.baseRate);
  const referenceFat = toNumber(raw.referenceFat);
  const slope = toNumber(raw.slope);

  const validBase = baseRate > 0 ? baseRate : 0;
  const validRef = referenceFat > 0 ? referenceFat : DEFAULT_REFERENCE_FAT;
  const wantsIt = (raw.enabled ?? '').trim() === '1';

  return {
    // Without a usable rate there is nothing to scale, so fall back to flat pricing.
    enabled: wantsIt && validBase > 0,
    baseRate: validBase,
    referenceFat: validRef,
    slopePerPoint: Number.isFinite(slope) && slope > 0 ? slope : null,
  };
}

/** Rs per fat point actually used (explicit step, or proportional to the anchor). */
export function effectiveSlope(pricing: FatPricing): number {
  return pricing.slopePerPoint ?? pricing.baseRate / pricing.referenceFat;
}

/** Rate per liter for a given fat %. Never negative; rounded to 2 decimals. */
export function rateForFat(pricing: FatPricing, fat: number): number {
  if (!pricing.enabled || !Number.isFinite(fat) || fat < 0) return pricing.baseRate;
  const rate = pricing.baseRate + (fat - pricing.referenceFat) * effectiveSlope(pricing);
  return Math.round(Math.max(0, rate) * 100) / 100;
}

/** "150", "142.5", "141.25": trims trailing zeros so rates read like prices, not decimals. */
export function formatRate(rate: number): string {
  const n = Number.isFinite(rate) ? rate : 0;
  return String(Number(n.toFixed(2)));
}

export interface SupplierPricingConfig {
  rate_type: 'flat' | 'fat_based';
  flat_rate?: number | null;
  base_fat?: number | null;
  rate_per_fat_point?: number | null;
}

/**
 * Calculates rate per liter for milk collection from a supplier.
 */
export function calculateSupplierRate(
  supplier: SupplierPricingConfig,
  fatPercentage: number,
  fallbackRate: number = 200
): number {
  if (supplier.rate_type === 'flat') {
    return supplier.flat_rate && supplier.flat_rate > 0 ? supplier.flat_rate : fallbackRate;
  }

  const fat = Number.isFinite(fatPercentage) && fatPercentage >= 0 ? fatPercentage : 0;
  if (supplier.rate_per_fat_point && supplier.rate_per_fat_point > 0) {
    const rate = fat * supplier.rate_per_fat_point;
    return Math.round(rate * 100) / 100;
  }

  const baseFat = supplier.base_fat && supplier.base_fat > 0 ? supplier.base_fat : 6.0;
  const baseRate = supplier.flat_rate && supplier.flat_rate > 0 ? supplier.flat_rate : fallbackRate;
  const rate = (fat / baseFat) * baseRate;
  return Math.round(rate * 100) / 100;
}

