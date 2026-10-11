import { describe, expect, it } from 'vitest';
import { addTo, expand, sectionOf, shopAmount, toText, type ShopItem } from './shopping';
import type { StoredRecipe } from './recipes';

describe('shopping list', () => {
  it('replaces recipes by their ingredients, scaled to the amount used', () => {
    const r = { ref: 'recipe:1', totalG: 400, ingredients: [{ foodRef: 'slv:a', grams: 100 }, { foodRef: 'slv:b', grams: 300 }] } as StoredRecipe;
    const out = expand([{ foodRef: 'recipe:1', grams: 200 }, { foodRef: 'slv:c', grams: 50 }], new Map([['recipe:1', r]]));
    expect(out).toEqual([{ foodRef: 'slv:a', grams: 50 }, { foodRef: 'slv:b', grams: 150 }, { foodRef: 'slv:c', grams: 50 }]);
    // A recipe that no longer exists stays as it is.
    expect(expand([{ foodRef: 'recipe:gone', grams: 100 }], new Map())).toEqual([{ foodRef: 'recipe:gone', grams: 100 }]);
  });

  it('sums into the open item of the same food; ticked items get a new line', () => {
    let n = 0;
    const id = () => `n${++n}`;
    const list: ShopItem[] = [
      { id: 'x', foodRef: 'slv:a', grams: 100, updatedAt: 1 },
      { id: 'y', foodRef: 'slv:b', grams: 100, checked: true, updatedAt: 1 },
    ];
    const out = addTo(list, [{ foodRef: 'slv:a', grams: 50 }, { foodRef: 'slv:a', grams: 25 }, { foodRef: 'slv:b', grams: 80 }, { foodRef: 'slv:c', grams: 0 }], 9, id);
    expect(out).toEqual([
      { id: 'x', foodRef: 'slv:a', grams: 175, updatedAt: 9 },
      { id: 'n1', foodRef: 'slv:b', grams: 80, updatedAt: 9 },
    ]);
  });

  it('sorts foods into store sections by name (Swedish and English)', () => {
    expect(sectionOf('Banan')).toBe('produce');
    expect(sectionOf('Mjölk mellanmjölk fett 1,5%')).toBe('dairy');
    expect(sectionOf('Hårdost fett 28%')).toBe('dairy');
    expect(sectionOf('Smörgåsgurka')).toBe('produce');
    expect(sectionOf('Nötfärs fett 10%')).toBe('meat');
    expect(sectionOf('Nötter blandade')).toBe('dry');
    expect(sectionOf('Havregryn fullkorn')).toBe('bread');
    expect(sectionOf('Hallon frysvara')).toBe('frozen');
    expect(sectionOf('Chicken, breast, raw')).toBe('meat');
    expect(sectionOf('Rapsolja')).toBe('dry');
    expect(sectionOf('Tandkräm')).toBe('other');
    expect(sectionOf('Jordnötssmör')).toBe('dry'); // not dairy ("smör")
    expect(sectionOf('Kokosmjölk')).toBe('dry');
    expect(sectionOf('Peanut butter, smooth')).toBe('dry');
    expect(sectionOf('Gotham')).toBe('other'); // not meat ("ham")
  });

  it('rounds to shop-friendly amounts', () => {
    expect(shopAmount(330, [{ name: 'st', g: 120 }])).toEqual({ qty: 3, unit: 'st' });
    expect(shopAmount(245, [{ name: 'st', g: 120 }])).toEqual({ qty: 2, unit: 'st' }); // 2.04 → 2
    expect(shopAmount(450, [{ name: 'dl', g: 100 }])).toEqual({ qty: 5, unit: 'dl' });
    expect(shopAmount(412, [{ name: 'dl', g: 103 }])).toEqual({ qty: 4, unit: 'dl' }); // milk: 4.0 dl
    expect(shopAmount(1400, [{ name: 'glas', g: 200 }])).toEqual({ qty: 1.5, unit: 'l' });
    expect(shopAmount(120, [{ name: 'dl', g: 35 }])).toEqual({ qty: 150, unit: 'g' }); // oats: by weight
    expect(shopAmount(170, [{ name: 'dl', g: 85 }])).toEqual({ qty: 200, unit: 'g' }); // sugar: by weight
    expect(shopAmount(37)).toEqual({ qty: 40, unit: 'g' });
    expect(shopAmount(260)).toEqual({ qty: 300, unit: 'g' });
    expect(shopAmount(1230)).toEqual({ qty: 1.3, unit: 'kg' });
  });

  it('shares as plain text, sections with items only', () => {
    expect(toText('Inköpslista', [{ title: 'Frukt & grönt', lines: ['Banan 6 st'] }, { title: 'Frys', lines: [] }])).toBe('Inköpslista\n\nFrukt & grönt\n- Banan 6 st');
  });
});
