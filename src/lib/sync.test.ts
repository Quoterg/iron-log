import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from './db';

/** A simulated device: fresh modules with their own IndexedDB. */
async function device() {
  vi.resetModules();
  (globalThis as { indexedDB?: unknown }).indexedDB = new IDBFactory();
  const db = await import('./db');
  const sync = await import('./sync');
  await db.getSettings(); // open this device's database now, while its factory is the global one
  return { db, sync };
}
type Device = Awaited<ReturnType<typeof device>>;

/** One sync round over a JSON "wire", both directions. Returns [applied on a, applied on b]. */
async function syncPair(a: Device, b: Device): Promise<[number, number]> {
  const wire = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const [sa, sb] = [wire(await a.sync.summarize()), wire(await b.sync.summarize())];
  const [ca, cb] = [wire(await a.sync.changesFor(sb)), wire(await b.sync.changesFor(sa))];
  return [await a.sync.applyChanges(cb), await b.sync.applyChanges(ca)];
}

const entry = (id: string, grams = 100): Entry => ({ id, date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams, createdAt: 1 });
const ids = async (d: Device) => (await d.db.entriesFor('2026-10-09')).map((e) => e.id).sort();

const at = (t: number) => vi.spyOn(Date, 'now').mockReturnValue(t);

afterEach(() => vi.restoreAllMocks());

describe('device-to-device sync', () => {
  it('brings both devices to the union of their data, and a second round changes nothing', async () => {
    const a = await device();
    const b = await device();
    await a.db.putEntry(entry('a1'));
    await b.db.putEntry(entry('b1'));
    await b.db.putBody({ date: '2026-10-08', weightKg: 80, updatedAt: 1 });
    expect(await syncPair(a, b)).toEqual([2, 1]);
    expect(await ids(a)).toEqual(['a1', 'b1']);
    expect(await ids(b)).toEqual(['a1', 'b1']);
    expect((await a.db.listBody())[0].weightKg).toBe(80);
    expect(await syncPair(a, b)).toEqual([0, 0]);
  });

  it('deletions sync and do not come back', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await a.db.putEntry(entry('x'));
    await syncPair(a, b);
    at(2000);
    await a.db.deleteEntry('x');
    await syncPair(a, b);
    expect(await ids(b)).toEqual([]);
    await syncPair(a, b);
    expect(await ids(a)).toEqual([]);
  });

  it('the newest change wins a conflict, in either direction', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await a.db.putEntry(entry('e', 100));
    await syncPair(a, b);
    at(3000);
    await b.db.putEntry(entry('e', 300)); // newer
    at(2000);
    await a.db.putEntry(entry('e', 200)); // older, though edited "later" in wall order of this test
    await syncPair(a, b);
    expect((await a.db.getEntry('e'))?.grams).toBe(300);
    expect((await b.db.getEntry('e'))?.grams).toBe(300);
  });

  it('a newer edit beats an older deletion (and vice versa)', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await a.db.putEntry(entry('e'));
    await syncPair(a, b);
    at(2000);
    await a.db.deleteEntry('e');
    at(3000);
    await b.db.putEntry(entry('e', 250));
    await syncPair(a, b);
    expect((await a.db.getEntry('e'))?.grams).toBe(250);
  });

  it('syncs settings, water and records from before change tracking', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await a.db.saveSettings({ lang: 'sv', profile: { sex: 'male', kcal: 2600 }, targetOverrides: {}, version: 2 });
    await a.db.changeWater('2026-10-09', 500);
    // A record written before v9 (no meta): stored directly.
    await (await a.db.openDb()).put('usage', { foodRef: 'slv:9', count: 3, lastUsed: 1, lastGrams: 50 });
    await syncPair(a, b);
    expect((await b.db.getSettings())?.profile.kcal).toBe(2600);
    expect(await b.db.waterFor('2026-10-09')).toBe(500);
    expect((await b.db.listUsage()).map((u) => u.foodRef)).toContain('slv:9');
  });

  it('rejects invalid or mislabelled records without writing anything', async () => {
    const a = await device();
    const good = { k: 'entries:ok', mt: 5, v: entry('ok') };
    await expect(a.sync.applyChanges([good, { k: 'entries:bad', mt: 5, v: { ...entry('bad'), grams: -1 } }])).rejects.toThrow(a.sync.SyncError);
    await expect(a.sync.applyChanges([good, { k: 'entries:other', mt: 5, v: entry('not-other') }])).rejects.toThrow(/key mismatch/);
    await expect(a.sync.applyChanges([{ k: 'secrets:x', mt: 5, v: {} }])).rejects.toThrow(/unknown store/);
    expect(await a.db.getEntry('ok')).toBeUndefined();
  });

  it('a backup restore counts as a fresh change (it syncs onwards)', async () => {
    const a = await device();
    const b = await device();
    at(5000);
    await a.db.importAll({ entries: [entry('r')], customFoods: [], usage: [], servings: [], offFoods: [], recipes: [], body: [], activities: [], water: [] });
    await syncPair(a, b);
    expect(await ids(b)).toEqual(['r']);
  });
});
