import { describe, expect, it } from 'vitest';
import { mergeUsage, usageFromEntries } from './db';
import { fmtUnit, lang } from './i18n';
import { DEFAULT_PROFILE, defaultTarget, profileUpdate, type Profile } from './targets';

describe('the energy target follows a filled profile unless typed (M71)', () => {
  const man: Profile = { sex: 'male', kcal: 2500 }; // chose "Man" on the standard profile: the default
  const body = { age: 40, weightKg: 80, heightCm: 180 };

  it('a default target becomes the profile’s once the profile can estimate it', () => {
    const p = profileUpdate(man, body, false);
    expect(p.kcalAuto).toBe(true);
    expect(profileUpdate(DEFAULT_PROFILE, { ...body, sex: 'female', standard: undefined }, false).kcalAuto).toBe(true);
  });

  it('a typed target stays, also an old one (before kcalTyped) that is no default', () => {
    expect(profileUpdate({ ...man, kcalTyped: true }, body, false).kcalAuto).toBeFalsy();
    expect(profileUpdate({ sex: 'male', kcal: 2300 }, body, false).kcalAuto).toBeFalsy();
    expect(defaultTarget({ sex: 'female', kcal: 2000 })).toBe(true);
    expect(defaultTarget({ sex: 'female', kcal: 2000, kcalTyped: true })).toBe(false);
  });

  it('not while the target follows the measured expenditure, nor without enough data', () => {
    expect(profileUpdate(man, body, true).kcalAuto).toBeFalsy();
    expect(profileUpdate(man, { age: 40 }, false).kcalAuto).toBeFalsy();
  });
});

describe('use counts after a restore (M71)', () => {
  const e = (id: string, foodRef: string, createdAt: number, grams = 100, unit?: string, qty?: number) =>
    ({ id, date: '2026-11-01', meal: 'lunch', foodRef, grams, createdAt, ...(unit ? { unit, qty } : {}) }) as const;
  const diary = usageFromEntries([e('1', 'slv:a', 10), e('2', 'slv:a', 20, 120, 'st', 1), e('3', 'slv:b', 5)]);

  it('the diary gives counts and the last amount, with its measure', () => {
    expect(diary.find((u) => u.foodRef === 'slv:a')).toEqual({ foodRef: 'slv:a', count: 2, lastUsed: 20, lastGrams: 120, lastUnit: 'st', lastQty: 1 });
  });

  it('missing foods are added; known ones keep favourites and gain a larger count or a later use', () => {
    const stored = [
      { foodRef: 'slv:a', count: 1, lastUsed: 30, lastGrams: 50, fav: true },
      { foodRef: 'slv:b', count: 9, lastUsed: 99, lastGrams: 70 },
    ];
    const out = mergeUsage(stored, diary);
    expect(out).toEqual([{ foodRef: 'slv:a', count: 2, lastUsed: 30, lastGrams: 50, fav: true }]);
    expect(mergeUsage([], diary)).toEqual(diary);
    expect(mergeUsage(diary, diary)).toEqual([]); // nothing new: nothing written
  });
});

describe('one rounding rule per unit (M71)', () => {
  it('energy in whole kcal; other units whole from 10, one decimal from 1, two below', () => {
    lang.value = 'sv';
    expect(fmtUnit(74.8, 'kcal')).toBe('75');
    expect(fmtUnit(6.66, 'g')).toBe('6,7');
    expect(fmtUnit(50, 'g')).toBe('50');
    expect(fmtUnit(12.4, 'mg')).toBe('12');
    expect(fmtUnit(0.254, 'mg')).toBe('0,25');
  });
});

describe('review fixes (M71)', () => {
  const body = { age: 40, weightKg: 80, heightCm: 180 };
  it('a legacy default-valued target on a complete profile is never taken over', () => {
    const legacy: Profile = { sex: 'female', kcal: 2000, ...body };
    expect(profileUpdate(legacy, { weightKg: 80.1 }, false).kcalAuto).toBeFalsy();
  });
  it('a deliberately chosen manual target counts as typed', () => {
    const chosen: Profile = { sex: 'female', kcal: 2000, kcalTyped: true };
    expect(profileUpdate(chosen, body, false).kcalAuto).toBeFalsy();
  });
});
