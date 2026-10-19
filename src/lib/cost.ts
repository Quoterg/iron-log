// Food cost in the diary (M34): what an entry, a meal and a day cost, from the user's own prices
// (shopping list, M30) or the typical-price table (M33). Opt-in (settings.costs). Only this stub is
// in the first bundle: the prices and the arithmetic (cost-calc.ts) load after first paint, on
// demand; until then, and when off, nothing is shown.
import { signal } from '@preact/signals';
import type { CostCalc } from './cost-calc';

export type { Cost, CostCalc } from './cost-calc';

/** The loaded prices with their arithmetic; null until loaded. */
export const priceBook = signal<CostCalc | null>(null);

/** Keeps the book in step after a price was saved or removed (shopping list, price sheet). */
export function setOwnPrice(ref: string, krPerKg: number | null): void {
  if (priceBook.value) priceBook.value = priceBook.value.withOwn(ref, krPerKg);
}

let started = false;
/** Loads the prices once (own + typical), on demand; again after a failure (e.g. back online). */
export function ensurePriceBook(): void {
  if (started) return;
  started = true;
  import('./cost-calc')
    .then((m) => m.loadPriceBook())
    .then((b) => (priceBook.value = b))
    .catch(() => (started = false));
}
