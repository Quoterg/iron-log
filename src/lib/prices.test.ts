import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../scripts/prices-spec.mjs';
import PRICES from './prices.json';
import { fmtMonth } from './typical-prices';
import SOURCES from './sources.json';

// The typical-price table (M33): checked as built, so a twice-yearly update can't ship nonsense.
const table = JSON.parse(readFileSync(`public/data/${PRICES.file}`, 'utf8')) as { month: string; foods: Record<string, number> };
const foods = JSON.parse(readFileSync(`public/data/${SOURCES.slv[0]}`, 'utf8')) as { popular: string[]; foods: [string, string][] };
const byName = new Map(foods.foods.map((f) => [f[1], f[0]]));
const kr = (name: string) => table.foods[byName.get(name)!];

describe('typical prices', () => {
  it('covers most Livsmedelsverket foods and every popular one, with sane values', () => {
    expect(Object.keys(table.foods).length).toBeGreaterThan(2000);
    expect(PRICES.foods).toBe(Object.keys(table.foods).length);
    expect(table.month).toBe(PRICES.month);
    expect(fmtMonth('2026M08')).toBe('2026-08');
    for (const ref of foods.popular) expect(table.foods[ref], ref).toBeGreaterThan(0);
    for (const x of Object.values(table.foods)) expect(x > 0 && x < 5000).toBe(true);
  });

  it('prices cooked foods by the raw food in them', () => {
    expect(kr('Pasta kokt u. salt')).toBeCloseTo(kr('Pasta okokt') / 2, 0);
    expect(kr('Ris långkornigt kokt m. salt')).toBeLessThan(kr('Ris långkornigt okokt') / 2);
    expect(kr('Havregrynsgröt fullkorn')).toBeLessThan(kr('Havregryn fullkorn') / 3);
    expect(kr('Kyckling bröstfilé färsk stekt u. skinn')).toBeGreaterThan(kr('Kyckling bröstfilé rå u. skinn'));
  });

  it('is in a plausible range for staples (kr/kg)', () => {
    const range = (name: string, lo: number, hi: number) => {
      expect(kr(name), name).toBeGreaterThan(lo);
      expect(kr(name), name).toBeLessThan(hi);
    };
    range('Mellanmjölk fett 1,5% berikad', 8, 30);
    range('Nöt färs rå fett 10%', 80, 250);
    range('Kyckling bröstfilé rå u. skinn', 70, 250);
    range('Potatis rå', 8, 40);
    range('Banan', 12, 40);
    range('Smör fett 80%', 60, 200);
    range('Ägg kokt', 30, 120);
    range('Bröd rågsikt fibrer ca 4%', 20, 100);
  });

  it('every item of the spec has a shelf price and a known store search', () => {
    const base = JSON.parse(readFileSync('data/prices-base.json', 'utf8')) as { items: Record<string, { kr: number }> };
    const keys = ITEMS.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(base.items[k]?.kr, k).toBeGreaterThan(0);
  });
});
