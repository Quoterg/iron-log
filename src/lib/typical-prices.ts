// Typical Swedish prices per food (M33): kr/kg for Livsmedelsverket's foods, built by
// scripts/build-prices.mjs (shelf prices moved by SCB's price index; updated twice a year). Loaded
// only when the user turned food costs on, from a content-hashed file the service worker caches.
import PRICES from './prices.json';

/** The month the prices are for ("2026M08") and when the shelf prices were collected. */
export const TYPICAL_MONTH: string = PRICES.month;
export const TYPICAL_COLLECTED: string = PRICES.collected;

/** SCB's month key as a date-like label: "2026M08" → "2026-08". */
export const fmtMonth = (m: string): string => m.replace(/^(\d{4})M(\d{2})$/, '$1-$2');

let loading: Promise<Map<string, number>> | undefined;

/** kr per kg by food ref; fetched once (and again after a failure, e.g. back online). */
export function typicalPrices(): Promise<Map<string, number>> {
  loading ??= fetch(new URL(`data/${PRICES.file}`, document.baseURI).href)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ foods: Record<string, number> }>;
    })
    .then((d) => new Map(Object.entries(d.foods)));
  loading.catch(() => (loading = undefined));
  return loading;
}
