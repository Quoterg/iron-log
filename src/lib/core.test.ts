import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays, usageFromEntries } from './db';
import { userBoosts } from '../state';
import { NUTRIENT_INDEX, NUTRIENTS } from './nutrients';
import { buildEntry, normalize, search } from './search';
import { nnrTargets, progress } from './targets';
import { parseNum } from './i18n';
import { energySplit, estimateKcal, scale, sum } from './totals';

describe('normalize', () => {
  it('folds case, Swedish letters and punctuation', () => {
    expect(normalize('Ost, hårdost 28% FETT')).toBe('ost hardost 28% fett');
    expect(normalize('Smör')).toBe('smor');
    expect(normalize('Crème fraîche')).toBe('creme fraiche');
  });
});

describe('search', () => {
  const names = ['Mjölkchoklad med hasselnötter', 'Mjölk fett 3%', 'Havregryn', 'Filmjölk fett 3%', 'Ägg kokt'];
  const entries = names.map((n, i) => buildEntry(i, [n], n));
  const find = (q: string) => search(entries, q).map((i) => names[i]);

  it('prefers short names that start with the query', () => {
    expect(find('mjölk')[0]).toBe('Mjölk fett 3%');
  });
  it('matches without Swedish characters', () => {
    expect(find('agg')).toEqual(['Ägg kokt']);
  });
  it('requires every token to match', () => {
    const r = find('mjolk 3%');
    expect(r[0]).toBe('Mjölk fett 3%');
    expect(r).not.toContain('Mjölkchoklad med hasselnötter');
  });
  it('handles Swedish compound words in both directions', () => {
    const n = ['Kyckling bröstfilé rå u. skinn', 'Fläskfilé rå', 'Kycklinglever'];
    const e = n.map((x, i) => buildEntry(i, [x], x));
    expect(search(e, 'kycklingfilé').map((i) => n[i])).toEqual(['Kyckling bröstfilé rå u. skinn']);
    expect(search(e, 'filé').map((i) => n[i])).toHaveLength(2);
  });
  it('ranks boosted (custom) foods above equal matches', () => {
    const n = ['Proteinpulver vanilj', 'Proteinpulver vanilj'];
    const e = n.map((x, i) => buildEntry(i, [x], x));
    e[1].boost = 1;
    expect(search(e, 'proteinpulver')[0]).toBe(1);
  });
  it('returns nothing for blank queries', () => {
    expect(find('  ')).toEqual([]);
  });
});

describe('USDA food data', () => {
  const sources = JSON.parse(readFileSync('src/lib/sources.json', 'utf8')) as { usda: string[] };
  const files = sources.usda.map(
    (f) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as { keys: string[]; foods: [string, string, null, ...(number | null)[]][] },
  );
  const foods = files.flatMap((f) => f.foods);

  it('uses our nutrient order and unique usda refs and names', () => {
    for (const f of files) expect(f.keys).toEqual(NUTRIENTS.map((n) => n.key));
    expect(foods.length).toBeGreaterThan(7000);
    expect(new Set(foods.map((f) => f[0])).size).toBe(foods.length);
    expect(new Set(foods.map((f) => f[1])).size).toBe(foods.length);
    expect(foods.every((f) => f[0].startsWith('usda:'))).toBe(true);
  });

  it('has plausible energy (available carbs, not carbs by difference)', () => {
    const off: string[] = [];
    for (const [, name, , ...v] of foods) {
      const k = (key: string) => v[NUTRIENT_INDEX[key]] ?? 0;
      const est = k('protein') * 4 + k('carbs') * 4 + k('fat') * 9 + k('alcohol') * 7 + k('fibre') * 2;
      if (Math.abs(est - k('kcal')) > 0.15 * k('kcal') + 15) off.push(`${name}: ${k('kcal')} kcal vs ${Math.round(est)}`);
    }
    // Pinned to today's count (mostly foods with sugar alcohols/organic acids); new outliers fail.
    expect(off.length, off.slice(0, 10).join('\n')).toBeLessThanOrEqual(40);
    const banana = foods.find((f) => f[1] === 'Bananas, raw')!;
    expect(banana[3 + NUTRIENT_INDEX.carbs]).toBeCloseTo(20.2, 1); // 22.8 by difference − 2.6 fibre
  });

  it('has the M16 nutrients where USDA analysed them (rows may omit trailing unknowns)', () => {
    const almonds = foods.find((f) => f[1] === 'Nuts, almonds')!;
    expect(almonds.length).toBeLessThanOrEqual(3 + NUTRIENTS.length);
    expect(almonds[3 + NUTRIENT_INDEX.copper]).toBeGreaterThan(0.8); // ≈ 1 mg/100 g
    expect(almonds[3 + NUTRIENT_INDEX.manganese]).toBeGreaterThan(1.5); // ≈ 2.2 mg/100 g
    const kale = foods.find((f) => /^Kale, raw/.test(f[1]))!;
    expect(kale[3 + NUTRIENT_INDEX.vitK]).toBeGreaterThan(300); // ≈ 390 µg/100 g
  });

  it('has essential amino acids, with methionine+cysteine and phenylalanine+tyrosine summed', () => {
    const egg = foods.find((f) => f[1] === 'Egg, whole, raw, fresh')!;
    expect(egg[3 + NUTRIENT_INDEX.leucine]).toBeCloseTo(1.09, 1); // USDA SR: 1.086 g/100 g
    expect(egg[3 + NUTRIENT_INDEX.methCys]).toBeCloseTo(0.38 + 0.27, 1); // 0.380 + 0.272
    const withLeucine = foods.filter((f) => Number(f[3 + NUTRIENT_INDEX.leucine] ?? 0) > 0).length;
    expect(withLeucine).toBeGreaterThan(4000);
  });
});

