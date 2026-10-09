import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

describe('IndexedDB upgrade v1 → v2', () => {
  it('keeps existing diary entries and adds the custom foods store', async () => {
    // A database exactly as M1 created it.
    const v1 = await openDB('iron-log', 1, {
      upgrade(d) {
        d.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        d.createObjectStore('kv');
      },
    });
    await v1.put('entries', { id: 'e1', date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams: 80, createdAt: 1 });
    v1.close();

    const db = await import('./db');
    expect((await db.entriesFor('2026-10-09')).map((e) => e.id)).toEqual(['e1']);

    await db.putCustomFood({ ref: 'custom:a', sv: 'Proteinpulver', en: null, per100g: [380], createdAt: 1, updatedAt: 1 });
    await db.putCustomFood({ ref: 'custom:b', sv: 'Gammal', en: null, per100g: [100], createdAt: 1, updatedAt: 2, deleted: true });
    const foods = await db.listCustomFoods();
    expect(foods.map((f) => f.ref).sort()).toEqual(['custom:a', 'custom:b']);
    expect(foods.find((f) => f.ref === 'custom:b')?.deleted).toBe(true);
  });
});
