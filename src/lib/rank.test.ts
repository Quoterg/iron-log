import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FoodIndex } from './food-index';
import { rowToFood } from './food-row';
import { isEco, LOGGED_BOOST, nameBonus, TWIN_PENALTY, twinPenalties, usageBoost, variantKey } from './rank';
import { normalize } from './search';

const n = normalize;

describe('ranking rules (M62)', () => {
  it('the first word as the query, then compounds of that kind, then words that only start with it', () => {
    expect(nameBonus(n('Mjölk fett 3% berikad'), 'mjolk', true)).toBe(4);
    expect(nameBonus(n('Lättmjölk fett 0,5% berikad'), 'mjolk', true)).toBe(3);
    expect(nameBonus(n('Mjölkchoklad'), 'mjolk', true)).toBe(1);
    // Still typing: "mjö" is no whole word, so starting with it is what counts.
    expect(nameBonus(n('Mjölkchoklad'), 'mjo', false)).toBe(4);
    expect(nameBonus(n('Våffla m. ägg'), 'agg', true)).toBe(0);
  });

  it('three letters are too few for a compound head ("pizzapålägg" is no egg)', () => {
    expect(nameBonus(n('Pizzapålägg m. tomatsås'), 'agg', true)).toBe(0);
    expect(nameBonus(n('Messmör fett 5%'), 'smor', true)).toBe(3);
  });

  it('eko twins: the same food but organic', () => {
    expect(variantKey(n('Ägg rått eko.'))).toBe('agg ratt');
    expect(isEco(n('Yoghurt naturell eko. fett 3% berikad'))).toBe(true);
    expect(isEco(n('Ekologisk havredryck'))).toBe(true);
    expect(isEco(n('Mjölk fett 3%'))).toBe(false);
    expect(isEco(n('Ekorre'))).toBe(false); // a word starting with "eko" isn't the marker
    expect(twinPenalties([n('Ägg kokt'), n('Ägg kokt eko.'), n('Filmjölk eko. fett 3%')])).toEqual([0, TWIN_PENALTY, 0]);
  });

  it('anything logged before outranks any match difference', () => {
    expect(usageBoost(0)).toBe(0);
    expect(usageBoost(1)).toBeGreaterThanOrEqual(LOGGED_BOOST);
    expect(usageBoost(0, true)).toBe(2);
    expect(usageBoost(1000, true)).toBe(LOGGED_BOOST + 3 + 2);
  });
});

describe('the walkthrough’s searches on Livsmedelsverket’s data (M62)', () => {
  const file = readdirSync('public/data').find((f) => /^foods\./.test(f))!;
  const data = JSON.parse(readFileSync(`public/data/${file}`, 'utf8')) as { keys: string[]; popular?: string[]; foods: never[] };
  const fresh = () => {
    const ix = new FoodIndex();
    for (const r of data.popular ?? []) ix.popular.add(r);
    ix.setBuiltIn(data.foods.map((row) => rowToFood(row, data.keys.length)));
    return ix;
  };
  const ix = fresh();
  const names = (q: string, k = 8, index = ix) => index.search(q, 'sv', k).map((f) => f.sv);
  const pos = (list: string[], re: RegExp) => list.findIndex((x) => re.test(x));

  it('"mjölk": plain milks (standard, lätt, mellan) above Mjölkchoklad and Mjölkpulver', () => {
    const list = names('mjölk', 40);
    expect(list[0]).toBe('Mjölk fett 3% berikad'); // standard milk
    const worst = Math.max(pos(list, /^Mjölk fett 3%/), pos(list, /^Lättmjölk/), pos(list, /^Mellanmjölk/));
    const choc = pos(list, /^Mjölkchoklad/);
    const powder = pos(list, /^Mjölkpulver/);
    expect(worst).toBeLessThan(6);
    for (const p of [choc, powder]) expect(p === -1 || p > worst).toBe(true);
  });

  it('"ägg": plain eggs first, never led by "Våffla m. ägg"; no eko twin among the first five', () => {
    const list = names('ägg', 10);
    expect(list[0]).toMatch(/^Ägg /);
    expect(pos(list, /^Våffla/)).not.toBe(0);
    expect(list.slice(0, 5).filter((x) => /eko/i.test(x))).toEqual([]);
    // Still findable a little further down.
    expect(names('ägg', 40).some((x) => /eko/i.test(x))).toBe(true);
  });

  it('a food logged before comes first, even one that matches less well', () => {
    const own = fresh();
    const choc = data.foods.find((r: [string, string]) => r[1] === 'Mjölkchoklad') as unknown as [string];
    own.setBoosts({ [choc[0]]: usageBoost(1) });
    expect(names('mjölk', 3, own)[0]).toBe('Mjölkchoklad');
  });

  it('while still typing ("mjö"), the milks stay on top too', () => {
    expect(names('mjö', 3)[0]).toBe('Mjölk fett 3% berikad');
  });

  it('stays as fast as M70 made it', () => {
    const t0 = performance.now();
    for (const q of ['mjölk', 'ägg', 'havregryn', 'kycklingbröstfilé', 'yoghurt naturell']) names(q);
    expect((performance.now() - t0) / 5).toBeLessThan(25);
  });
});
