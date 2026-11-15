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

describe('undo (M64)', () => {
  it('brings removed entries back with their ids, in order, stored newer than their deletion', async () => {
    const state = await import('../state');
    const db = await import('./db');
    state.foods.value = new Map([['slv:oats', food('slv:oats', 370)], ['slv:milk', food('slv:milk', 40)]]);
    await state.loadDay('2026-11-01');
    await state.addEntry('breakfast', state.foods.value.get('slv:oats')!, { grams: 40 });
    await state.addEntry('breakfast', state.foods.value.get('slv:milk')!, { grams: 200 });
    const ids = state.entries.value.map((e) => e.id);

    const removed = await state.removeEntries(ids);
    expect(removed.entries.map((e) => e.id)).toEqual(ids);
    expect(await db.entriesFor('2026-11-01')).toEqual([]);

    await state.restoreEntries(removed);
    expect(state.entries.value.map((e) => e.id)).toEqual(ids);
    expect((await db.entriesFor('2026-11-01')).map((e) => e.id).sort()).toEqual([...ids].sort());
    // The change log says "present" again, so a paired device gets them back instead of the deletion.
    const raw = await (await import('idb')).openDB('iron-log');
    expect(await raw.get('meta', `entries:${ids[0]}`)).toMatchObject({ mt: expect.any(Number) });
    expect((await raw.get('meta', `entries:${ids[0]}`)).del).toBeUndefined();
    raw.close();
  });

  it('a removal undone from another day goes back to storage only', async () => {
    const state = await import('../state');
    const db = await import('./db');
    await state.loadDay('2026-11-02');
    await state.addEntry('lunch', state.foods.value.get('slv:oats')!, { grams: 50 });
    const removed = await state.removeEntries(state.entries.value.map((e) => e.id));
    await state.loadDay('2026-11-03');
    await state.restoreEntries(removed);
    expect(state.entries.value).toEqual([]);
    expect(await db.entriesFor('2026-11-02')).toHaveLength(1);
  });

  it('logging a saved meal offers to take it back', async () => {
    const state = await import('../state');
    (await import('./i18n')).lang.value = 'sv';
    await state.loadDay('2026-11-04');
    const n = await state.logTemplate('dinner', { id: 't1', name: 'Gröt', items: [{ foodRef: 'slv:oats', grams: 100 }, { foodRef: 'slv:milk', grams: 100 }], createdAt: 1, updatedAt: 1 });
    expect(n).toBe(2);
    const msg = state.toast.value!;
    expect(msg.text).toBe('Gröt tillagd: 2 livsmedel, 410 kcal');
    await msg.undo!();
    expect(state.entries.value).toEqual([]);
  });

  it('taking a saved meal back also takes back what it counted: food uses and the meal’s own rank', async () => {
    const state = await import('../state');
    const db = await import('./db');
    state.foods.value = new Map([...state.foods.value, ['slv:new', state.foods.value.get('slv:oats')!]]);
    await state.loadDay('2026-11-05');
    const usageBefore = new Map(state.usage.value);
    const useBefore = state.templateUse.value.t1;
    const meal = { id: 't1', name: 'Gröt', items: [{ foodRef: 'slv:oats', grams: 100 }, { foodRef: 'slv:new', grams: 50 }], createdAt: 1, updatedAt: 1 };
    await state.logTemplate('dinner', meal);
    expect(state.usage.value.get('slv:oats')!.count).toBe(usageBefore.get('slv:oats')!.count + 1);
    expect(state.usage.value.has('slv:new')).toBe(true);
    expect(state.templateUse.value.t1!.n).toBe((useBefore?.n ?? 0) + 1);

    await state.toast.value!.undo!();
    expect(state.usage.value.get('slv:oats')).toEqual(usageBefore.get('slv:oats'));
    expect(state.usage.value.has('slv:new')).toBe(false); // never used before: gone again
    expect(state.templateUse.value.t1).toEqual(useBefore);
    const stored = new Map((await db.listUsage()).map((u) => [u.foodRef, u]));
    expect(stored.get('slv:oats')).toEqual(usageBefore.get('slv:oats'));
    expect(stored.has('slv:new')).toBe(false);
  });
});
