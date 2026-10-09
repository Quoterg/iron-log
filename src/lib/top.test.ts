import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { topK } from '../../scripts/top.mjs';
import { rowToFood } from './food-row';
import { NUTRIENTS } from './nutrients';
import TOP from './top.json';

describe('topK', () => {
  const v = (x: number | null) => x;
  it('returns the largest values first, keeping input order on ties', () => {
    const items = [{ id: 'a', x: 3 }, { id: 'b', x: 9 }, { id: 'c', x: 3 }, { id: 'd', x: 7 }, { id: 'e', x: 9 }];
    expect(topK(items, (i) => i.x, 3).map((i) => i.id)).toEqual(['b', 'e', 'd']);
    expect(topK(items, (i) => i.x, 5).map((i) => i.id)).toEqual(['b', 'e', 'd', 'a', 'c']);
  });

  it('skips zero and unknown values, and handles n larger than the input', () => {
    expect(topK([0, null, 2, -1, 5], v, 10)).toEqual([5, 2]);
    expect(topK([], v, 3)).toEqual([]);
  });

  it('matches a full sort on many values', () => {
    const xs = Array.from({ length: 500 }, (_, i) => ((i * 7919) % 1000) / 10);
    expect(topK(xs, v, 10)).toEqual([...xs].sort((a, b) => b - a).slice(0, 10));
  });
});

describe('data rows', () => {
  it('pads rows without trailing unknowns to the file key count', () => {
    const f = rowToFood(['slv:1', 'Mjölk', 'Milk', 64, 3.4], 5);
    expect(f).toEqual({ ref: 'slv:1', sv: 'Mjölk', en: 'Milk', per100g: [64, 3.4, null, null, null] });
  });
});

describe('precomputed top file', () => {
  it('is current: matches the richest foods recomputed from the data files', () => {
    const sources = JSON.parse(readFileSync('src/lib/sources.json', 'utf8')) as Record<string, string[]>;
    const top = JSON.parse(readFileSync(`public/data/${TOP.file}`, 'utf8')) as {
      keys: string[];
      sources: Record<string, Record<string, [string, string, string | null, number][]>>;
    };
    expect(top.keys).toEqual(NUTRIENTS.map((n) => n.key));
    for (const [source, files] of Object.entries(sources)) {
      const rows = files.flatMap((f) => (JSON.parse(readFileSync(`public/data/${f}`, 'utf8')) as { foods: (string | number | null)[][] }).foods);
      for (const key of ['iron', 'vitC', 'kcal']) {
        const i = 3 + NUTRIENTS.findIndex((n) => n.key === key);
        const expected = [...rows].filter((r) => ((r[i] as number) ?? 0) > 0).sort((a, b) => (b[i] as number) - (a[i] as number)).slice(0, 10);
        expect(top.sources[source][key].map((r) => r[3])).toEqual(expected.map((r) => r[i]));
      }
    }
  });
});
