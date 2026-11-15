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
});
