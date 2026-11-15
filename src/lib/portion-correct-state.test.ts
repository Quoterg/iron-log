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
import { isLatestEntry, LATEST_SLACK_MS } from './servings';

function food(ref: string, kcal: number): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  v[NUTRIENT_INDEX.kcal] = kcal;
  return { ref, sv: ref, en: null, per100g: v, units: [{ name: 'st', g: 120 }] };
}

describe('which entry a correction may update (M67 review)', () => {
  it('only an entry created just before the food’s last counted use', () => {
    expect(isLatestEntry(1000, 1003)).toBe(true);
    expect(isLatestEntry(1000, 1000 + LATEST_SLACK_MS)).toBe(true);
    expect(isLatestEntry(1000, 1000 + 30_000)).toBe(false); // the same food logged again 30 s later
  });

  it('updateEntry remembers the latest entry’s correction, not an older one’s or a swapped food’s', async () => {
    const state = await import('../state');
    state.foods.value = new Map([['slv:banana', food('slv:banana', 95)], ['slv:apple', food('slv:apple', 50)]]);
    await state.loadDay('2026-11-10');
    const banana = state.foods.value.get('slv:banana')!;
    await state.addEntry('breakfast', banana, { grams: 120, unit: 'st', qty: 1 });
    const first = state.entries.value[0];
    // An older entry: logged well before the food's last use (the same food again, later).
    await state.updateEntry(first.id, {}); // no amount: nothing remembered
    state.usage.value = new Map(state.usage.value).set('slv:banana', { ...state.usage.value.get('slv:banana')!, lastUsed: first.createdAt + 5 * 60_000 });
    await state.updateEntry(first.id, { amount: { grams: 360, unit: 'st', qty: 3 } });
    expect(state.usage.value.get('slv:banana')).toMatchObject({ lastQty: 1, amounts: [{ grams: 120, unit: 'st', qty: 1 }] });

    // The latest entry: its correction is what opens next time, without counting a use.
    await state.addEntry('lunch', banana, { grams: 120, unit: 'st', qty: 1 });
    const latest = state.entries.value.find((e) => e.meal === 'lunch')!;
    await state.updateEntry(latest.id, { amount: { grams: 240, unit: 'st', qty: 2 } });
    const u = state.usage.value.get('slv:banana')!;
    expect(u).toMatchObject({ count: 2, lastQty: 2 });
    expect(u.amounts?.at(-1)).toEqual({ grams: 240, unit: 'st', qty: 2 });

    // Swapping the food: no amount is remembered for either food.
    const before = state.usage.value.get('slv:banana');
    await state.updateEntry(latest.id, { foodRef: 'slv:apple', amount: { grams: 100 } });
    expect(state.usage.value.get('slv:banana')).toEqual(before);
    expect(state.usage.value.has('slv:apple')).toBe(false);
  });

  it('a quick entry’s amount is never remembered (quick foods have no use record)', async () => {
    const state = await import('../state');
    await state.loadDay('2026-11-11');
    await state.addQuickEntry('dinner', { name: 'Pizza ute', kcal: 900 });
    const e = state.entries.value.find((x) => x.meal === 'dinner')!;
    await state.updateEntry(e.id, { amount: { grams: 50 } });
    expect(state.usage.value.has(e.foodRef)).toBe(false);
  });
});
