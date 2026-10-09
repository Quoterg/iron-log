import { describe, expect, it } from 'vitest';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import { recipeNutrition, recipeToFood, type Recipe } from './recipes';

function food(ref: string, values: Record<string, number>): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  for (const [k, x] of Object.entries(values)) v[NUTRIENT_INDEX[k]] = x;
  return { ref, sv: ref, en: null, per100g: v };
}

const oats = food('slv:oats', { kcal: 375, protein: 10, fibre: 10 });
const milk = food('slv:milk', { kcal: 60, protein: 3.5, calcium: 120 });
const foods = new Map([oats, milk].map((f) => [f.ref, f]));
const k = (key: string) => NUTRIENT_INDEX[key];

describe('recipes', () => {
  // Porridge: 100 g oats + 400 g milk, 2 servings.
  const r = { ingredients: [{ foodRef: 'slv:oats', grams: 100 }, { foodRef: 'slv:milk', grams: 400 }], servings: 2 };

  it('sums ingredients and divides by raw weight when no cooked weight is given', () => {
    const n = recipeNutrition(r, foods);
    expect(n.rawG).toBe(500);
    expect(n.total[k('kcal')]).toBe(615); // 375 + 240
    expect(n.per100g[k('kcal')]).toBe(123);
    expect(n.portionG).toBe(250);
    expect(n.per100g[k('calcium')]).toBe(96); // 480 mg / 500 g
    expect(n.per100g[k('iron')]).toBeNull(); // no ingredient has iron data
  });

  it('uses the cooked weight for per-100 g (water loss concentrates nutrients)', () => {
    const n = recipeNutrition({ ...r, cookedWeightG: 410 }, foods);
    expect(n.totalG).toBe(410);
    expect(n.per100g[k('kcal')]).toBe(150);
    expect(n.portionG).toBe(205);
    // A portion has the same energy either way: half the recipe.
    expect(((n.per100g[k('kcal')] ?? 0) * n.portionG) / 100).toBeCloseTo(307.5, 2);
  });

  it('reports ingredients that cannot be resolved', () => {
    const n = recipeNutrition({ ...r, ingredients: [...r.ingredients, { foodRef: 'custom:gone', grams: 50 }] }, foods);
    expect(n.missing).toEqual(['custom:gone']);
  });

  it('becomes a loggable food with portion and whole-recipe measures', () => {
    const recipe: Recipe = { ref: 'recipe:1', name: 'Gröt', createdAt: 1, updatedAt: 1, ...r };
    const f = recipeToFood(recipe, recipeNutrition(recipe, foods));
    expect(f.units).toEqual([{ name: 'portion', g: 250 }, { name: 'helaReceptet', g: 500 }]);
    expect(f.sv).toBe('Gröt');
  });
});
