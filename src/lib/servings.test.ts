import { describe, expect, it } from 'vitest';
import type { Entry, Usage } from './db';
import type { Food } from './nutrients';
import { AMOUNT_MEMORY, GRAMS, initialAmount, rememberAmount, servingsFor, toGrams, usualAmount, type LoggedAmount } from './servings';

const egg: Food = { ref: 'slv:1', sv: 'Ägg kokt', en: null, per100g: [], units: [{ name: 'st', g: 55 }] };
const entry = (p: Partial<Entry>): Entry => ({ id: 'e', date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams: 110, createdAt: 1, ...p });
const used = (p: Partial<Usage>): Usage => ({ foodRef: 'slv:1', count: 1, lastUsed: 5, lastGrams: 80, ...p });

describe('servings', () => {
  it('merges built-in and user measures; user wins on name clash', () => {
    const s = servingsFor(egg, [{ name: 'st', g: 60 }, { name: 'min skål', g: 300 }]);
    expect(s).toEqual([{ name: 'st', g: 60 }, { name: 'min skål', g: 300 }]);
  });

  it('converts measures to grams', () => {
    const s = servingsFor(egg);
    expect(toGrams('st', 2, s)).toBe(110);
    expect(toGrams('st', 0.5, s)).toBe(27.5);
    expect(toGrams(GRAMS, 42, s)).toBe(42);
    expect(toGrams('dl', 1, s)).toBeNaN();
    expect(toGrams('st', 0, s)).toBeNaN();
  });

  it('starts from the entry, then last use, then the first measure, then 100 g', () => {
    const s = servingsFor(egg);
    expect(initialAmount(s, entry({ unit: 'st', qty: 2 }))).toEqual({ unit: 'st', qty: 2 });
    expect(initialAmount(s, entry({}))).toEqual({ unit: GRAMS, qty: 110 });
    expect(initialAmount(s, undefined, used({ lastUnit: 'st', lastQty: 3 }))).toEqual({ unit: 'st', qty: 3 });
    expect(initialAmount(s, undefined, used({}))).toEqual({ unit: GRAMS, qty: 80 });
    expect(initialAmount(s)).toEqual({ unit: 'st', qty: 1 });
    expect(initialAmount([])).toEqual({ unit: GRAMS, qty: 100 });
    // A favourite that was never logged (lastUsed 0) doesn't count as "last use".
    expect(initialAmount(s, undefined, used({ lastUsed: 0 }))).toEqual({ unit: 'st', qty: 1 });
  });
});

describe('portion memory', () => {
  it('opens at the most frequent recent amount; ties go to the most recent; else the last one', () => {
    const s = servingsFor(egg);
    // 2 st three times, then 1 st once (the last): the usual is still 2 st.
    const amounts = [{ grams: 110, unit: 'st', qty: 2 }, { grams: 110, unit: 'st', qty: 2 }, { grams: 110, unit: 'st', qty: 2 }, { grams: 55, unit: 'st', qty: 1 }];
    expect(initialAmount(s, undefined, used({ lastUnit: 'st', lastQty: 1, lastGrams: 55, amounts }))).toEqual({ unit: 'st', qty: 2 });
    // 80 g twice, 120 g twice: the more recent of the two wins.
    const tie = [{ grams: 80 }, { grams: 120 }, { grams: 80 }, { grams: 120 }];
    expect(usualAmount(used({ lastGrams: 120, amounts: tie }))).toEqual({ grams: 120 });
    // All different: the last one.
    expect(usualAmount(used({ lastGrams: 70, amounts: [{ grams: 50 }, { grams: 60 }, { grams: 70 }] }))).toEqual({ grams: 70 });
    // Older data without a memory: the last amount.
    expect(usualAmount(used({ lastUnit: 'st', lastQty: 3 }))).toEqual({ grams: 80, unit: 'st', qty: 3 });
  });

  it('remembers at most the last few amounts', () => {
    let list: LoggedAmount[] | undefined;
    for (let g = 1; g <= AMOUNT_MEMORY + 3; g++) list = rememberAmount(list, { grams: g });
    expect(list).toHaveLength(AMOUNT_MEMORY);
    expect(list!.at(-1)).toEqual({ grams: AMOUNT_MEMORY + 3 });
  });
});
