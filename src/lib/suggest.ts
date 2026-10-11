// Gap fixer & swaps (M27, opt-in): foods that help with nutrients the user is short on, and swaps
// for foods they log often. Information within NNR targets, never doses or medical claims.
// Loaded on demand (Nutrients with suggestions on).
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import type { Target } from './targets';

/** A food that could help: its usual portion and how much of the daily gap that portion covers. */
export interface GapFood {
  ref: string;
  portionG: number;
  /** Share of the gap one portion covers (0–1, capped at 1). */
  covers: number;
  /** The user already eats it. */
  own: boolean;
}

export interface Candidate {
  food: Food;
  portionG: number;
  own: boolean;
}

/** Nutrient per kcal: how efficiently a food fills a gap (a few kcal minimum, so water-light foods don't win by default). */
export function density(food: Food, i: number): number {
  const v = food.per100g[i] ?? 0;
  const kcal = food.per100g[NUTRIENT_INDEX.kcal] ?? 0;
  return v / Math.max(kcal, 20);
}

/**
 * Up to `limit` foods for a gap of `gap` (amount per day) in nutrient `key`: the user's own foods
 * first, then others; each ranked by nutrient per kcal; only foods whose usual portion covers at
 * least 10 % of the gap.
 */
export function gapFoods(key: string, gap: number, candidates: Candidate[], limit = 3): GapFood[] {
  const i = NUTRIENT_INDEX[key];
  if (!(gap > 0) || i == null) return [];
  const seen = new Set<string>();
  const scored = candidates
    .filter((c) => !seen.has(c.food.ref) && seen.add(c.food.ref))
    .map((c) => ({ c, d: density(c.food, i), amount: ((c.food.per100g[i] ?? 0) * c.portionG) / 100 }))
    .filter((x) => x.amount >= gap * 0.1);
  scored.sort((a, b) => Number(b.c.own) - Number(a.c.own) || b.d - a.d);
  return scored.slice(0, limit).map(({ c, amount }) => ({ ref: c.food.ref, portionG: c.portionG, covers: Math.min(1, amount / gap), own: c.own }));
}

/**
 * Swaps for common Swedish staples (Livsmedelsverket): a food name pattern → a better alternative.
 * Shown only when the alternative is measurably better at the same weight (see swapFor).
 */
export const SWAPS: [pattern: RegExp, to: string][] = [
  [/^Bröd vitt(?!.*fullkorn)/, 'slv:213'], // → Bröd fullkorn råg
  [/^Ris (jasmin|långkornigt)( parboiled)? kokt/, 'slv:2517'], // → råris kokt
  [/^Ris (jasmin|långkornigt)( parboiled)? okokt/, 'slv:2478'], // → råris okokt
  [/^Pasta okokt$/, 'slv:848'], // → pasta fullkorn okokt
  [/^Läsk( cola)?$/, 'slv:1949'], // → sodavatten
  [/^Apelsinjuice/, 'slv:551'], // → apelsin
  [/^Kvarg smaksatt m\. socker/, 'slv:3243'], // → kvarg naturell
];

/** Nutrients a swap may be judged on: more is better (has a minimum) or less is better (has a maximum). */
const MORE = ['fibre', 'wholegrain', 'iron', 'folate', 'magnesium', 'potassium', 'calcium', 'vitD'];
const LESS = ['addedSugar', 'satFat', 'salt'];

export interface Change {
  key: string;
  /** Per usual portion: positive = more. */
  delta: number;
}

export interface Swap {
  from: string;
  to: string;
  portionG: number;
  /** The biggest improvements (at most 2), each ≥ 5 % of its target. */
  changes: Change[];
}

/** The swap for a food, if one applies and is better at the same weight; `to` must be loaded. */
export function swapFor(from: Food, to: Food | undefined, portionG: number, targets: Record<string, Target>): Swap | null {
  const rule = SWAPS.find(([p]) => p.test(from.sv));
  if (!rule || !to || rule[1] !== to.ref || from.ref === to.ref) return null;
  const changes: (Change & { weight: number })[] = [];
  for (const key of [...MORE, ...LESS]) {
    const i = NUTRIENT_INDEX[key];
    const a = from.per100g[i];
    const b = to.per100g[i];
    if (a == null || b == null) continue; // unknown in either: no claim
    const delta = ((b - a) * portionG) / 100;
    const t = targets[key];
    const ref = MORE.includes(key) ? t?.min : t?.max;
    if (!ref) continue;
    const better = MORE.includes(key) ? delta > 0 : delta < 0;
    if (better && Math.abs(delta) >= ref * 0.05) changes.push({ key, delta, weight: Math.abs(delta) / ref });
  }
  if (!changes.length) return null;
  changes.sort((x, y) => y.weight - x.weight);
  return { from: from.ref, to: to.ref, portionG, changes: changes.slice(0, 2).map(({ key, delta }) => ({ key, delta })) };
}

/** The targets of the swap alternatives that may be needed, for loading them up front. */
export function swapTargets(foods: Food[]): string[] {
  return [...new Set(foods.flatMap((f) => SWAPS.filter(([p]) => p.test(f.sv)).map(([, to]) => to)))];
}

/** Unit of a nutrient (for display). */
export const unitOf = (key: string) => NUTRIENTS[NUTRIENT_INDEX[key]].unit;
