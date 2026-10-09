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
import { toCsv } from './backup';
import { NUTRIENT_INDEX, NUTRIENTS } from './nutrients';
import { per100gToPerUnit, perUnitToPer100g } from './supplements';

const perUnit = (vitD: number) => NUTRIENTS.map((_, i) => (i === NUTRIENT_INDEX.vitD ? vitD : i === NUTRIENT_INDEX.kcal ? 0 : null));

describe('supplement units', () => {
  it('per-unit ↔ per-100 g round-trips label amounts without visible drift', () => {
    for (const x of [0.1, 0.3, 2.5, 12.5, 1000]) {
      const back = per100gToPerUnit(perUnitToPer100g([x, null]));
      expect(+back[0]!.toPrecision(6)).toBe(x);
      expect(back[1]).toBeNull();
    }
  });
});

describe('supplements in state', () => {
  it('daily checklist logs the dose; unticking removes only the latest dose', async () => {
    const state = await import('../state');
    await state.loadDay('2026-03-01');
    const ref = await state.saveCustomFood({ name: 'D-vitamin', per100g: perUnitToPer100g(perUnit(10)), supplement: { unit: 'tablett', perDay: 2 } });

    await state.toggleSupplementTaken(ref);
    const mine = () => state.entries.value.filter((e) => e.foodRef === ref);
    expect(mine()).toMatchObject([{ qty: 2, grams: 2, unit: 'tablett' }]);
    expect(state.dayTotals.value[NUTRIENT_INDEX.vitD]).toBeCloseTo(20);

    await state.takeSupplement(ref, 1); // an extra dose by hand
    await state.toggleSupplementTaken(ref);
    expect(mine()).toMatchObject([{ qty: 1 }]);
  });

  it('stays a supplement when saved from the plain food editor, and after deletion', async () => {
    const state = await import('../state');
    await state.loadDay('2026-03-02');
    const ref = await state.saveCustomFood({ name: 'Magnesium', per100g: perUnitToPer100g(perUnit(0)), supplement: { unit: 'kapsel', perDay: 0 } });
    await state.takeSupplement(ref, 1);

    const f = state.customFoods.value.find((x) => x.ref === ref)!;
    await state.saveCustomFood({ ref, name: 'Magnesium 2', per100g: f.per100g });
    expect(state.customFoods.value.find((x) => x.ref === ref)?.supplement).toEqual({ unit: 'kapsel', perDay: 0 });

    await state.deleteCustomFood(ref);
    expect(state.supplementRefs.value.has(ref)).toBe(true); // history stays out of the meals
    expect(state.supplements.value.map((x) => x.ref)).toContain(ref); // logged today → still in the card
    await state.loadDay('2026-03-03');
    expect(state.supplements.value.map((x) => x.ref)).not.toContain(ref);
  });

  it('labels supplement rows in CSV', () => {
    const food = { ref: 'custom:s', sv: 'Omega-3', en: null, per100g: perUnit(0) };
    const e = { id: 'e', date: '2026-03-04', meal: 'breakfast' as const, foodRef: 'custom:s', grams: 1, createdAt: 1 };
    const csv = toCsv([e], new Map([[food.ref, food]]), 'sv', (m) => m, new Set(['custom:s']));
    expect(csv).toContain('2026-03-04;Kosttillskott;Omega-3');
  });
});
