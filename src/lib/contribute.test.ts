import { describe, expect, it } from 'vitest';
import { offAddUrl, offProductUrl, reportUrl } from './contribute';

describe('contribution links', () => {
  it('point at Open Food Facts product and add pages', () => {
    expect(offProductUrl('7310865004703')).toBe('https://world.openfoodfacts.org/product/7310865004703');
    expect(offAddUrl('7310865004703')).toContain('code=7310865004703');
  });

  it('prefill a GitHub issue with the food, safely encoded', () => {
    const url = new URL(reportUrl('slv:12', 'Mjölk 3% & grädde', 'Livsmedelsverket'));
    expect(url.origin + url.pathname).toBe('https://github.com/Quoterg/iron-log/issues/new');
    expect(url.searchParams.get('title')).toBe('Data error: Mjölk 3% & grädde (slv:12)');
    expect(url.searchParams.get('body')).toContain('Source: Livsmedelsverket');
  });
});
