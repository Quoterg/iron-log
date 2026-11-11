import { describe, expect, it } from 'vitest';
import { slvFruitVeg, usdaFruitVeg } from '../../scripts/fruitveg.mjs';

describe('fruit, vegetables & berries per 100 g (M52)', () => {
  it('Livsmedelsverket: the share of counted commodities; potatoes, legumes, juice and jam don\'t count', () => {
    const stew = { group: 'Kötträtt', raw: [['x', 'Nöt/ko', false, 22, 28], ['x', 'Lök (gul, röd)', false, 16, 16], ['x', 'Morot', false, 2, 2], ['x', 'Potatis', false, 30, 30]] };
    expect(slvFruitVeg(stew)).toBe(18);
    const soup = { group: 'Baljväxträtter', raw: [['x', 'Linser', false, 17, 7], ['x', 'Citron', false, 3, 5]] };
    expect(slvFruitVeg(soup)).toBe(3);
    expect(slvFruitVeg({ group: 'Juice och nektar', raw: [['x', 'Apelsin', false, 100, 120]] })).toBe(0);
    expect(slvFruitVeg({ group: 'Sylt eller marmelad', raw: [['x', 'Äpple', false, 78, 78]] })).toBe(0);
    expect(slvFruitVeg({ group: 'Processad frukt och bär', raw: [['x', 'Vindruvor', false, 99, 307]] })).toBe(99); // raisins, as eaten
    expect(slvFruitVeg(undefined)).toBeNull(); // no breakdown: unknown
  });

  it('USDA: whole fruits and vegetables by category, not juice, potatoes or powders', () => {
    expect(usdaFruitVeg('9', 'Apples, raw, with skin')).toBe(100);
    expect(usdaFruitVeg('11', 'Broccoli, raw')).toBe(100);
    expect(usdaFruitVeg('9', 'Orange juice, raw')).toBe(0);
    expect(usdaFruitVeg('11', 'Potatoes, baked, flesh and skin')).toBe(0);
    expect(usdaFruitVeg('11', 'Onions, dehydrated flakes')).toBe(0);
    expect(usdaFruitVeg('16', 'Beans, kidney, red, mature seeds, raw')).toBe(0);
  });
});
