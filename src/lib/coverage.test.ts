import { describe, expect, it } from 'vitest';
import type { Entry } from './db';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import { coverage, gaps, MIN_COVERAGE } from './report';
import { nnrTargets } from './targets';

const food = (ref: string, kcal: number, leucine: number | null): Food => {
  const v: (number | null)[] = NUTRIENTS.map(() => null);
  v[NUTRIENT_INDEX.kcal] = kcal;
  v[NUTRIENT_INDEX.leucine] = leucine;
  return { ref, sv: ref, en: null, per100g: v };
};
const entry = (foodRef: string, grams: number): Entry => ({ id: foodRef + grams, date: '2026-10-09', meal: 'lunch', foodRef, grams, createdAt: 1 });

describe('coverage and "worth a look"', () => {
  const foods = new Map([
    ['slv:1', food('slv:1', 400, null)], // Swedish food: no amino acids analysed
    ['usda:1', food('usda:1', 100, 1.5)],
  ]);

  it('is the share of energy from foods that report the nutrient', () => {
    const c = coverage([entry('slv:1', 100), entry('usda:1', 100)], foods); // 400 + 100 kcal
    expect(c[NUTRIENT_INDEX.leucine]).toBeCloseTo(0.2);
    expect(c[NUTRIENT_INDEX.kcal]).toBe(1);
  });

  it('lists a low amino acid when the food reports it, but not when it is mostly missing data', () => {
    const t = nnrTargets({ sex: 'male', kcal: 2500, age: 30, weightKg: 70 }); // leucine target 2.7 g
    const amounts = NUTRIENTS.map(() => 0);
    amounts[NUTRIENT_INDEX.leucine] = 0.5;
    const covered = (list: Entry[]) => coverage(list, foods).map((c) => c >= MIN_COVERAGE);
    const usdaOnly = gaps(amounts, t, covered([entry('usda:1', 100)]));
    expect(usdaOnly.low.map((g) => g.key)).toContain('leucine');
    const mostlySwedish = gaps(amounts, t, covered([entry('slv:1', 100), entry('usda:1', 100)]));
    expect(mostlySwedish.low.map((g) => g.key)).not.toContain('leucine');
  });
});
