import type { Food } from './nutrients';

/** A data-file row → Food. Rows omit trailing unknown values; pad them back to `n` nutrients. */
export function rowToFood([ref, sv, en, ...per100g]: [string, string, string | null, ...(number | null)[]], n: number): Food {
  while (per100g.length < n) per100g.push(null);
  return { ref, sv, en, per100g };
}
