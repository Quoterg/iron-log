// Household measures: which ones a food has, and converting a chosen measure to grams.
import type { Entry, Usage } from './db';
import type { Food, Serving } from './nutrients';

export const GRAMS = 'g';

/** Built-in measures first, then the user's own (a user measure with the same name wins). */
export function servingsFor(food: Food, user: Serving[] = []): Serving[] {
  const names = new Set(user.map((s) => s.name));
  return [...(food.units ?? []).filter((s) => !names.has(s.name)), ...user];
}

/** How many recent amounts each food remembers (portion memory). */
export const AMOUNT_MEMORY = 8;

export interface LoggedAmount {
  grams: number;
  unit?: string;
  qty?: number;
}

/** Remember an amount: newest last, at most AMOUNT_MEMORY. */
export function rememberAmount(list: LoggedAmount[] | undefined, a: LoggedAmount): LoggedAmount[] {
  return [...(list ?? []), a].slice(-AMOUNT_MEMORY);
}

/**
 * The amount the user usually logs: the most frequent of the remembered ones (same measure and
 * quantity, or same grams), the most recent of equally frequent ones; else the last one.
 */
export function usualAmount(u: Usage): LoggedAmount {
  const last: LoggedAmount = u.lastUnit && u.lastQty ? { grams: u.lastGrams, unit: u.lastUnit, qty: u.lastQty } : { grams: u.lastGrams };
  const list = u.amounts ?? [];
  const key = (a: LoggedAmount) => (a.unit && a.qty ? `${a.unit}|${a.qty}` : `g|${a.grams}`);
  const counts = new Map<string, number>();
  let best: LoggedAmount | undefined;
  let bestN = 1;
  // Newest first, so a tie keeps the most recent amount.
  for (const a of [...list].reverse()) {
    const n = (counts.get(key(a)) ?? 0) + 1;
    counts.set(key(a), n);
    if (n > bestN) {
      best = a;
      bestN = n;
    }
  }
  return best ?? last;
}

/**
 * Starting unit/quantity for the amount picker: the entry being edited, else the amount the user
 * usually logs for this food, else 1 of the food's first measure, else 100 g.
 */
export function initialAmount(servings: Serving[], entry?: Entry, used?: Usage): { unit: string; qty: number } {
  const has = (u?: string) => !!u && servings.some((s) => s.name === u);
  if (entry) return has(entry.unit) && entry.qty ? { unit: entry.unit!, qty: entry.qty } : { unit: GRAMS, qty: entry.grams };
  if (used?.lastUsed) {
    const a = usualAmount(used);
    return has(a.unit) && a.qty ? { unit: a.unit!, qty: a.qty } : { unit: GRAMS, qty: a.grams };
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
