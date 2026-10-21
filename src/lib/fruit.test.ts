import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { allYear, FRUITS, fruitNeeds, fruitSpan, goalGaps, inSeason, isSource, mainOrigin, MIN_TONNES, monthRuns, SEASON_PERIOD, sourceSeason, sourcesOf, supply, WEEK_MAX_G, weekPlan, widerSource, type Fruit } from './fruit';
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

describe('what fruit helps with', () => {
  // Per 100 g, like Livsmedelsverket's data.
  const kiwi = food('slv:kiwi', { vitC: 90, folate: 25, potassium: 300, fibre: 3, iron: 0.3 });
  const apricot = food('slv:apricot', { vitA: 153, vitC: 9, vitB6: 0.25 });
  const apple = food('slv:apple', { vitC: 4, fibre: 2 });

  it('a source by the EU claim rule: ≥ 15 % of the NRV per 100 g, fibre ≥ 3 g', () => {
    expect(isSource(kiwi, 'vitC')).toBe(true); // 90 mg ≥ 12 mg
    expect(isSource(kiwi, 'folate')).toBe(false); // 25 µg < 30 µg
    expect(isSource(kiwi, 'potassium')).toBe(true); // 300 mg ≥ 300 mg
    expect(isSource(kiwi, 'fibre')).toBe(true);
    expect(isSource(kiwi, 'iron')).toBe(false);
    expect(isSource(apricot, 'vitA')).toBe(true); // 153 µg ≥ 120 µg
    expect(isSource(apple, 'vitD')).toBe(false); // unknown or none: never
  });

  it('the span: what at least one fruit is a source of (vitamin A by the apricot), never vitamin D or protein', () => {
    expect(fruitSpan([kiwi, apricot, apple])).toEqual(['fibre', 'vitA', 'vitB6', 'vitC', 'potassium']);
  });

  it('keeps only gaps in the span, the most important first', () => {
    const needs = fruitNeeds(
      [{ key: 'vitD', ratio: 0.3 }, { key: 'vitC', ratio: 0.4 }, { key: 'folate', ratio: 0.5 }, { key: 'protein', ratio: 0.5 }],
      amounts({ vitC: 30, folate: 165, vitD: 3 }),
      { ...targets, protein: { min: 60, max: null } },
      ['vitC', 'folate', 'potassium'],
    );
    // Folate's 50 % shortfall × 1.3 (NNR priority) = 0.65 ranks before vitamin C's 0.6.
    expect(needs.map((n) => n.key)).toEqual(['folate', 'vitC']);
    expect(needs.find((n) => n.key === 'vitC')!.weekly).toBe((75 - 30) * 7);
  });

  it("for a goal nothing in season from here is a source of, names the narrowest wider choice that has one", () => {
    const byReach = { sweden: [{ food: apple }], europe: [{ food: apple }, { food: kiwi }], any: [{ food: kiwi }, { food: apricot }] };
    expect(sourcesOf('vitC', byReach.sweden)).toEqual([]);
    expect(widerSource('sweden', 'vitC', (r) => byReach[r])).toEqual({ reach: 'europe', fruits: [{ food: kiwi }] });
    expect(widerSource('sweden', 'vitA', (r) => byReach[r])).toEqual({ reach: 'any', fruits: [{ food: apricot }] });
    expect(widerSource('any', 'vitA', (r) => byReach[r])).toBeNull();
    expect(widerSource('sweden', 'vitD', (r) => byReach[r])).toBeNull();
  });

  it('says when a source is in season, if none is now (apricots for vitamin A: summer only)', () => {
    const summer = fruit('apricot', 40, { t: [0, 0, 0, 0, 300, 450, 450, 160, 0, 0, 0, 0], eu: month(100) });
    const all = [{ fruit: summer, food: apricot }, { fruit: fruit('apple', 150), food: apple }];
    expect(sourceSeason('vitA', all, 'europe')).toMatchObject({ months: [4, 5, 6], reach: 'europe' });
    expect(sourceSeason('vitD', all, 'europe')).toBeNull();
  });

  it('writes months as runs over the turn of the year', () => {
    expect(monthRuns([4, 5, 6])).toEqual([[4, 6]]);
    expect(monthRuns([10, 11, 0, 1, 4])).toEqual([[4, 4], [10, 1]]);
    expect(monthRuns([...Array(12).keys()])).toEqual([[0, 11]]);
    expect(monthRuns([])).toEqual([]);
  });

  it("lists the user's own gaps fruit could be suggested for (vitamins, minerals, fibre — not protein)", () => {
    const low = [{ key: 'vitA', ratio: 0.3 }, { key: 'vitD', ratio: 0.2 }, { key: 'protein', ratio: 0.5 }];
    expect(goalGaps(low, { ...targets, vitA: { min: 800, max: null }, protein: { min: 60, max: null } }).map((g) => g.key)).toEqual(['vitA', 'vitD']);
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

  it('weighs the energy gently: of two fruits giving the same, the lighter wins; a broad one still earns its place', () => {
    const heavy = food('slv:heavy', { kcal: 200, potassium: 360 });
    const light = food('slv:light', { kcal: 90, potassium: 360 });
    const same = weekPlan([{ key: 'potassium', weekly: 2000, weight: 1 }], [{ fruit: fruit('heavy', 120), food: heavy }, { fruit: fruit('light', 120), food: light }]);
    expect(same.items[0].fruit.key).toBe('light');
    // Avocado gives potassium, vitamin E and folate at once: worth its energy for a broad week.
    const avocado = food('slv:avocado', { kcal: 160, potassium: 490, vitE: 3.4, folate: 80 });
    const banana2 = food('slv:banana', { kcal: 90, potassium: 360, vitE: 0.1, folate: 20 });
    const needs = [{ key: 'potassium', weekly: 4000, weight: 1.3 }, { key: 'vitE', weekly: 30, weight: 1 }, { key: 'folate', weekly: 600, weight: 1.3 }];
    const broad = weekPlan(needs, [{ fruit: fruit('avocado', 140), food: avocado }, { fruit: bananaF, food: banana2 }]);
    expect(broad.items.map((i) => i.fruit.key)).toContain('avocado');
    expect(broad.items.find((i) => i.fruit.key === 'avocado')!.count).toBeLessThanOrEqual(7);
  });

  it('suggests fruit only for vitamins, minerals and fibre — not energy or macronutrients', () => {
    const avocado = food('slv:avocado', { kcal: 160, fat: 15, potassium: 490 });
    const t = { ...targets, fat: { min: 70, max: null } };
    const needs = fruitNeeds([{ key: 'fat', ratio: 0.3 }, { key: 'potassium', ratio: 0.6 }], amounts({ fat: 21, potassium: 2100 }), t, fruitSpan([avocado]));
    expect(needs.map((n) => n.key)).toEqual(['potassium']);
  });

  it('covers several nutrients at once: a broad week rather than one goal at a time', () => {
    const persimmon = food('slv:sharon', { kcal: 70, vitC: 66, vitA: 35, folate: 8 });
    const apricot = food('slv:apricot', { kcal: 45, vitA: 153, vitC: 9 });
    const fruits = [
      { fruit: kiwiF, food: kiwi },
      { fruit: fruit('sharon', 170), food: persimmon },
      { fruit: fruit('apricot', 40), food: apricot },
    ];
    const plan = weekPlan(
      [{ key: 'vitC', weekly: 300, weight: 1 }, { key: 'vitA', weekly: 600, weight: 1 }, { key: 'folate', weekly: 150, weight: 1.3 }],
      fruits,
    );
    expect(plan.items.length).toBeGreaterThanOrEqual(2);
    for (const k of ['vitC', 'vitA', 'folate']) expect(plan.covers[k], k).toBeGreaterThan(0.3);
    expect(plan.covers.vitC).toBe(1);
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

  it('with the real food data, fruit is a source of vitamin A, C, E, B6, folate, potassium and fibre — never D, B12, iron, calcium or iodine', () => {
    const file = readdirSync('public/data').find((f) => /^foods\.[0-9a-f]+\.json$/.test(f))!;
    const rows = new Map((JSON.parse(readFileSync(`public/data/${file}`, 'utf8')).foods as unknown[][]).map((r) => [r[0] as string, r]));
    const fruitFoods = FRUITS.map((f) => {
      const r = rows.get(f.food)!;
      return { ref: f.food, sv: f.sv, en: f.en, per100g: r.slice(3) as (number | null)[] } as Food;
    });
    const span = fruitSpan(fruitFoods);
    for (const k of ['vitA', 'vitC', 'vitE', 'vitB6', 'folate', 'potassium', 'fibre']) expect(span, k).toContain(k);
    for (const k of ['vitD', 'vitB12', 'iron', 'calcium', 'iodine']) expect(span, k).not.toContain(k);
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
