// Supplements are custom foods measured per unit (tablet, capsule, ml…). One unit is stored as
// weighing 1 g, so per-100 g values are the per-unit amounts × 100 and "1 tablett" = 1 g gives
// exactly the label's amounts — logging, totals, reports and backups need no special cases.
import type { NutrientVector, Serving } from './nutrients';

export interface SupplementInfo {
  /** What one unit is called, e.g. "tablett", "kapsel", "ml". */
  unit: string;
  /** Units per day for the daily checklist; 0 = taken as needed (not on the checklist). */
  perDay: number;
}

export const UNIT_GRAMS = 1;

export const perUnitToPer100g = (perUnit: NutrientVector): NutrientVector => perUnit.map((v) => (v == null ? null : v * 100));
export const per100gToPerUnit = (per100g: NutrientVector): NutrientVector => per100g.map((v) => (v == null ? null : v / 100));

export function supplementServings(s: SupplementInfo): Serving[] {
  return [{ name: s.unit, g: UNIT_GRAMS }];
}
