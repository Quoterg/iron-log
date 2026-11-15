import { describe, expect, it } from 'vitest';
import { lang } from './i18n';
import { leftText } from './totals';

describe('what is left of the day (M63)', () => {
  it('says what is left, rounded, in plain words', () => {
    lang.value = 'sv';
    // fmt groups thousands with a no-break space in Swedish.
    expect(leftText(1618.4, 'kcal').replace(/\s/g, ' ')).toBe('1 618 kcal kvar');
    expect(leftText(0, 'kcal')).toBe('0 kcal kvar');
  });

  it('says how far over the target, without a minus sign', () => {
    lang.value = 'sv';
    expect(leftText(-120, 'kcal')).toBe('120 kcal över målet');
  });

  it('a fraction over still reads as nothing left, not "0 över"', () => {
    lang.value = 'sv';
    expect(leftText(-0.4, 'kcal')).toBe('0 kcal kvar');
  });
});
