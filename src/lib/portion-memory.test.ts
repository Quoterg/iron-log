import { describe, expect, it } from 'vitest';
import type { Usage } from './db';
import { correctAmount, initialAmount, rememberAmount, usualAmount } from './servings';

const one = { grams: 120, unit: 'st', qty: 1 };
const two = { grams: 240, unit: 'st', qty: 2 };
const banana = [{ name: 'st', g: 120 }];

describe('portion memory (M23, checked in M67)', () => {
  it('a food logged once opens at that amount next time, not at 1 of its first measure', () => {
    const u: Usage = { foodRef: 'slv:1', count: 1, lastUsed: 1, lastGrams: 240, lastUnit: 'st', lastQty: 2, amounts: rememberAmount(undefined, two) };
    expect(initialAmount(banana, undefined, u)).toEqual({ unit: 'st', qty: 2 });
    // Never logged: 1 of the first measure (what the walkthrough saw for its first logs).
    expect(initialAmount(banana, undefined, undefined)).toEqual({ unit: 'st', qty: 1 });
  });

  it('opens at the usual amount; a tie goes to the latest', () => {
    const amounts = [one, one, two];
    expect(usualAmount({ foodRef: 'x', count: 3, lastUsed: 1, lastGrams: 240, lastUnit: 'st', lastQty: 2, amounts })).toEqual(one);
    expect(usualAmount({ foodRef: 'x', count: 2, lastUsed: 1, lastGrams: 240, lastUnit: 'st', lastQty: 2, amounts: [one, two] })).toEqual(two);
  });
});

describe('a corrected amount (M67)', () => {
  const u: Usage = { foodRef: 'slv:1', count: 3, lastUsed: 1, lastGrams: 120, lastUnit: 'st', lastQty: 1, amounts: [one, one, one] };

  it('replaces the remembered amount it corrects, without counting a use', () => {
    const c = correctAmount(u, two);
    expect(c.count).toBe(3);
    expect(c.amounts).toEqual([one, one, two]);
    expect(c).toMatchObject({ lastGrams: 240, lastUnit: 'st', lastQty: 2 });
  });

  it('a food logged once and corrected opens at the correction next time', () => {
    const once: Usage = { ...u, count: 1, amounts: [one] };
    expect(initialAmount(banana, undefined, correctAmount(once, two))).toEqual({ unit: 'st', qty: 2 });
    expect(usualAmount(correctAmount({ ...once, amounts: undefined }, { grams: 50 }))).toEqual({ grams: 50, unit: undefined, qty: undefined });
  });
});
