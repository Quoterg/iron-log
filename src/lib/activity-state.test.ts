import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeBackup, parseBackup } from './backup';
import type { AllData } from './db';

const empty = { entries: [], customFoods: [], usage: [], servings: [], offFoods: [], recipes: [], body: [], activities: [], water: [] };

describe('activity and water storage', () => {
  it('water changes add up and never go below 0, also when taps overlap', async () => {
    const db = await import('./db');
    await Promise.all([db.changeWater('2026-02-01', 200), db.changeWater('2026-02-01', 500), db.changeWater('2026-02-01', 200)]);
    expect(await db.waterFor('2026-02-01')).toBe(900);
    expect(await db.changeWater('2026-02-01', -2000)).toBe(0);
  });

  it('import keeps the larger daily water total', async () => {
    const db = await import('./db');
    await db.changeWater('2026-02-02', 1000);
    await db.importAll({ ...empty, water: [{ date: '2026-02-02', ml: 400 }] });
    expect(await db.waterFor('2026-02-02')).toBe(1000);
    await db.importAll({ ...empty, water: [{ date: '2026-02-02', ml: 1800 }] });
    expect(await db.waterFor('2026-02-02')).toBe(1800);
  });

  it('round-trips activities and water through a backup and back into storage', async () => {
    const db = await import('./db');
    const data: AllData = {
      ...empty,
      activities: [{ id: 'x1', date: '2026-02-03', type: 'walk', minutes: 45, kcal: 150, createdAt: 1 }],
      water: [{ date: '2026-02-03', ml: 1200 }],
      settings: { lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: {}, version: 2 },
    };
    await db.importAll(parseBackup(JSON.stringify(makeBackup(data))));
    expect(await db.activitiesFor('2026-02-03')).toEqual(data.activities);
    expect(await db.waterFor('2026-02-03')).toBe(1200);
  });
});

describe('activity backups', () => {
  const base: AllData = { ...empty, settings: { lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: {}, version: 2 } };
  const withActivity = (patch: object) =>
    JSON.stringify(
      makeBackup({ ...base, activities: [{ id: 'a', date: '2026-02-04', type: 'run10', minutes: 30, kcal: 300, createdAt: 1, ...patch }] }),
    );

  it('accepts activity ids this release does not know (the table may change)', () => {
    expect(parseBackup(withActivity({ type: 'removed-later' })).activities[0].type).toBe('removed-later');
  });

  it('rejects zero-minute and empty-type activities', () => {
    expect(() => parseBackup(withActivity({ minutes: 0 }))).toThrow();
    expect(() => parseBackup(withActivity({ type: '' }))).toThrow();
  });
});
