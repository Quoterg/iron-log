// Recipes: foods made from other foods. Nutrients per 100 g are computed from the ingredients
// and the finished weight (cooking changes weight through water loss or uptake).
import { NUTRIENTS, type Food, type NutrientVector } from './nutrients';

export interface Ingredient {
  foodRef: string;
  grams: number;
  /** The household measure it was entered in (display only; grams is the source of truth). */
  unit?: string;
  qty?: number;
  /**
   * The food's per-100 g values when the recipe was last saved. Used when the food itself can't be
   * resolved (e.g. a deleted custom food or a product not cached), so an ingredient never silently
   * drops out of the recipe.
   */
  per100g?: NutrientVector;
}

export interface Recipe {
  /** `recipe:<uuid>` */
  ref: string;
  name: string;
  ingredients: Ingredient[];
  /** Number of portions the recipe makes (≥ 1). */
  servings: number;
  /** Weight of the finished dish in grams, if weighed; else the sum of the ingredients. */
  cookedWeightG?: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** A recipe as stored: with a snapshot of its computed nutrition, so it can be shown and logged
 * without resolving every ingredient (the food database loads after the first screen). */
export interface StoredRecipe extends Recipe {
  per100g: NutrientVector;
  portionG: number;
  totalG: number;
}

export interface RecipeNutrition {
  /** Sum of raw ingredient weights. */
  rawG: number;
  /** Finished weight used for per-100 g values. */
  totalG: number;
  portionG: number;
  /** Totals for the whole recipe, in NUTRIENTS order. */
  total: number[];
  per100g: NutrientVector;
  /** Ingredients whose food could not be resolved (left out of the totals). */
  missing: string[];
}

/**
 * Nutrition of a recipe. A nutrient is unknown (null) per 100 g only when no ingredient has a
 * value for it; otherwise unknown values count as 0, like the day totals.
 */
export function recipeNutrition(
  r: Pick<Recipe, 'ingredients' | 'servings' | 'cookedWeightG'>,
  foods: Map<string, Food>,
): RecipeNutrition {
  const total = NUTRIENTS.map(() => 0);
  const known = NUTRIENTS.map(() => false);
  const missing: string[] = [];
  let rawG = 0;
  for (const ing of r.ingredients) {
    rawG += ing.grams;
    // Prefer the live food (picks up corrections on re-save), else the saved snapshot.
    const per100g = foods.get(ing.foodRef)?.per100g ?? ing.per100g;
    if (!per100g) {
      missing.push(ing.foodRef);
      continue;
    }
    per100g.forEach((v, i) => {
      if (v == null) return;
      known[i] = true;
      total[i] += (v * ing.grams) / 100;
    });
  }
  const totalG = r.cookedWeightG && r.cookedWeightG > 0 ? r.cookedWeightG : rawG;
  const per100g = total.map((v, i) => (known[i] && totalG > 0 ? round((v / totalG) * 100) : null));
  return { rawG, totalG, portionG: totalG / Math.max(1, r.servings), total, per100g, missing };
}

/** The recipe as a loggable food: per-100 g values plus "portion" (and "hela receptet") measures. */
export function recipeToFood(r: Recipe, n: Pick<RecipeNutrition, 'per100g' | 'portionG' | 'totalG'>): Food {
  return {
    ref: r.ref,
    sv: r.name,
    en: null, // the user's own name, shown as typed in both languages
    per100g: n.per100g,
    units: [
      { name: 'portion', g: Math.round(n.portionG * 10) / 10 },
      { name: 'helaReceptet', g: Math.round(n.totalG * 10) / 10 },
    ],
  };
}

function round(x: number) {
  return x === 0 ? 0 : Number(x.toPrecision(6));
}

/** Pad a nutrient vector from an older version (fewer nutrients) with unknowns. */
export function padVector(v: NutrientVector): NutrientVector {
  return v.length >= NUTRIENTS.length ? v : [...v, ...NUTRIENTS.map(() => null)].slice(0, NUTRIENTS.length);
}

/**
 * A logged amount of a recipe as its ingredients (M50, "Dela upp i ingredienser"): each scaled by the
 * share of the finished dish eaten (`grams / totalG`; totalG is the cooked weight when weighed). A
 * household measure scales with it. Ingredients that would round to nothing are left out.
 */
export function splitRecipe(grams: number, r: Pick<StoredRecipe, 'ingredients' | 'totalG'>): Ingredient[] {
  if (!(r.totalG > 0) || !(grams > 0)) return [];
  const share = grams / r.totalG;
  return r.ingredients.flatMap((i) => {
    const g = Math.round(i.grams * share * 10) / 10;
    if (!(g > 0)) return [];
    const qty = i.unit && i.qty ? Math.round(i.qty * share * 100) / 100 : 0;
    return [qty > 0 ? { foodRef: i.foodRef, grams: g, unit: i.unit, qty } : { foodRef: i.foodRef, grams: g }];
  });
}

/**
 * Whether a recipe's values changed since an entry was logged (its `snap`, M50 review): splitting
 * then uses today's ingredients, so that meal's values change. Compared to 0.1 % (rounding).
 */
export function changedSince(snap: (number | null)[] | undefined, now: (number | null)[]): boolean {
  if (!snap) return false;
  return now.some((v, i) => {
    const a = snap[i] ?? null;
    if (a === null || v === null) return a !== v;
    return Math.abs(a - v) > 0.001 * Math.max(Math.abs(a), Math.abs(v), 1e-9);
  });
}
