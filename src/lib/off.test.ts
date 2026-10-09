import { describe, expect, it } from 'vitest';
import { NUTRIENT_INDEX } from './nutrients';
import { isValidBarcode, productToFood } from './off';

describe('barcodes', () => {
  it('validates check digits', () => {
    expect(isValidBarcode('7310865004703')).toBe(true); // EAN-13
    expect(isValidBarcode('7310865004704')).toBe(false);
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('73108650047a3')).toBe(false);
  });
});

describe('Open Food Facts mapping', () => {
  const product = {
    product_name_sv: 'Grekisk yoghurt',
    brands: 'Arla, Arla Foods',
    product_quantity: '1000',
    serving_quantity: 150,
    nutriments: {
      'energy-kcal_100g': 100,
      proteins_100g: 3.1,
      carbohydrates_100g: 3.4,
      fat_100g: 12,
      'saturated-fat_100g': 7.7,
      salt_100g: 0.1,
      'calcium_100g': 0.11, // g → 110 mg
      'vitamin-d_100g': 0.0000015, // g → 1.5 µg
      'iron_100g': 'not a number',
    },
  };

  it('maps nutrients to our units and keeps unknown values empty', () => {
    const f = productToFood('7310865004703', product)!;
    const v = (k: string) => f.per100g[NUTRIENT_INDEX[k]];
    expect(f.ref).toBe('off:7310865004703');
    expect(f.sv).toBe('Grekisk yoghurt (Arla)');
    expect(v('kcal')).toBe(100);
    expect(v('fat')).toBe(12);
    expect(v('calcium')).toBe(110);
    expect(v('vitD')).toBe(1.5);
    expect(v('sodium')).toBe(40); // derived from salt
    expect(v('iron')).toBeNull();
    expect(f.units).toEqual([{ name: 'portion', g: 150 }, { name: 'förpackning', g: 1000 }]);
  });

  it('derives kcal from kJ and rejects products without name or energy', () => {
    const f = productToFood('1', { product_name: 'X', nutriments: { 'energy-kj_100g': 418.4 } })!;
    expect(f.per100g[NUTRIENT_INDEX.kcal]).toBe(100);
    expect(productToFood('1', { product_name: '', nutriments: { 'energy-kcal_100g': 5 } })).toBeNull();
    expect(productToFood('1', { product_name: 'X', nutriments: {} })).toBeNull();
  });
});
