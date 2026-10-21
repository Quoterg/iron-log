import { describe, expect, it } from 'vitest';
import { allYear, defaultGoals, FRUITS, fruitNeeds, inSeason, mainOrigin, MIN_TONNES, SEASON_PERIOD, supply, WEEK_MAX_G, weekPlan, type Fruit } from './fruit';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';
import type { Target } from './targets';

function food(ref: string, values: Record<string, number>): Food {
  const v = NUTRIENTS.map(() => null as number | null);
  for (const [k, x] of Object.entries(values)) v[NUTRIENT_INDEX[k]] = x;
  return { ref, sv: ref, en: null, per100g: v };
}
const month = (x: number) => Array(12).fill(x) as number[];
function fruit(key: string, grams: number, over: Partial<Fruit> = {}): Fruit {
  return { key, sv: key, en: key, food: `slv:${key}`, unit: ['st', grams], t: month(1000), se: month(0), eu: month(100), top: month(0).map(() => 'ES'), ...over };
}
const amounts = (values: Record<string, number>) => {
  const a = NUTRIENTS.map(() => 0);
  for (const [k, x] of Object.entries(values)) a[NUTRIENT_INDEX[k]] = x;
  return a;
};
const targets: Record<string, Target> = {
  vitC: { min: 75, max: null }, folate: { min: 330, max: null }, potassium: { min: 3500, max: null },
  vitD: { min: 10, max: null }, fibre: { min: 25, max: null },
};

describe('season', () => {
  // Winter citrus: plentiful Nov–Mar, a little in summer.
  const winter = fruit('orange', 140, { t: [9000, 8000, 6000, 3000, 1500, 400, 300, 300, 400, 2500, 6000, 9000] });
  // Swedish berries: June–August Swedish, imported (Spain) in spring.
  const berries = fruit('berries', 65, {
    t: [300, 800, 1500, 2300, 2100, 5400, 5000, 5100, 150, 160, 80, 180],
    se: [0, 0, 0, 0, 0, 91, 98, 95, 0, 0, 0, 0],
    eu: [100, 100, 100, 100, 100, 9, 2, 5, 100, 100, 100, 100],
  });

  it('is plentiful against its own year, and enough of it', () => {
    expect(inSeason(winter, 0, 'any')).toBe(true);
    expect(inSeason(winter, 6, 'any')).toBe(false);
    // Only Swedish: the Swedish months; Europe: also late spring's Spanish ones.
    expect([5, 6, 7].every((m) => inSeason(berries, m, 'sweden'))).toBe(true);
    expect(inSeason(berries, 3, 'sweden')).toBe(false);
    expect(inSeason(berries, 3, 'europe')).toBe(true);
    expect(inSeason(berries, 11, 'europe')).toBe(false);
  });

  it('never calls a rare fruit in season, however its months compare', () => {
    const rare = fruit('rare', 50, { t: month(MIN_TONNES - 1) });
    expect(inSeason(rare, 0, 'any')).toBe(false);
  });

  it('counts only the origins allowed: a fruit from far away is never in season for Europe', () => {
    const far = fruit('mango', 200, { eu: month(5), top: month(0).map(() => '') });
    expect(allYear(far, 'any')).toBe(true);
    expect(supply(far, 'europe')[0]).toBe(50);
    expect(inSeason(far, 0, 'europe')).toBe(false);
    expect(mainOrigin(far, 0)).toBe('');
    expect(mainOrigin(berries, 6)).toBe('SE');
  });
});

describe('needs', () => {
  const kiwi = food('slv:kiwi', { vitC: 90, folate: 25, potassium: 300, fibre: 3 });
  it('keeps only gaps fruit can help with, the most important first', () => {
    const needs = fruitNeeds(
      [{ key: 'vitD', ratio: 0.3 }, { key: 'vitC', ratio: 0.4 }, { key: 'folate', ratio: 0.5 }],
      amounts({ vitC: 30, folate: 165, vitD: 3 }),
      targets,
      [{ food: kiwi, grams: 75 }],
    );
    // No fruit gives vitamin D. Folate's 50 % shortfall × 1.3 (NNR priority) = 0.65 ranks before vitamin C's 0.6.
    expect(needs.map((n) => n.key)).toEqual(['folate', 'vitC']);
    expect(needs.find((n) => n.key === 'vitC')!.weekly).toBe((75 - 30) * 7);
  });
});

