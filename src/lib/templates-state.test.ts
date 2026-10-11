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
import { itemsFromEntries, sortTemplates, suggestName } from './templates';

function food(ref: string, kcal: number): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  v[NUTRIENT_INDEX.kcal] = kcal;
  return { ref, sv: ref, en: null, per100g: v };
}

describe('saved meals', () => {
  it('saves a logged meal, logs it again in one go, counts uses and syncs deletions', async () => {
    const state = await import('../state');
    const db = await import('./db');
    state.foods.value = new Map([['slv:oats', food('slv:oats', 370)], ['slv:milk', food('slv:milk', 40)]]);
    await state.loadDay('2026-10-10');
    await state.addEntry('breakfast', state.foods.value.get('slv:oats')!, { grams: 40, unit: 'dl', qty: 1 });
    await state.addEntry('breakfast', state.foods.value.get('slv:milk')!, { grams: 200 });

    const items = itemsFromEntries(state.entries.value.filter((e) => e.meal === 'breakfast'));
    expect(items).toEqual([{ foodRef: 'slv:oats', grams: 40, unit: 'dl', qty: 1 }, { foodRef: 'slv:milk', grams: 200 }]);
    await state.saveTemplate({ name: ' Gröt ', items });
    const [m] = await db.listTemplates();
    expect(m.name).toBe('Gröt');

    await state.loadDay('2026-10-11');
    expect(await state.logTemplate('lunch', m)).toBe(2);
    const day = await db.entriesFor('2026-10-11');
    expect(day.map((e) => [e.meal, e.foodRef, e.grams, e.unit])).toEqual([
      ['lunch', 'slv:oats', 40, 'dl'],
      ['lunch', 'slv:milk', 200, undefined],
    ]);
    expect(state.dayTotals.value[NUTRIENT_INDEX.kcal]).toBeCloseTo(148 + 80);
    // Use is counted on this device only: the stored (synced) saved meal doesn't change.
    expect(state.templateUse.value[m.id]?.n).toBe(1);
    expect((await db.listTemplates())[0].updatedAt).toBe(m.updatedAt);
    // Logging counts as using the foods (recent list, portion memory).
    expect(state.usage.value.get('slv:milk')?.amounts).toEqual([{ grams: 200 }, { grams: 200 }]);

    await state.deleteTemplate(m.id);
    expect(await db.listTemplates()).toEqual([]);
    const { summarize } = await import('./sync');
    expect(`templates:${m.id}` in (await summarize())).toBe(true); // a tombstone, so the deletion syncs
  });

  it("offers yesterday's meal and logs it once even on a double tap", async () => {
    const state = await import('../state');
    await state.loadDay('2026-10-12'); // the day before holds the lunch logged above
    expect(state.prevEntries.value.filter((e) => e.meal === 'lunch')).toHaveLength(2);
    const [a, b] = await Promise.all([state.repeatYesterday('lunch'), state.repeatYesterday('lunch')]);
    expect(a + b).toBe(2);
    expect(state.entries.value.filter((e) => e.meal === 'lunch')).toHaveLength(2);
  });

  it('skips foods that are no longer available and says so', async () => {
    const state = await import('../state');
    await state.loadDay('2026-10-20');
    const n = await state.logItems('dinner', [{ foodRef: 'slv:oats', grams: 50 }, { foodRef: 'slv:gone', grams: 10 }]);
    expect(n).toBe(1);
    expect(state.notice.value).toMatch(/^1 /);
    await state.loadDay('2026-10-21');
    expect(state.notice.value).toBeNull();
  });

  it('suggests a name from the first foods and sorts by use', () => {
    expect(suggestName(['Havregryn, fullkorn', 'Mjölk 3 %', 'Banan', 'Kanel'])).toBe('Havregryn, Mjölk 3 %, Banan …');
    const t = (id: string) => ({ id, name: id, items: [], createdAt: 0, updatedAt: 0 });
    const use = { a: { n: 1, last: 5 }, c: { n: 1, last: 9 } };
    expect(sortTemplates([t('b'), t('a'), t('c')], use, 'sv').map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });
});
