// Fruit in season (M40, opt-in): which fresh fruits are plentiful in Swedish shops this month — from
// where — and how much of them in a week would close the nutrient gaps the user chooses. The season
// table is built from official statistics (scripts/build-fruit.mjs: SCB imports, Eurostat trade,
// Jordbruksverket's Swedish harvests), updated twice a year. Loaded on demand (Nutrients, opt-in).
import SEASON from './fruit-season.json';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import type { Gap } from './report';
import type { Target } from './targets';

export interface Fruit {
  key: string;
  sv: string;
  en: string;
  food: string;
  /** Household portion: [measure, grams]. */
  unit: [string, number];
  /** Tonnes on the Swedish market per calendar month (0 = January). */
  t: number[];
  /** % Swedish / % from the rest of Europe, per month. */
  se: number[];
  eu: number[];
  /** Biggest origin per month (ISO code; "" = outside Europe, via a trade hub). */
  top: string[];
}

export const FRUITS = SEASON.fruits as Fruit[];
/** The statistics' months, e.g. "2023M08–2026M07". */
export const SEASON_PERIOD = SEASON.period;

/** How far the fruit may come from (owner's choice M40: Swedish, Swedish + Europe, anything). */
export type Reach = 'sweden' | 'europe' | 'any';
export const REACHES: Reach[] = ['sweden', 'europe', 'any'];

/** Less than this (tonnes a month, all of Sweden) is not "readily available". */
export const MIN_TONNES = 100;
/** In season: at least this share of the fruit's best month (from the allowed origins). */
const SEASON_SHARE = 0.4;
/**
 * …and the allowed origins a real part of what is in the shops (%): Swedish apples (~30 %) count,
 * a few pallets of bananas or mangoes sent on within Europe don't.
 */
const MIN_SHARE: Record<Reach, number> = { sweden: 20, europe: 30, any: 0 };

/** Tonnes per month from the origins `reach` allows. */
export function supply(f: Fruit, reach: Reach): number[] {
  return f.t.map((t, m) => (t * share(f, m, reach)) / 100);
}

/** % of the month's fruit from the origins `reach` allows. */
const share = (f: Fruit, m: number, reach: Reach) => (reach === 'any' ? 100 : reach === 'europe' ? f.se[m] + f.eu[m] : f.se[m]);

/**
 * Whether `f` is in season in `month` (0–11) for `reach`: plentiful against its own best month, and
 * enough of it. Steady fruit (bananas) is in season all year; a fruit with a southern-hemisphere
 * season too (kiwi from Chile in summer) is when `reach` allows it.
 */
export function inSeason(f: Fruit, month: number, reach: Reach): boolean {
  const s = supply(f, reach);
  return s[month] >= MIN_TONNES && s[month] >= Math.max(...s) * SEASON_SHARE && share(f, month, reach) >= MIN_SHARE[reach];
}

/** In season every month (bananas): "all year" rather than "in season now". */
export const allYear = (f: Fruit, reach: Reach) => Array.from({ length: 12 }, (_, m) => inSeason(f, m, reach)).every(Boolean);

/** Where most of it comes from this month: "SE", another country, or "" (further away, country unknown). */
export function mainOrigin(f: Fruit, month: number): string {
  return f.se[month] >= 50 ? 'SE' : f.top[month];
}

/**
 * Nutrients NNR 2023 notes many in the Nordic countries get too little of: they rank first among
 * equally large gaps (weight 1.3; others 1).
 */
const PRIORITY: Record<string, number> = { folate: 1.3, fibre: 1.3, potassium: 1.3, vitD: 1.3, iron: 1.3, iodine: 1.3 };

/** A gap fruit can help with: the weekly amount missing, and its rank weight. */
export interface Need {
  key: string;
  /** Missing per week (target − average per day) × 7. */
  weekly: number;
  weight: number;
}

/** What fruit is suggested for: vitamins, minerals and fibre (owner's choice M40) — not energy or macros. */
const GOAL_KEYS = new Set(NUTRIENTS.filter((n) => n.group === 'vitamin' || n.group === 'mineral' || n.key === 'fibre').map((n) => n.key));

/** Nutrient amount in one portion of a fruit's food. */
const perPortion = (food: Food, grams: number, key: string) => ((food.per100g[NUTRIENT_INDEX[key]] ?? 0) * grams) / 100;

/**
 * EU reference intakes (NRV, Regulation 1169/2011 Annex XIII), for "source of" below. Units as in
 * nutrients.json (µg or mg).
 */
