// The diary's food cost arithmetic and price loading (M34), split from cost.ts so none of it is in
// the first bundle: own prices from the device, typical ones from the table (M33), own ones win.
import { listPrices } from './db';
import { fmt, t } from './i18n';
import { typicalPrices } from './typical-prices';

export interface Cost {
  kr: number;
  /** Some of it has no price (a recipe's ingredient, an entry of the meal): "at least". */
  partial: boolean;
}

interface CostedRecipe {
  totalG: number;
  ingredients: { foodRef: string; grams: number }[];
}

export interface CostCalc {
  own: Map<string, number>;
  typical: Map<string, number>;
  /** An entry's cost: its food's price, or a recipe's ingredients scaled to the amount eaten. */
  entryCost(e: { foodRef: string; grams: number }, recipe?: CostedRecipe): Cost | null;
  /** The sum of costs; "at least" when any part is partial or has no price; null when none has one. */
  sum(costs: (Cost | null)[]): Cost | null;
  /** "~4 kr" (to the half krona below 10 kr, a tenth below 1 kr); "minst ~23 kr" when part has no price. */
  text(c: Cost): string;
  /** Whether a cost is worth showing (MIN_SHOWN_KR). */
  shown(c: Cost | null): c is Cost;
  /** A new book with this food's own price set (or removed: null). */
  withOwn(ref: string, krPerKg: number | null): CostCalc;
}

export function sumCost(costs: (Cost | null)[]): Cost | null {
  const priced = costs.filter((c) => c) as Cost[];
  return priced.length ? { kr: priced.reduce((s, c) => s + c.kr, 0), partial: priced.length < costs.length || priced.some((c) => c.partial) } : null;
}

/** Below this an entry shows no cost (a pinch of salt is not "~0 kr"); it still counts in sums. */
export const MIN_SHOWN_KR = 0.05;

export const roundKr = (kr: number): number => (kr >= 10 ? Math.round(kr) : kr >= 1 ? Math.round(kr * 2) / 2 : Math.round(kr * 10) / 10);

function costText(c: Cost): string {
  const kr = `~${fmt(roundKr(c.kr), 1)} kr`;
  return c.partial ? t('costMin').replace('{kr}', kr) : kr;
}

export function priceCalc(own: Map<string, number>, typical: Map<string, number>): CostCalc {
  const krPerKg = (ref: string) => own.get(ref) ?? typical.get(ref);
  return {
    own,
    typical,
    entryCost(e, recipe) {
      const p = krPerKg(e.foodRef);
      if (p != null) return { kr: (p * e.grams) / 1000, partial: false };
      if (!recipe || !(recipe.totalG > 0)) return null;
      let kr = 0;
      let priced = 0;
      for (const i of recipe.ingredients) {
        const q = krPerKg(i.foodRef);
        if (q != null) {
          kr += (q * i.grams) / 1000;
          priced++;
        }
      }
      return priced ? { kr: (kr * e.grams) / recipe.totalG, partial: priced < recipe.ingredients.length } : null;
    },
    sum: sumCost,
    text: costText,
    shown: (c): c is Cost => !!c && c.kr >= MIN_SHOWN_KR,
    withOwn(ref, k) {
      const next = new Map(own);
      if (k == null) next.delete(ref);
      else next.set(ref, k);
      return priceCalc(next, typical);
    },
  };
}

export async function loadPriceBook(): Promise<CostCalc> {
  const [own, typical] = await Promise.all([listPrices(), typicalPrices().catch(() => new Map<string, number>())]);
  return priceCalc(new Map(own.map((p) => [p.foodRef, p.krPerKg])), typical);
}
