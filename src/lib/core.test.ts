import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays } from './db';
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

describe('real food data', () => {
  const data = JSON.parse(readFileSync('public/data/foods.json', 'utf8')) as {
    keys: string[];
    foods: [string, string, string | null, ...(number | null)[]][];
  };

  it('uses the nutrient order of nutrients.json', () => {
    expect(data.keys).toEqual(NUTRIENTS.map((n) => n.key));
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