const NRV: Record<string, number> = {
  vitA: 800, vitD: 5, vitE: 12, vitK: 75, vitC: 80, thiamin: 1.1, riboflavin: 1.4, niacin: 16, vitB6: 1.4, folate: 200,
  vitB12: 2.5, biotin: 50, pantothenic: 6, potassium: 2000, calcium: 800, phosphorus: 700, magnesium: 375, iron: 14,
  zinc: 10, copper: 1, manganese: 2, selenium: 55, iodine: 150,
};

/**
 * Whether a food is a source of a nutrient by the EU nutrition-claim rule (Regulation 1924/2006):
 * at least 15 % of the NRV per 100 g, fibre at least 3 g per 100 g. An official yardstick, not ours.
 */
export function isSource(food: Food, key: string): boolean {
  const v = food.per100g[NUTRIENT_INDEX[key]];
  if (v == null) return false;
  return key === 'fibre' ? v >= 3 : NRV[key] != null && v >= NRV[key] * 0.15;
}

/**
 * What fruit helps with at all: the vitamins, minerals and fibre at least one of the fruits is a source
 * of (from Livsmedelsverket's data: vitamin C, A, E, B6, folate, thiamin, potassium, fibre …; never D,
 * B12, iron, calcium or iodine). In nutrients.json order.
 */
export function fruitSpan(foods: Food[]): string[] {
  return NUTRIENTS.map((n) => n.key).filter((k) => GOAL_KEYS.has(k) && foods.some((f) => isSource(f, k)));
}

/** The fruits in `list` that are a source of `key`. */
export const sourcesOf = <T extends { food: Food }>(key: string, list: T[]): T[] => list.filter((x) => isSource(x.food, key));

/**
 * The gaps fruit can help with, most important first: the larger the shortfall the earlier (weighted
 * by PRIORITY). Only nutrients in the span of what fruit is a source of — vitamin D, B12 or iodine are
 * left to the other suggestions.
 */
export function fruitNeeds(low: Gap[], amounts: number[], targets: Record<string, Target>, span: string[]): Need[] {
  return low
    .filter((g) => span.includes(g.key) && targets[g.key]?.min)
    .map((g) => ({ g, weight: PRIORITY[g.key] ?? 1 }))
    .sort((a, b) => (1 - b.g.ratio) * b.weight - (1 - a.g.ratio) * a.weight)
    .map(({ g, weight }) => ({ key: g.key, weekly: Math.max(0, targets[g.key].min! - amounts[NUTRIENT_INDEX[g.key]]) * 7, weight }))
    .filter((n) => n.weekly > 0);
}

/** At most this much fruit in a week (about 250 g a day: half of the "500 g fruit and vegetables"). */
export const WEEK_MAX_G = 1750;
/** At most one portion of the same fruit a day, and a short shopping list. */
const MAX_PER_FRUIT = 7;
const MAX_KINDS = 4;
/** A portion closing less than 1 % of the (weighted) needs isn't worth adding. */
const MIN_GAIN = 0.01;

export interface PlanItem {
  fruit: Fruit;
  count: number;
  grams: number;
}

export interface Plan {
  items: PlanItem[];
  /** Share (0–1) of each chosen need the week's fruit covers. */
  covers: Record<string, number>;
  /** Stopped at WEEK_MAX_G with something still missing: fruit alone isn't enough. */
  capped: boolean;
}

/**
 * The week's fruit for the chosen needs, in whole portions: each step adds the portion that closes the
 * most of what is still missing (weighted by rank) per kcal — so a week of avocados doesn't win on
 * potassium alone — a little less for a fruit already on the list (variety), until the needs are met,
 * nothing helps any more, or WEEK_MAX_G is reached.
 */
export function weekPlan(needs: Need[], fruits: { fruit: Fruit; food: Food }[]): Plan {
  const left = new Map(needs.map((n) => [n.key, n.weekly]));
  const count = new Map<string, number>();
  let grams = 0;
  let capped = false;
  for (;;) {
    let best: { fruit: Fruit; food: Food; score: number } | null = null;
    let blocked = false;
    for (const c of fruits) {
      const n = count.get(c.fruit.key) ?? 0;
      if (n >= MAX_PER_FRUIT || (!n && count.size >= MAX_KINDS)) continue;
      const helps = needs.reduce((s, need) => s + (need.weight * Math.min(perPortion(c.food, c.fruit.unit[1], need.key), left.get(need.key)!)) / need.weekly, 0);
      const gain = helps / (1 + 0.15 * n);
      if (gain < MIN_GAIN) continue;
      // Per 100 kcal (at least 40 kcal a portion, so near-empty fruit doesn't win by default).
      const score = gain / Math.max(40, perPortion(c.food, c.fruit.unit[1], 'kcal')) * 100;
      if (grams + c.fruit.unit[1] > WEEK_MAX_G) blocked = true; // would help, but the week is full
      else if (!best || score > best.score) best = { ...c, score };
    }
    if (!best) {
      capped = blocked;
      break;
    }
    count.set(best.fruit.key, (count.get(best.fruit.key) ?? 0) + 1);
    grams += best.fruit.unit[1];
    for (const need of needs) left.set(need.key, Math.max(0, left.get(need.key)! - perPortion(best.food, best.fruit.unit[1], need.key)));
  }
  const items = fruits
    .filter((c) => count.has(c.fruit.key))
    .map((c) => ({ fruit: c.fruit, count: count.get(c.fruit.key)!, grams: count.get(c.fruit.key)! * c.fruit.unit[1] }))
    .sort((a, b) => b.count - a.count);
  const covers = Object.fromEntries(needs.map((n) => [n.key, 1 - left.get(n.key)! / n.weekly]));
  return { items, covers, capped };
}

