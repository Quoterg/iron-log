import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import { inSeason, scheduledOn, timeRank, weekday } from './supplements';

describe('supplement schedules', () => {
  it('winter supplements (M51) are in season October–March only; days still apply', () => {
    const d = { unit: 'tablett', perDay: 1, season: 'winter' as const };
    for (const date of ['2026-10-01', '2026-12-31', '2027-01-15', '2027-03-31']) expect(inSeason(d, date), date).toBe(true);
    for (const date of ['2026-04-01', '2026-06-15', '2026-09-30']) expect(inSeason(d, date), date).toBe(false);
    expect(scheduledOn(d, '2026-11-02')).toBe(true);
    expect(scheduledOn(d, '2026-06-15')).toBe(false);
    expect(scheduledOn({ ...d, days: [0] }, '2026-11-03')).toBe(false); // a Tuesday
    expect(inSeason({ unit: 'st', perDay: 1 }, '2026-06-15')).toBe(true); // all year
  });

  it('the season round-trips in a backup; an unknown one is refused', () => {
    const food = (supplement: object) => ({ ref: 'custom:d', sv: 'D-vitamin', en: null, per100g: [], createdAt: 1, updatedAt: 1, supplement });
    const back = (supplement: object) => parseBackup(JSON.stringify({ format: 'iron-log-backup', version: 1, entries: [], usage: [], customFoods: [food(supplement)] }));
    expect(back({ unit: 'tablett', perDay: 1, season: 'winter' }).customFoods[0].supplement).toEqual({ unit: 'tablett', perDay: 1, season: 'winter' });
    expect(() => back({ unit: 'tablett', perDay: 1, season: 'summer' })).toThrow();
  });

  it('weekday() is Monday-based and scheduledOn() respects days and as-needed', () => {
    expect(weekday('2026-10-05')).toBe(0); // a Monday
    expect(weekday('2026-10-11')).toBe(6); // a Sunday
    // Daylight-saving changes and a year boundary (local dates, no UTC shift).
    expect(weekday('2026-03-29')).toBe(6); // Sunday, clocks go forward in Europe
    expect(weekday('2026-10-25')).toBe(6); // Sunday, clocks go back
    expect(weekday('2026-12-31')).toBe(3); // Thursday
    expect(weekday('2027-01-01')).toBe(4); // Friday
    const mwf = { unit: 'tablett', perDay: 1, days: [0, 2, 4] };
    expect(['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => scheduledOn(mwf, d))).toEqual([true, false, true]);
    expect(scheduledOn({ unit: 'st', perDay: 1 }, '2026-10-06')).toBe(true); // every day
    expect(scheduledOn({ unit: 'st', perDay: 0 }, '2026-10-06')).toBe(false); // as needed: not on the checklist
    expect(timeRank({ unit: 'st', perDay: 1, time: 'morning' })).toBeLessThan(timeRank({ unit: 'st', perDay: 1, time: 'evening' }));
    expect(timeRank({ unit: 'st', perDay: 1 })).toBeGreaterThan(timeRank({ unit: 'st', perDay: 1, time: 'night' }));
  });

  it('backups validate days and time', () => {
    const food = { ref: 'custom:s', sv: 'D', en: null, per100g: [0], createdAt: 1, updatedAt: 1 };
    const text = (supplement: object) =>
      JSON.stringify(
        makeBackup({
          entries: [], usage: [], servings: [], offFoods: [], recipes: [], body: [], activities: [], water: [],
          customFoods: [{ ...food, supplement } as never],
        }),
      );
    expect(parseBackup(text({ unit: 'st', perDay: 1, days: [4, 0], time: 'evening' })).customFoods[0].supplement).toEqual({
      unit: 'st', perDay: 1, days: [0, 4], time: 'evening',
    });
    // All seven days is the same as no restriction.
    expect(parseBackup(text({ unit: 'st', perDay: 1, days: [0, 1, 2, 3, 4, 5, 6] })).customFoods[0].supplement).toEqual({ unit: 'st', perDay: 1 });
    for (const bad of [{ days: [] }, { days: [7] }, { days: [1, 1] }, { time: 'noon' }]) {
      expect(() => parseBackup(text({ unit: 'st', perDay: 1, ...bad }))).toThrow();
    }
  });

  it('sync rejects invalid schedules from another device (same validator as backups)', async () => {
    const { applyChanges } = await import('./sync');
    const v = { ref: 'custom:s', sv: 'D', en: null, per100g: [0], createdAt: 1, updatedAt: 1 };
    await expect(applyChanges([{ k: 'customFoods:custom:s', mt: 5, v: { ...v, supplement: { unit: 'st', perDay: 1, days: [9] } } }])).rejects.toThrow();
    const ok = await applyChanges([{ k: 'customFoods:custom:s', mt: 5, v: { ...v, supplement: { unit: 'st', perDay: 1, days: [2, 0] } } }]);
    expect(ok.count).toBe(1);
  });
});
