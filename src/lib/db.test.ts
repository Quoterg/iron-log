import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

describe('IndexedDB upgrade v1 → v3', () => {
  it('keeps diary entries, adds custom foods, and seeds usage from the diary', async () => {
    // A database exactly as M1 created it.
    const v1 = await openDB('iron-log', 1, {
      upgrade(d) {
        d.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        d.createObjectStore('kv');
      },
    });
    await v1.put('entries', { id: 'e1', date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams: 80, createdAt: 1 });
    await v1.put('entries', { id: 'e2', date: '2026-10-10', meal: 'lunch', foodRef: 'slv:1', grams: 120, createdAt: 2 });
    v1.close();

    const db = await import('./db');
    expect((await db.entriesFor('2026-10-09')).map((e) => e.id)).toEqual(['e1']);
    expect(await db.listUsage()).toEqual([{ foodRef: 'slv:1', count: 2, lastUsed: 2, lastGrams: 120 }]);

    await db.putCustomFood({ ref: 'custom:a', sv: 'Proteinpulver', en: null, per100g: [380], createdAt: 1, updatedAt: 1 });
    await db.putCustomFood({ ref: 'custom:b', sv: 'Gammal', en: null, per100g: [100], createdAt: 1, updatedAt: 2, deleted: true });
    const foods = await db.listCustomFoods();
    expect(foods.map((f) => f.ref).sort()).toEqual(['custom:a', 'custom:b']);
    expect(foods.find((f) => f.ref === 'custom:b')?.deleted).toBe(true);
    // v5 → v6 added the recipes store (empty after upgrade).
    expect(await db.listRecipes()).toEqual([]);
  });

  it('deletes several entries in one go, each leaving a tombstone so the deletion syncs (M41)', async () => {
    const db = await import('./db');
    await db.putEntries([
      { id: 'm1', date: '2026-11-05', meal: 'breakfast', foodRef: 'slv:1', grams: 60, createdAt: 10 },
      { id: 'm2', date: '2026-11-05', meal: 'breakfast', foodRef: 'slv:2', grams: 120, createdAt: 11 },
      { id: 'm3', date: '2026-11-05', meal: 'lunch', foodRef: 'slv:1', grams: 80, createdAt: 12 },
    ]);
    await db.deleteEntries(['m1', 'm2']);
    expect((await db.entriesFor('2026-11-05')).map((e) => e.id)).toEqual(['m3']);
    const meta = await (await openDB('iron-log')).getAll('meta');
    expect(meta.filter((m: { del?: boolean }) => m.del).length).toBeGreaterThanOrEqual(2);
  });
});
