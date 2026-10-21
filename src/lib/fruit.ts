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
 * The gaps fruit can help with, most important first: the larger the shortfall the earlier (weighted
 * by PRIORITY). Only nutrients where some fruit in season gives ≥ 5 % of the daily target per portion —
 * fruit is no help for vitamin D, B12 or iodine, and those are left to the other suggestions.
 */
export function fruitNeeds(low: Gap[], amounts: number[], targets: Record<string, Target>, inSeasonFoods: { food: Food; grams: number }[]): Need[] {
  return low
    .filter((g) => {
      const min = GOAL_KEYS.has(g.key) && targets[g.key]?.min;
      return min && inSeasonFoods.some((x) => perPortion(x.food, x.grams, g.key) >= min * 0.05);
    })
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
 * The goals chosen until the user picks: the most important needs (in `needs` order) that a week of
 * fruit closes at least halfway on its own — fruit barely moves a large potassium gap, so it shouldn't
 * crowd out the vitamin C it closes easily. At most `n`; the most important need if none qualifies.
 */
export function defaultGoals(needs: Need[], fruits: { fruit: Fruit; food: Food }[], n = 3): Need[] {
  const closable = needs.filter((need) => weekPlan([need], fruits).covers[need.key] >= 0.5);
  return closable.length ? closable.slice(0, n) : needs.slice(0, 1);
}
