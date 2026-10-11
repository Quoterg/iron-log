import { describe, expect, it } from 'vitest';
import { isoWeek, positives, previousWeek, weightChange } from './checkin';
import { NUTRIENT_INDEX, NUTRIENTS } from './nutrients';
import type { Target } from './targets';

describe('weekly check-in', () => {
  it('uses ISO weeks, Monday to Sunday', () => {
    expect(isoWeek('2026-10-11')).toEqual({ key: '2026-W41', start: '2026-10-05', end: '2026-10-11' }); // a Sunday
    expect(isoWeek('2026-10-12')).toEqual({ key: '2026-W42', start: '2026-10-12', end: '2026-10-18' }); // Monday
    expect(isoWeek('2027-01-01').key).toBe('2026-W53'); // a Friday in the last ISO week of 2026
    expect(isoWeek('2026-01-01').key).toBe('2026-W01'); // Thursday
    expect(previousWeek('2026-10-14')).toEqual({ key: '2026-W41', start: '2026-10-05', end: '2026-10-11' });
  });

  it('weight change compares the average weigh-in of the week with the week before', () => {
    const week = { start: '2026-10-05', end: '2026-10-11' };
    const w = [
      { date: '2026-09-29', kg: 80.4 }, { date: '2026-10-02', kg: 80.0 },
      { date: '2026-10-06', kg: 79.8 }, { date: '2026-10-10', kg: 79.6 },
    ];
    expect(weightChange(w, week)).toBe(-0.5);
    expect(weightChange(w.slice(2), week)).toBeNull(); // nothing the week before
  });

  it('credits at most two things that went well, only reliable ones', () => {
    const amounts = NUTRIENTS.map(() => 0);
    amounts[NUTRIENT_INDEX.kcal] = 2050;
    amounts[NUTRIENT_INDEX.fibre] = 27;
    amounts[NUTRIENT_INDEX.iron] = 16;
    const t: Record<string, Target> = { kcal: { min: 2000, max: null }, fibre: { min: 25, max: null }, iron: { min: 15, max: null } };
    const all = NUTRIENTS.map(() => true);
    expect(positives(amounts, t, 7, all)).toEqual([{ kind: 'logged', days: 7 }, { kind: 'energy' }]);
    expect(positives(amounts, t, 4, all)).toEqual([{ kind: 'energy' }, { kind: 'nutrient', key: 'fibre' }]);
    const noFibreData = all.map((v, i) => (i === NUTRIENT_INDEX.fibre ? false : v));
    expect(positives(amounts, t, 4, noFibreData)).toEqual([{ kind: 'energy' }, { kind: 'nutrient', key: 'iron' }]);
  });
});
