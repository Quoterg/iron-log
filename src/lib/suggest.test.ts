import { describe, expect, it } from 'vitest';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import { gapFoods, swapFor, swapTargets, SWAPS } from './suggest';
import type { Target } from './targets';

function food(ref: string, sv: string, values: Record<string, number>): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  for (const [k, x] of Object.entries(values)) v[NUTRIENT_INDEX[k]] = x;
  return { ref, sv, en: null, per100g: v };
}
const targets: Record<string, Target> = {
  iron: { min: 15, max: null }, fibre: { min: 25, max: null }, folate: { min: 330, max: null },
  addedSugar: { min: null, max: 50 }, satFat: { min: null, max: 22 }, salt: { min: null, max: 6 },
};

describe('gap fixer', () => {
  const lentils = food('slv:1', 'Linser kokta', { kcal: 115, iron: 3.3 });
  const spinach = food('slv:2', 'Spenat', { kcal: 23, iron: 2.7 });
  const thyme = food('slv:3', 'Timjan torkad', { kcal: 276, iron: 124 });
  const oats = food('slv:4', 'Havregryn', { kcal: 375, iron: 4 });

  it("ranks the user's own foods first, then by nutrient per kcal", () => {
    const out = gapFoods('iron', 6, [
      { food: spinach, portionG: 100, own: false },
      { food: lentils, portionG: 150, own: false },
      { food: oats, portionG: 40, own: true },
    ]);
    expect(out.map((f) => f.ref)).toEqual(['slv:4', 'slv:2', 'slv:1']);
    expect(out[0]).toMatchObject({ own: true, portionG: 40 });
    expect(out[0].covers).toBeCloseTo(1.6 / 6);
  });

  it('skips foods whose usual portion covers under 10 % of the gap (spices), and caps coverage', () => {
    const out = gapFoods('iron', 6, [{ food: thyme, portionG: 0.4, own: false }, { food: lentils, portionG: 300, own: false }]);
    expect(out.map((f) => f.ref)).toEqual(['slv:1']);
    expect(out[0].covers).toBe(1);
    expect(gapFoods('iron', 0, [{ food: lentils, portionG: 150, own: false }])).toEqual([]);
  });
});

describe('suggestion strings', () => {
  it('every language has every string, with the same placeholders as Swedish', async () => {
    const { SV_SUGGEST } = await import('./strings-suggest');
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const code of ['en', 'da', 'de', 'fi', 'so']) {
      const own = (await import(`./lang/${code}.ts`)).default.suggest as Record<string, string>;
      expect(Object.keys(own).sort(), code).toEqual(Object.keys(SV_SUGGEST).sort());
      for (const [k, v] of Object.entries(SV_SUGGEST)) expect(ph(own[k]), `${code}.${k}`).toEqual(ph(v));
    }
  });
});

describe('swaps', () => {
  const white = food('slv:202', 'Bröd vitt fibrer 3,5%', { kcal: 284, fibre: 4.3, iron: 0.8, folate: 30, addedSugar: 6, satFat: 0.5, salt: 1.1 });
  const rye = food('slv:213', 'Bröd fullkorn råg typ rallarhalvor', { kcal: 246, fibre: 8.5, iron: 1.6, folate: 40, addedSugar: 0, satFat: 0.3, salt: 1 });

  it('suggests a better alternative at the same weight, with its biggest gains', () => {
    const s = swapFor(white, rye, 80, targets)!;
    expect(s.to).toBe('slv:213');
    // Fibre +3.36 g (13 % of 25) and added sugar −4.8 g (10 % of 50); iron +0.64 mg (4 %) is too small.
    expect(s.changes.map((c) => c.key)).toEqual(['fibre', 'addedSugar']);
    expect(s.changes[0].delta).toBeCloseTo(3.36);
    expect(s.changes[1].delta).toBeCloseTo(-4.8);
  });

  it('needs a matching rule, the right target food and a real gain', () => {
    expect(swapFor(food('slv:9', 'Bröd vitt fullkorn graham', { fibre: 6 }), rye, 80, targets)).toBeNull(); // already wholegrain
    expect(swapFor(white, food('slv:999', 'Något annat', { fibre: 20 }), 80, targets)).toBeNull();
    expect(swapFor(white, food('slv:213', 'Bröd fullkorn råg', { fibre: 4.4 }), 80, targets)).toBeNull(); // no gain
    expect(swapTargets([white, rye])).toEqual(['slv:213']);
    expect(SWAPS.every(([, to]) => to.startsWith('slv:'))).toBe(true);
  });
});
