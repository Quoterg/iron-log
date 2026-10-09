import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AllData, Entry } from './db';

/** A simulated device: fresh modules with their own IndexedDB (optionally seeded as a v8 database). */
async function device(seedV8?: (db: IDBDatabase) => void) {
  vi.resetModules();
  const factory = new IDBFactory();
  (globalThis as { indexedDB?: unknown }).indexedDB = factory;
  if (seedV8) {
    await new Promise<void>((ok) => {
      const req = factory.open('iron-log', 8);
      req.onupgradeneeded = () => {
        const d = req.result;
        d.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        d.createObjectStore('kv');
        for (const s of ['customFoods', 'offFoods', 'recipes']) d.createObjectStore(s, { keyPath: 'ref' });
        for (const s of ['usage', 'servings']) d.createObjectStore(s, { keyPath: 'foodRef' });
        for (const s of ['body', 'water']) d.createObjectStore(s, { keyPath: 'date' });
        d.createObjectStore('activities', { keyPath: 'id' }).createIndex('date', 'date');
      };
      req.onsuccess = () => {
        const d = req.result;
        const tx = d.transaction(['entries', 'usage'], 'readwrite');
        seedV8(tx as unknown as IDBDatabase);
        tx.oncomplete = () => {
          d.close();
          ok();
        };
      };
    });
  }
  const db = await import('./db');
  const sync = await import('./sync');
  await db.getSettings(); // open (and upgrade) this device's database while its factory is global
  return { db, sync };
}
type Device = Awaited<ReturnType<typeof device>>;

/** One sync round over a JSON "wire", both directions. Returns how many records changed on a, b. */
async function syncPair(a: Device, b: Device): Promise<[number, number]> {
  const wire = <T>(x: T): T => JSON.parse(JSON.stringify(x));
  const [sa, sb] = [await a.sync.summarize(), await b.sync.summarize()];
  const [ca, cb] = [wire(await a.sync.changesFor(wire(sb), sa)), wire(await b.sync.changesFor(wire(sa), sb))];
  return [(await a.sync.applyChanges(cb)).count, (await b.sync.applyChanges(ca)).count];
}

