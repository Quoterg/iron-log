// Household measures: which ones a food has, and converting a chosen measure to grams.
import type { Entry, Usage } from './db';
import type { Food, Serving } from './nutrients';

export const GRAMS = 'g';

/** Built-in measures first, then the user's own (a user measure with the same name wins). */
export function servingsFor(food: Food, user: Serving[] = []): Serving[] {
  const names = new Set(user.map((s) => s.name));
  return [...(food.units ?? []).filter((s) => !names.has(s.name)), ...user];
}

/**
 * Starting unit/quantity for the amount picker: the entry being edited, else what the user
 * logged last time for this food, else 1 of the food's first measure, else 100 g.
 */
export function initialAmount(servings: Serving[], entry?: Entry, used?: Usage): { unit: string; qty: number } {
  const has = (u?: string) => !!u && servings.some((s) => s.name === u);
  if (entry) return has(entry.unit) && entry.qty ? { unit: entry.unit!, qty: entry.qty } : { unit: GRAMS, qty: entry.grams };
  if (used?.lastUsed) {
    return has(used.lastUnit) && used.lastQty ? { unit: used.lastUnit!, qty: used.lastQty } : { unit: GRAMS, qty: used.lastGrams };
  }
  return servings.length ? { unit: servings[0].name, qty: 1 } : { unit: GRAMS, qty: 100 };
}

/** Grams for `qty` of `unit` (NaN if the unit is unknown or qty invalid). */
export function toGrams(unit: string, qty: number, servings: Serving[]): number {
  if (!(qty > 0)) return NaN;
  if (unit === GRAMS) return qty;
  const s = servings.find((x) => x.name === unit);
  return s ? Math.round(qty * s.g * 10) / 10 : NaN;
}
