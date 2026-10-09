import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

// No Web Workers in Node: a stand-in food worker that knows no foods.
(globalThis as { Worker?: unknown }).Worker = class {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage(msg: { id: number; type: string }) {
    if (msg.type === 'search' || msg.type === 'get') queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, foods: [] } }));
  }
};
(globalThis as { document?: unknown }).document ??= { baseURI: 'http://localhost/' };
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';

function food(ref: string, kcal: number): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  v[NUTRIENT_INDEX.kcal] = kcal;
  return { ref, sv: ref, en: null, per100g: v };
}

describe('recipes in state and storage', () => {
  it('logging a recipe keeps its values; editing the recipe only affects new entries', async () => {
    const state = await import('../state');
    const db = await import('./db');
    // Ingredient foods already known (no worker in tests).
    state.foods.value = new Map([['slv:a', food('slv:a', 400)], ['slv:b', food('slv:b', 50)]]);

    const ref = await state.saveRecipe({
      name: 'Gröt',
      servings: 2,
      ingredients: [{ foodRef: 'slv:a', grams: 100 }, { foodRef: 'slv:b', grams: 300 }],
    });
    const stored = (await db.listRecipes()).find((r) => r.ref === ref)!;
    // Ingredients carry a snapshot of their values.
    expect(stored.ingredients[0].per100g?.[NUTRIENT_INDEX.kcal]).toBe(400);

    const asFood = state.foods.value.get(ref)!;
    await state.addEntry('lunch', asFood, { grams: 200, unit: 'portion', qty: 1 });
    const kcal = () => state.dayTotals.value[NUTRIENT_INDEX.kcal];
    expect(kcal()).toBe(275); // (400 + 150) / 400 g × 200 g

    // Double the oats: the logged day must not change.
    await state.saveRecipe({ ...stored, ingredients: [{ foodRef: 'slv:a', grams: 200 }, { foodRef: 'slv:b', grams: 300 }] });
    expect(kcal()).toBe(275);
    const entries = await db.entriesFor(state.date.value);
    expect(entries[0].snap?.[NUTRIENT_INDEX.kcal]).toBe(137.5);

    // Deleted recipes still resolve for the diary.
    await state.deleteRecipe(ref);
    expect(state.foods.value.get(ref)?.sv).toBe('Gröt');
  });

  it('an ingredient whose food is gone still counts via its snapshot; without one, saving is refused', async () => {
    const state = await import('../state');
    state.foods.value = new Map([['slv:a', food('slv:a', 400)]]);
    const ok = await state.saveRecipe({
      name: 'Med snapshot',
      servings: 1,
      ingredients: [{ foodRef: 'custom:gone', grams: 100, per100g: food('x', 200).per100g }, { foodRef: 'slv:a', grams: 100 }],
    });
    expect(state.foods.value.get(ok)?.per100g[NUTRIENT_INDEX.kcal]).toBe(300);
    await expect(
      state.saveRecipe({ name: 'Utan', servings: 1, ingredients: [{ foodRef: 'custom:unknown', grams: 100 }] }),
    ).rejects.toThrow(/without data/);
  });

  it('import keeps the newer version of a recipe', async () => {
    const db = await import('./db');
    const base = { ref: 'recipe:imp', name: 'Ny', ingredients: [], servings: 1, createdAt: 1, per100g: [], portionG: 1, totalG: 1 };
    await db.putRecipe({ ...base, updatedAt: 10 });
    const empty = { entries: [], customFoods: [], usage: [], servings: [], offFoods: [], body: [] };
    await db.importAll({ ...empty, recipes: [{ ...base, name: 'Gammal', updatedAt: 5 }] });
    expect((await db.listRecipes()).find((r) => r.ref === 'recipe:imp')?.name).toBe('Ny');
    await db.importAll({ ...empty, recipes: [{ ...base, name: 'Nyare', updatedAt: 20 }] });
    expect((await db.listRecipes()).find((r) => r.ref === 'recipe:imp')?.name).toBe('Nyare');
  });
});