/**
 * The goals chosen until the user picks: the most important needs (in `needs` order) that some fruit in
 * season is a source of and a week of it closes at least halfway on its own — fruit barely moves a large
 * potassium gap, so it shouldn't crowd out the vitamin C it closes easily. At most `n`. If none
 * qualifies, the one such need fruit covers best (not the most important: a plan closing 2 % of a gap
 * helps nobody); none if nothing in season is a source of any.
 */
export function defaultGoals(needs: Need[], fruits: { fruit: Fruit; food: Food }[], n = 3): Need[] {
  const covered = needs
    .filter((need) => sourcesOf(need.key, fruits).length)
    .map((need) => ({ need, c: weekPlan([need], fruits).covers[need.key] }));
  const closable = covered.filter((x) => x.c >= 0.5).map((x) => x.need);
  if (closable.length) return closable.slice(0, n);
  const best = covered.reduce<(typeof covered)[number] | null>((b, x) => (!b || x.c > b.c ? x : b), null);
  return best ? [best.need] : [];
}

/** A chosen goal the week's fruit covers less than this much: say that fruit helps only a little. */
export const LITTLE = 0.25;

/** The user's gaps fruit is suggested for at all (vitamins, minerals, fibre with a target), most short first. */
export const goalGaps = (low: Gap[], targets: Record<string, Target>): Gap[] => low.filter((g) => GOAL_KEYS.has(g.key) && targets[g.key]?.min);

/**
 * For a goal no fruit in season from `reach` is a source of: the narrowest wider choice with such fruit
 * this month, and which (Swedish apples in October are no source of vitamin A or folate; Spanish
 * persimmons and Dutch raspberries are of folate). Null if none this month.
 */
export function widerSource<T extends { food: Food }>(reach: Reach, key: string, inSeasonFor: (r: Reach) => T[]): { reach: Reach; fruits: T[] } | null {
  for (const r of REACHES.slice(REACHES.indexOf(reach) + 1)) {
    const fruits = sourcesOf(key, inSeasonFor(r));
    if (fruits.length) return { reach: r, fruits };
  }
  return null;
}

/**
 * When a source of `key` is in season, if none is now: the fruits in `all` that are a source of it and
 * the months (0–11) any of them is in season for `reach` — or, if never from there, from anywhere.
 */
export function sourceSeason<T extends { fruit: Fruit; food: Food }>(key: string, all: T[], reach: Reach): { fruits: T[]; months: number[]; reach: Reach } | null {
  const sources = sourcesOf(key, all);
  for (const r of [reach, 'any'] as Reach[]) {
    const months = Array.from({ length: 12 }, (_, m) => m).filter((m) => sources.some((x) => inSeason(x.fruit, m, r)));
    if (months.length) return { fruits: sources.filter((x) => months.some((m) => inSeason(x.fruit, m, r))), months, reach: r };
  }
  return null;
}

/** Runs of consecutive months, wrapping around the year: [10, 11, 0, 1, 4] → [[10, 1], [4, 4]]. */
export function monthRuns(months: number[]): [number, number][] {
  const on = new Set(months);
  if (on.size === 12) return [[0, 11]];
  if (!on.size) return [];
  const runs: [number, number][] = [];
  const gap = [...Array(12).keys()].find((m) => !on.has(m))!; // start after a gap, so a run over New Year stays whole
  for (let i = 1; i <= 12; i++) {
    const m = (gap + i) % 12;
    if (!on.has(m)) continue;
    const last = runs.at(-1);
    if (last && (last[1] + 1) % 12 === m) last[1] = m;
    else runs.push([m, m]);
  }
  return runs;
}
