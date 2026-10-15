import { describe, expect, it } from 'vitest';
import { priceCalc, roundKr, sumCost } from './cost-calc';
import { afterEach } from 'vitest';
import { fmt, lang } from './i18n';

// Food cost in the diary (M34).
describe('food cost', () => {
  const book = priceCalc(new Map([['slv:milk', 20]]), new Map([['slv:milk', 14], ['slv:oats', 20], ['slv:butter', 110]]));

  it('prices an entry by its own price, else the typical one; none without either', () => {
    expect(book.entryCost({ foodRef: 'slv:milk', grams: 200 })).toEqual({ kr: 4, partial: false });
    expect(book.entryCost({ foodRef: 'slv:oats', grams: 50 })).toEqual({ kr: 1, partial: false });
    expect(book.entryCost({ foodRef: 'custom:x', grams: 100 })).toBeNull();
  });

  it('prices a recipe by its ingredients, scaled to the amount eaten; "at least" when one has no price', () => {
    const gröt = { totalG: 400, ingredients: [{ foodRef: 'slv:oats', grams: 100 }, { foodRef: 'slv:milk', grams: 300 }] };
    // 100 g oats 2 kr + 300 g milk (own price) 6 kr = 8 kr for 400 g; half of it eaten.
    expect(book.entryCost({ foodRef: 'recipe:1', grams: 200 }, gröt)).toEqual({ kr: 4, partial: false });
    const withSpice = { ...gröt, ingredients: [...gröt.ingredients, { foodRef: 'custom:cinnamon', grams: 2 }] };
    expect(book.entryCost({ foodRef: 'recipe:1', grams: 400 }, withSpice)).toEqual({ kr: 8, partial: true });
    expect(book.entryCost({ foodRef: 'recipe:2', grams: 100 }, { totalG: 100, ingredients: [{ foodRef: 'custom:x', grams: 100 }] })).toBeNull();
  });

  it('sums a meal, "at least" when an entry has no price or is partial', () => {
    expect(sumCost([{ kr: 4, partial: false }, { kr: 1, partial: false }])).toEqual({ kr: 5, partial: false });
    expect(sumCost([{ kr: 4, partial: false }, null])).toEqual({ kr: 4, partial: true });
    expect(sumCost([{ kr: 4, partial: true }])).toEqual({ kr: 4, partial: true });
    expect(sumCost([null, null])).toBeNull();
  });

  afterEach(() => {
    lang.value = 'sv';
  });

  it('shows whole kronor, half kronor below 10, tenths below 1, in the language set', () => {
    expect([roundKr(23.4), roundKr(3.3), roundKr(0.34)]).toEqual([23, 3.5, 0.3]);
    lang.value = 'sv';
    // The decimal mark follows the locale: "~3,5 kr" where the runtime has Swedish locale data
    // (browsers; not every Node build), else the fallback's.
    expect(book.text({ kr: 3.3, partial: false })).toBe(`~${fmt(3.5, 1)} kr`);
    expect(book.text({ kr: 23.4, partial: true })).toBe('minst ~23 kr');
    lang.value = 'en';
    expect(book.text({ kr: 3.3, partial: false })).toBe('~3.5 kr');
  });

  it('shows no cost below 0,05 kr (a pinch of salt), but counts it', () => {
    const salt = priceCalc(new Map(), new Map([['slv:salt', 5]])).entryCost({ foodRef: 'slv:salt', grams: 3 });
    expect(salt?.kr).toBeCloseTo(0.015);
    expect(book.shown(salt)).toBe(false);
    expect(book.shown({ kr: 0.05, partial: false })).toBe(true);
    expect(book.shown(null)).toBe(false);
    expect(sumCost([salt, { kr: 1, partial: false }])?.kr).toBeCloseTo(1.015);
  });

  it('a saved own price replaces the typical one; a removed one brings it back', () => {
    const b = book.withOwn('slv:oats', 40);
    expect(b.entryCost({ foodRef: 'slv:oats', grams: 50 })?.kr).toBe(2);
    expect(b.withOwn('slv:oats', null).entryCost({ foodRef: 'slv:oats', grams: 50 })?.kr).toBe(1);
    expect(book.entryCost({ foodRef: 'slv:oats', grams: 50 })?.kr).toBe(1); // unchanged
  });
});

describe('food cost over a period (M38)', () => {
  const book = priceCalc(new Map(), new Map([['slv:milk', 15], ['slv:oats', 20]]));
  const e = (date: string, foodRef: string, grams: number) => ({ date, foodRef, grams });

  it('sums the period over the days with something logged; "at least" when a food has no price', () => {
    const week = [e('2026-10-12', 'slv:milk', 1000), e('2026-10-12', 'slv:oats', 100), e('2026-10-13', 'slv:milk', 1000)];
    expect(book.period(week, [])).toEqual({ total: 32, days: 2, partial: false }); // 15 + 2 + 15 kr
    expect(book.period([...week, e('2026-10-14', 'custom:x', 100)], [])).toEqual({ total: 32, days: 3, partial: true });
    expect(book.period([e('2026-10-14', 'custom:x', 100)], [])).toBeNull();
    // A recipe by its ingredients.
    const r = { ref: 'recipe:1', totalG: 1000, ingredients: [{ foodRef: 'slv:milk', grams: 1000 }] };
    expect(book.period([e('2026-10-12', 'recipe:1', 500)], [r])?.total).toBeCloseTo(7.5);
  });

  it('says it per day and week (7 days), and per 30 days too (30 days)', () => {
    lang.value = 'sv';
    const c = { total: 434, days: 7, partial: false }; // 62 kr/day
    expect(book.periodText(c, 7)).toBe('Matkostnad: ~62 kr/dag · ~434 kr/vecka');
    expect(book.periodText({ total: 1860, days: 30, partial: true }, 30)).toBe(
      `Matkostnad: ~62 kr/dag · ~434 kr/vecka · ~${fmt(1860)} kr/30 dagar (minst – vissa livsmedel saknar pris)`,
    );
  });
});
