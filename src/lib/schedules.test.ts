import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import { scheduledOn, timeRank, weekday } from './supplements';

describe('supplement schedules', () => {
  it('weekday() is Monday-based and scheduledOn() respects days and as-needed', () => {
    expect(weekday('2026-10-05')).toBe(0); // a Monday
    expect(weekday('2026-10-11')).toBe(6); // a Sunday
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
});
