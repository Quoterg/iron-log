import { describe, expect, it } from 'vitest';
import { priceCalc, roundKr, sumCost } from './cost-calc';

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

  it('shows whole kronor, half kronor below 10, tenths below 1', () => {
    expect([roundKr(23.4), roundKr(3.3), roundKr(0.34)]).toEqual([23, 3.5, 0.3]);
    expect(book.text({ kr: 3.3, partial: false })).toBe('~3,5 kr');
    expect(book.text({ kr: 23.4, partial: true })).toBe('minst ~23 kr');
  });

  it('a saved own price replaces the typical one; a removed one brings it back', () => {
    const b = book.withOwn('slv:oats', 40);
    expect(b.entryCost({ foodRef: 'slv:oats', grams: 50 })?.kr).toBe(2);
    expect(b.withOwn('slv:oats', null).entryCost({ foodRef: 'slv:oats', grams: 50 })?.kr).toBe(1);
    expect(book.entryCost({ foodRef: 'slv:oats', grams: 50 })?.kr).toBe(1); // unchanged
  });
});
