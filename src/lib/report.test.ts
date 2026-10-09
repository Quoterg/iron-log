import { describe, expect, it } from 'vitest';
import type { Entry } from './db';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import { averagePerDay, contributors, dailyTotals, gaps, knownNutrients, streak } from './report';

function food(ref: string, values: Record<string, number>): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  for (const [k, x] of Object.entries(values)) v[NUTRIENT_INDEX[k]] = x;
  return { ref, sv: ref, en: null, per100g: v };
}
const foods = new Map([
  ['slv:spinach', food('slv:spinach', { kcal: 23, iron: 2.7 })],
  ['slv:bread', food('slv:bread', { kcal: 250, iron: 2, salt: 1.2 })],
]);
let n = 0;
const e = (date: string, foodRef: string, grams: number): Entry => ({ id: String(n++), date, meal: 'lunch', foodRef, grams, createdAt: n });
const entries = [e('2026-10-07', 'slv:spinach', 100), e('2026-10-07', 'slv:bread', 100), e('2026-10-09', 'slv:bread', 200)];
const I = (k: string) => NUTRIENT_INDEX[k];

describe('reports', () => {
  it('averages per logged day, not per calendar day', () => {
    const days = dailyTotals(entries, foods);
    expect([...days.keys()]).toEqual(['2026-10-07', '2026-10-09']);
    const avg = averagePerDay(days);
    expect(avg[I('kcal')]).toBe((273 + 500) / 2);
    expect(avg[I('iron')]).toBeCloseTo((4.7 + 4) / 2);
  });

  it('flags nutrients below 70 % of target and above limits, worst first', () => {
    const avg = averagePerDay(dailyTotals(entries, foods));
    const g = gaps(avg, { iron: { min: 15, max: null }, vitC: { min: 95, max: null }, salt: { min: null, max: 2 }, kcal: { min: 2000, max: null } });
    expect(g.low.map((x) => x.key)).toEqual(['vitC', 'iron']); // 0 % then 29 %
    expect(g.high).toEqual([]); // salt 1.8 g/day is under the 2 g limit
    const g2 = gaps(avg, { salt: { min: null, max: 1 } });
    expect(g2.high[0].key).toBe('salt');
    expect(g2.high[0].ratio).toBeCloseTo(1.8);
  });

  it('ranks top contributors of a nutrient by amount with shares', () => {
    const c = contributors(entries, foods, I('iron'));
    expect(c.map((x) => x.foodRef)).toEqual(['slv:bread', 'slv:spinach']); // 6 mg vs 2.7 mg
    expect(c[0].share).toBeCloseTo(6 / 8.7);
  });

  it('never reports a nutrient no food in the period has data for as a gap', () => {
    const avg = averagePerDay(dailyTotals(entries, foods));
    const known = knownNutrients(entries, foods);
    expect(known[I('iron')]).toBe(true);
    expect(known[I('iodine')]).toBe(false); // neither food reports iodine
    const g = gaps(avg, { iron: { min: 15, max: null }, iodine: { min: 150, max: null } }, known);
    expect(g.low.map((x) => x.key)).toEqual(['iron']);
  });

  it('streak works across the October DST change', () => {
    expect(streak(new Set(['2026-10-24', '2026-10-25', '2026-10-26']), '2026-10-26')).toBe(3);
  });

  it('counts the logging streak, tolerating an empty today', () => {
    const days = new Set(['2026-10-06', '2026-10-07', '2026-10-08']);
    expect(streak(days, '2026-10-09')).toBe(3);
    expect(streak(new Set([...days, '2026-10-09']), '2026-10-09')).toBe(4);
    expect(streak(new Set(['2026-10-01']), '2026-10-09')).toBe(0);
  });
});
