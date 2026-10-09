import { describe, expect, it } from 'vitest';
import { databaseOf, offAddUrl, offProductUrl, reportUrl } from './contribute';

describe('contribution links', () => {
  it('point at Open Food Facts product and add pages', () => {
    expect(offProductUrl('7310865004703')).toBe('https://world.openfoodfacts.org/product/7310865004703');
    expect(offAddUrl('7310865004703')).toContain('code=7310865004703');
  });

  it('prefill a GitHub issue with the food, safely encoded', () => {
    const url = new URL(reportUrl('slv:12', 'Mjölk 3% & grädde', 'Milk 3% & cream'));
    expect(url.origin + url.pathname).toBe('https://github.com/Quoterg/iron-log/issues/new');
    expect(url.searchParams.get('title')).toBe('Data error: Mjölk 3% & grädde / Milk 3% & cream (slv:12)');
    expect(url.searchParams.get('body')).toContain('Source: Livsmedelsverket');
    expect(new URL(reportUrl('usda:9', 'Apples, raw', null)).searchParams.get('body')).toContain('Source: USDA FoodData Central');
  });

  it('offers reports only for built-in databases', () => {
    expect(databaseOf('slv:1')).toBe('Livsmedelsverket');
    expect(databaseOf('usda:1')).toBe('USDA FoodData Central');
    for (const ref of ['custom:x', 'recipe:x', 'off:7310865004703']) expect(databaseOf(ref)).toBeNull();
  });
});