describe('the week\'s fruit', () => {
  const kiwiF = fruit('kiwi', 75);
  const bananaF = fruit('banana', 120);
  const kiwi = food('slv:kiwi', { vitC: 90, folate: 25, potassium: 300 });
  const banana = food('slv:banana', { vitC: 9, folate: 20, potassium: 360 });

  it('closes the gap in whole portions, with the fruit that helps most', () => {
    const plan = weekPlan([{ key: 'vitC', weekly: 45 * 7, weight: 1 }], [{ fruit: kiwiF, food: kiwi }, { fruit: bananaF, food: banana }]);
    // 315 mg a week; a kiwi gives 67.5 mg: 5 kiwis (337 mg).
    expect(plan.items.map((i) => [i.fruit.key, i.count])).toEqual([['kiwi', 5]]);
    expect(plan.items[0].grams).toBe(375);
    expect(plan.covers.vitC).toBe(1);
    expect(plan.capped).toBe(false);
  });

  it('mixes fruits for several needs, at most one portion of a fruit a day', () => {
    const plan = weekPlan(
      [{ key: 'vitC', weekly: 300, weight: 1 }, { key: 'potassium', weekly: 4000, weight: 1.3 }],
      [{ fruit: kiwiF, food: kiwi }, { fruit: bananaF, food: banana }],
    );
    expect(plan.items.length).toBe(2);
    expect(plan.items.every((i) => i.count <= 7)).toBe(true);
    expect(plan.covers.vitC).toBe(1);
  });

  it('stops at a sensible amount of fruit a week and says fruit alone is not enough', () => {
    const big = fruit('big', 300);
    const many = ['a', 'b', 'c', 'd'].map((k) => ({ fruit: fruit(k, 300), food: banana }));
    const plan = weekPlan([{ key: 'potassium', weekly: 7000 * 7, weight: 1 }], [{ fruit: big, food: banana }, ...many]);
    expect(plan.items.reduce((s, i) => s + i.grams, 0)).toBeLessThanOrEqual(WEEK_MAX_G);
    expect(plan.capped).toBe(true);
    expect(plan.covers.potassium).toBeLessThan(0.5);
  });

  it('weighs the energy: a week of avocados does not win on potassium alone', () => {
    const avocadoF = fruit('avocado', 140);
    const avocado = food('slv:avocado', { kcal: 160, potassium: 490, folate: 80 });
    const banana2 = food('slv:banana', { kcal: 90, potassium: 360, folate: 20 });
    const plan = weekPlan([{ key: 'potassium', weekly: 2000, weight: 1 }], [{ fruit: avocadoF, food: avocado }, { fruit: bananaF, food: banana2 }]);
    expect(plan.items[0].fruit.key).toBe('banana');
  });

  it('suggests fruit only for vitamins, minerals and fibre — not energy or macronutrients', () => {
    const avocado = food('slv:avocado', { kcal: 160, fat: 15, potassium: 490 });
    const t = { ...targets, fat: { min: 70, max: null } };
    const needs = fruitNeeds([{ key: 'fat', ratio: 0.3 }, { key: 'potassium', ratio: 0.6 }], amounts({ fat: 21, potassium: 2100 }), t, [{ food: avocado, grams: 140 }]);
    expect(needs.map((n) => n.key)).toEqual(['potassium']);
  });

  it('chooses first the most important gaps a week of fruit closes at least halfway', () => {
    const fruits = [{ fruit: kiwiF, food: kiwi }, { fruit: bananaF, food: banana }];
    const needs = [
      { key: 'potassium', weekly: 20000, weight: 1.3 }, // far more than fruit can give
      { key: 'vitC', weekly: 300, weight: 1 },
      { key: 'folate', weekly: 200, weight: 1.3 },
    ];
    expect(defaultGoals(needs, fruits).map((n) => n.key)).toEqual(['vitC', 'folate']);
    expect(defaultGoals(needs.slice(0, 1), fruits).map((n) => n.key)).toEqual(['potassium']); // none closable: the first
  });

  it('suggests nothing when nothing helps', () => {
    const plan = weekPlan([{ key: 'vitD', weekly: 50, weight: 1 }], [{ fruit: kiwiF, food: kiwi }]);
    expect(plan.items).toEqual([]);
    expect(plan.capped).toBe(false);
  });
});

describe('the season table (sanity of the twice-yearly update)', () => {
  // build-fruit.mjs fails if a fruit's food is missing from the database.
  it('has every fruit with 12 months, shares within 0–100, a portion', () => {
    expect(FRUITS.length).toBeGreaterThanOrEqual(20);
    for (const f of FRUITS) {
      for (const series of [f.t, f.se, f.eu, f.top]) expect(series).toHaveLength(12);
      f.se.forEach((x, m) => expect(x + f.eu[m]).toBeLessThanOrEqual(101));
      expect(f.food).toMatch(/^slv:\d+$/);
      expect(f.unit[1]).toBeGreaterThan(0);
      expect(['st', 'dl'], f.key).toContain(f.unit[0]); // read right in any number ("3 dl", not "3 skiva")
    }
  });

  it("has the same period in Settings' small period file", async () => {
    expect((await import('./fruit-period.json')).default.period).toBe(SEASON_PERIOD);
  });

  it('knows the seasons everybody knows', () => {
    const get = (k: string) => FRUITS.find((f) => f.key === k)!;
    expect([5, 6].every((m) => inSeason(get('strawberries'), m, 'sweden'))).toBe(true); // Swedish strawberries
    expect(inSeason(get('strawberries'), 11, 'sweden')).toBe(false);
    expect(inSeason(get('apple'), 9, 'sweden')).toBe(true); // Swedish apples in October
    expect(inSeason(get('orange'), 0, 'europe')).toBe(true); // Spanish oranges in January
    expect(inSeason(get('watermelon'), 0, 'any')).toBe(false);
    expect(allYear(get('banana'), 'any')).toBe(true);
    expect(inSeason(get('banana'), 0, 'europe')).toBe(false); // bananas are never European
    expect(inSeason(get('mango'), 0, 'europe')).toBe(false); // nor mangoes sent on by the Netherlands
  });
});

describe('fruit strings', () => {
  it('every language has every string, with the same placeholders as Swedish', async () => {
    const { SV_FRUIT } = await import('./strings-fruit');
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const code of ['en', 'da', 'de', 'fi', 'so']) {
      const own = (await import(`./lang/${code}.ts`)).default.fruit as Record<string, string>;
      expect(Object.keys(own).sort(), code).toEqual(Object.keys(SV_FRUIT).sort());
      for (const [k, v] of Object.entries(SV_FRUIT)) expect(ph(own[k]), `${code}.${k}`).toEqual(ph(v));
    }
  });
});