describe('real food data', () => {
  const slvFile = (JSON.parse(readFileSync('src/lib/sources.json', 'utf8')) as { slv: string[] }).slv[0];
  const data = JSON.parse(readFileSync(`public/data/${slvFile}`, 'utf8')) as {
    keys: string[];
    foods: [string, string, string | null, ...(number | null)[]][];
  };

  it('uses the nutrient order of nutrients.json', () => {
    expect(data.keys).toEqual(NUTRIENTS.map((n) => n.key));
  });

  it('ranks everyday foods first: "ris" → cooked rice', () => {
    const popular = new Set((data as unknown as { popular: string[] }).popular);
    expect(popular.size).toBeGreaterThan(40);
    const entries = data.foods.map((f, i) => {
      const e = buildEntry(i, [f[1], f[2]], f[1]);
      if (popular.has(f[0])) e.boost = 2; // POPULAR_BOOST in the worker
      return e;
    });
    for (const [q, expected] of [['ris', /kokt/], ['mjölk', /^Mjölk fett 3%/], ['ägg', /^Ägg/]] as const) {
      expect(data.foods[search(entries, q)[0]][1]).toMatch(expected);
    }
  });

  it('finds common Swedish foods quickly', () => {
    const entries = data.foods.map((f, i) => buildEntry(i, [f[1], f[2]], f[1]));
    const t0 = performance.now();
    const hits = search(entries, 'havregryn');
    const ms = performance.now() - t0;
    expect(data.foods[hits[0]][1].toLowerCase()).toContain('havregryn');
    expect(ms).toBeLessThan(50);
  });

  it('has plausible energy values (kcal ≈ Atwater)', () => {
    const k = (v: (number | null)[], key: string) => v[NUTRIENT_INDEX[key]] ?? 0;
    let bad = 0;
    for (const [, , , ...f] of data.foods) {
      const est = k(f, 'protein') * 4 + k(f, 'carbs') * 4 + k(f, 'fat') * 9 + k(f, 'alcohol') * 7 + k(f, 'fibre') * 2;
      if (Math.abs(est - k(f, 'kcal')) > 0.15 * k(f, 'kcal') + 10) bad++;
    }
    expect(bad / data.foods.length).toBeLessThan(0.02);
  });
});

describe('targets', () => {
  it('derives NNR 2023 targets from the profile', () => {
    const f = nnrTargets({ sex: 'female', kcal: 2000 });
    expect(f.iron.min).toBe(15);
    expect(f.fibre.min).toBe(25);
    expect(f.protein).toEqual({ min: 50, max: 100 });
    expect(f.satFat.max).toBe(22);
    const m = nnrTargets({ sex: 'male', kcal: 2500 });
    expect(m.iron.min).toBe(9);
    expect(m.vitC.min).toBe(110);
    expect(m.thiamin.min).toBeCloseTo(1.0, 1);
  });
  it('reports progress against min, else max', () => {
    expect(progress(50, { min: 100, max: null })).toBe(0.5);
    expect(progress(3, { min: null, max: 6 })).toBe(0.5);
    expect(progress(3, undefined)).toBeNull();
  });
});

describe('usage', () => {
  it('derives counts and last amount from diary entries', () => {
    const e = (id: string, foodRef: string, grams: number, createdAt: number) =>
      ({ id, date: '2026-10-09', meal: 'lunch', foodRef, grams, createdAt }) as const;
    const u = usageFromEntries([e('2', 'slv:1', 50, 20), e('1', 'slv:1', 30, 10), e('3', 'slv:2', 100, 15)]);
    expect(u.find((x) => x.foodRef === 'slv:1')).toEqual({ foodRef: 'slv:1', count: 2, lastUsed: 20, lastGrams: 50 });
  });
  it('boosts frequently used and favourite foods, capped', () => {
    const map = new Map([
      ['a', { foodRef: 'a', count: 1, lastUsed: 1, lastGrams: 1 }],
      ['b', { foodRef: 'b', count: 1000, lastUsed: 1, lastGrams: 1 }],
      ['c', { foodRef: 'c', count: 0, lastUsed: 0, lastGrams: 1, fav: true }],
    ]);
    const b = userBoosts(map);
    expect(b.a).toBeCloseTo(0.75);
    expect(b.b).toBe(3);
    expect(b.c).toBe(2);
  });
});

describe('totals', () => {
  it('scales and sums, treating unknown as 0', () => {
    const v = new Array(NUTRIENTS.length).fill(null);
    v[NUTRIENT_INDEX.kcal] = 200;
    const a = scale(v, 50);
    expect(a[NUTRIENT_INDEX.kcal]).toBe(100);
    expect(sum([a, a])[NUTRIENT_INDEX.kcal]).toBe(200);
    expect(sum([a])[NUTRIENT_INDEX.protein]).toBe(0);
  });
  it('estimates energy from macros like an EU label', () => {
    // 75 g protein, 8 g carbs, 6 g fat, 2 g fibre → 300 + 32 + 54 + 4
    expect(estimateKcal(75, 8, 6, 2)).toBe(390);
    expect(estimateKcal(0, 0, 0)).toBe(0);
  });
  it('parses numbers with a decimal comma', () => {
    expect(parseNum('1,5')).toBe(1.5);
    expect(parseNum(' 30 ')).toBe(30);
    expect(parseNum('')).toBeNaN();
    expect(parseNum('abc')).toBeNaN();
  });
  it('computes energy percentages', () => {
    const s = energySplit(25, 50, 0, 0);
    expect(s.protein).toBeCloseTo(1 / 3);
    expect(energySplit(0, 0, 0, 0).fat).toBe(0);
  });
  it('steps dates across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
