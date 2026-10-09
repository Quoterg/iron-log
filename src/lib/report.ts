// Reports over a period: daily averages, nutrient gaps, top contributors, logging streak.
import { entryVector, type Entry } from './db';
import { type Food, NUTRIENT_INDEX, NUTRIENTS } from './nutrients';
import type { Target } from './targets';

/** Nutrient totals per logged day (date → vector in NUTRIENTS order). */
export function dailyTotals(entries: Entry[], foods: Map<string, Food>): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const e of entries) {
    const v = entryVector(e, foods);
    if (!v) continue;
    const day = out.get(e.date) ?? NUTRIENTS.map(() => 0);
    v.forEach((x, i) => (day[i] += ((x ?? 0) * e.grams) / 100));
    out.set(e.date, day);
  }
  return out;
}

/**
 * Which nutrients have at least one known (non-null) value among the entries. A nutrient no food
 * in the period reports (e.g. iodine for many USDA/custom foods) is unknown — not 0 % of target.
 */
/**
 * Per nutrient: the share of the period's energy (kcal; grams where energy is unknown) that comes
 * from foods reporting it. A low share means a total that's mostly missing data — e.g. amino acids
 * or vitamin K when most food is Swedish (Livsmedelsverket doesn't analyse them) — not a shortfall.
 */
export function coverage(entries: Entry[], foods: Map<string, Food>): number[] {
  const reported = NUTRIENTS.map(() => 0);
  let all = 0;
  const k = NUTRIENT_INDEX.kcal;
  for (const e of entries) {
    const v = entryVector(e, foods);
    if (!v) continue;
    const weight = v[k] != null ? (v[k]! * e.grams) / 100 : e.grams;
    all += weight;
    v.forEach((x, i) => x != null && (reported[i] += weight));
  }
  return reported.map((r) => (all ? r / all : 0));
}

/** Share of energy that must come from foods reporting a nutrient before a shortfall is listed. */
export const MIN_COVERAGE = 0.8;

export function knownNutrients(entries: Entry[], foods: Map<string, Food>): boolean[] {
  const known = NUTRIENTS.map(() => false);
  for (const e of entries) entryVector(e, foods)?.forEach((x, i) => x != null && (known[i] = true));
  return known;
}

/** Average per *logged* day — days without any entries aren't counted as zero intake. */
export function averagePerDay(days: Map<string, number[]>): number[] {
  const avg = NUTRIENTS.map(() => 0);
  if (!days.size) return avg;
  for (const v of days.values()) v.forEach((x, i) => (avg[i] += x));
  return avg.map((x) => x / days.size);
}

export interface Gap {
  key: string;
  /** Share of the target (min) or limit (max), e.g. 0.54 = 54 %. */
  ratio: number;
}

/**
 * Nutrients clearly below their target (< `below`, default 70 %) and above their upper limit,
 * worst first. Energy is left out (it has its own bar).
 */
export function gaps(
  amounts: number[],
  targets: Record<string, Target>,
  known?: boolean[],
  below = 0.7,
): { low: Gap[]; high: Gap[] } {
  const low: Gap[] = [];
  const high: Gap[] = [];
  NUTRIENTS.forEach((n, i) => {
    const t = targets[n.key];
    // Unknown nutrients (no food in the period reports them) are not gaps.
    if (!t || n.key === 'kcal' || known?.[i] === false) return;
    if (t.min && amounts[i] < t.min * below) low.push({ key: n.key, ratio: amounts[i] / t.min });
    if (t.max != null && amounts[i] > t.max) high.push({ key: n.key, ratio: amounts[i] / t.max });
  });
  low.sort((a, b) => a.ratio - b.ratio);
  high.sort((a, b) => b.ratio - a.ratio);
  return { low, high };
}

export interface Contributor {
  foodRef: string;
  amount: number;
  share: number;
}

/** Foods that contributed most of one nutrient over the entries (grouped by food), largest first. */
export function contributors(entries: Entry[], foods: Map<string, Food>, nutrientIndex: number, limit = 10): Contributor[] {
  const byFood = new Map<string, number>();
  let total = 0;
  for (const e of entries) {
    const x = entryVector(e, foods)?.[nutrientIndex];
    if (!x) continue;
    const amount = (x * e.grams) / 100;
    byFood.set(e.foodRef, (byFood.get(e.foodRef) ?? 0) + amount);
    total += amount;
  }
  return [...byFood]
    .map(([foodRef, amount]) => ({ foodRef, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

const DAY = 86_400_000;
const time = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

/**
 * Consecutive days with at least one entry, ending today — or yesterday, so a streak isn't shown
 * as broken in the morning before the first meal is logged.
 */
export function streak(loggedDates: Set<string>, today: string): number {
  let t = time(today);
  if (!loggedDates.has(today)) t -= DAY;
  let n = 0;
  while (loggedDates.has(new Date(t).toISOString().slice(0, 10))) {
    n++;
    t -= DAY;
  }
  return n;
}