const entry = (id: string, grams = 100, createdAt = 1): Entry => ({ id, date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams, createdAt });
const ids = async (d: Device) => (await d.db.entriesFor('2026-10-09')).map((e) => e.id).sort();
const empty: AllData = { entries: [], customFoods: [], usage: [], servings: [], offFoods: [], recipes: [], body: [], activities: [], water: [] };
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
    await b.db.putEntry(entry('e', 300));
    at(2000);
    await a.db.putEntry(entry('e', 200));
    await syncPair(a, b);
    expect((await a.db.getEntry('e'))?.grams).toBe(300);
    expect((await b.db.getEntry('e'))?.grams).toBe(300);
  });

  it('a newer edit beats an older deletion', async () => {
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

  it('syncs settings (keeping each device’s language and databases) and water', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await b.db.saveSettings({ lang: 'en', profile: { sex: 'female', kcal: 2000 }, targetOverrides: {}, version: 2, sources: ['slv', 'usda'] });
    at(2000);
    await a.db.saveSettings({ lang: 'sv', profile: { sex: 'male', kcal: 2600 }, targetOverrides: {}, version: 2, sources: ['slv'] });
    await a.db.changeWater('2026-10-09', 500);
    await syncPair(a, b);
    const s = await b.db.getSettings();
    expect(s?.profile.kcal).toBe(2600);
    expect([s?.lang, s?.sources]).toEqual(['en', ['slv', 'usda']]);
    expect(await b.db.waterFor('2026-10-09')).toBe(500);
  });

  it('usage counts keep the larger count', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await a.db.putUsage({ foodRef: 'slv:9', count: 12, lastUsed: 1000, lastGrams: 50 });
    at(2000);
    await b.db.putUsage({ foodRef: 'slv:9', count: 2, lastUsed: 2000, lastGrams: 80 });
    await syncPair(a, b);
    const u = (await a.db.listUsage())[0];
    expect([u.count, u.lastGrams]).toEqual([12, 80]);
  });

  it('records from before change tracking (v8) are stamped on upgrade and sync', async () => {
    const a = await device((tx) => {
      const t = tx as unknown as IDBTransaction;
      t.objectStore('usage').put({ foodRef: 'slv:9', count: 3, lastUsed: 1, lastGrams: 50 });
      t.objectStore('entries').put(entry('old'));
    });
    const b = await device();
    expect(Object.keys(await a.sync.summarize()).sort()).toEqual(['entries:old', 'usage:slv:9']);
    await syncPair(a, b);
    expect(await ids(b)).toEqual(['old']);
    expect((await b.db.listUsage()).map((u) => u.foodRef)).toEqual(['slv:9']);
  });

  it('rejects invalid or mislabelled records without writing anything', async () => {
    const a = await device();
    const good = { k: 'entries:ok', mt: 5, v: entry('ok') };
    await expect(a.sync.applyChanges([good, { k: 'entries:bad', mt: 5, v: { ...entry('bad'), grams: -1 } }])).rejects.toThrow(a.sync.SyncError);
    await expect(a.sync.applyChanges([good, { k: 'entries:other', mt: 5, v: entry('not-other') }])).rejects.toThrow(/key mismatch/);
    await expect(a.sync.applyChanges([{ k: 'secrets:x', mt: 5, v: {} }])).rejects.toThrow(/unknown store/);
    expect(await a.db.getEntry('ok')).toBeUndefined();
  });

  it('caps change times from a device with a clock far ahead', async () => {
    const a = await device();
    await a.sync.applyChanges([{ k: 'entries:e', mt: 1e15, v: entry('e', 100) }], 10_000);
    expect((await a.sync.summarize(10_000))['entries:e']).toBe(10_000 + 5 * 60_000);
    at(10_000 + 10 * 60_000); // ten minutes later, a local edit wins
    await a.db.putEntry(entry('e', 200));
    expect((await a.db.getEntry('e'))?.grams).toBe(200);
    await a.sync.applyChanges([{ k: 'entries:e', mt: 1e15, v: entry('e', 999) }], 10_000);
    expect((await a.db.getEntry('e'))?.grams).toBe(200);
  });

  it('prunes tombstones after 90 days', async () => {
    const a = await device();
    at(1000);
    await a.db.putEntry(entry('x'));
    await a.db.deleteEntry('x');
    expect(await a.sync.summarize(2000)).toHaveProperty(['entries:x']);
    expect(await a.sync.summarize(1000 + 91 * 864e5)).not.toHaveProperty(['entries:x']);
  });

  it('a backup restore never brings back a later deletion, here or on a paired device', async () => {
    const a = await device();
    const b = await device();
    at(1000);
    await a.db.putEntry(entry('r', 100, 1000));
    await syncPair(a, b);
    at(5000);
    await a.db.deleteEntry('r');
    await syncPair(a, b);
    at(9000);
    await a.db.importAll({ ...empty, entries: [entry('r', 100, 1000)] }); // an old backup
    expect(await ids(a)).toEqual([]);
    await syncPair(a, b);
    expect(await ids(b)).toEqual([]);
  });

  it('a backup restore adds missing records with their own time and keeps newer local copies', async () => {
    const a = await device();
    const b = await device();
    at(5000);
    await a.db.putEntry(entry('kept', 300, 1000)); // edited here after the backup was made
    await a.db.importAll({ ...empty, entries: [entry('kept', 100, 1000), entry('missing', 50, 2000)] });
    expect((await a.db.getEntry('kept'))?.grams).toBe(300);
    expect((await a.sync.summarize(5000))['entries:missing']).toBe(2000);
    await syncPair(a, b);
    expect(await ids(b)).toEqual(['kept', 'missing']);
  });

  it('a first sync of a few thousand records is complete and quick', async () => {
    const a = await device();
    const b = await device();
    await a.db.putEntries(Array.from({ length: 3000 }, (_, i) => entry(`n${i}`)));
    const t0 = performance.now();
    expect(await syncPair(a, b)).toEqual([0, 3000]);
    expect((await b.db.entriesFor('2026-10-09')).length).toBe(3000);
    expect(performance.now() - t0).toBeLessThan(10_000);
  });
});
