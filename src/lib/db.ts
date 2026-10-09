// User data lives on the device, in IndexedDB. Nothing is sent anywhere.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Food } from './nutrients';
import type { Profile } from './targets';

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface Entry {
  id: string;
  /** Local date, YYYY-MM-DD. */
  date: string;
  meal: Meal;
  foodRef: string;
  grams: number;
  createdAt: number;
}

export interface Settings {
  lang: 'sv' | 'en';
  profile: Profile;
  /** User overrides of target min values, by nutrient key. */
  targetOverrides: Record<string, number>;
}

/** A food the user created. Deleting only hides it, so past diary entries still resolve. */
export interface CustomFood extends Food {
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

/** How the user uses a food: drives "recent", favourites and search ranking. */
export interface Usage {
  foodRef: string;
  count: number;
  lastUsed: number;
  lastGrams: number;
  fav?: boolean;
}

interface Schema extends DBSchema {
  entries: { key: string; value: Entry; indexes: { date: string } };
  kv: { key: string; value: unknown };
  customFoods: { key: string; value: CustomFood };
  usage: { key: string; value: Usage };
}

let dbp: Promise<IDBPDatabase<Schema>> | undefined;

function db() {
  dbp ??= openDB<Schema>('iron-log', 3, {
    async upgrade(d, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        d.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        d.createObjectStore('kv');
      }
      if (oldVersion < 2) d.createObjectStore('customFoods', { keyPath: 'ref' });
      if (oldVersion < 3) {
        // Seed usage from the existing diary so recent/frequent foods work right away.
        const usage = d.createObjectStore('usage', { keyPath: 'foodRef' });
        const all = await tx.objectStore('entries').getAll();
        for (const u of usageFromEntries(all)) await usage.put(u);
      }
    },
  });
  return dbp;
}

export function usageFromEntries(entries: Entry[]): Usage[] {
  const map = new Map<string, Usage>();
  for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt)) {
    const u = map.get(e.foodRef);
    map.set(e.foodRef, {
      foodRef: e.foodRef,
      count: (u?.count ?? 0) + 1,
      lastUsed: e.createdAt,
      lastGrams: e.grams,
    });
  }
  return [...map.values()];
}

export async function listUsage(): Promise<Usage[]> {
  return (await db()).getAll('usage');
}

export async function putUsage(u: Usage): Promise<void> {
  await (await db()).put('usage', u);
}

export interface AllData {
  entries: Entry[];
  customFoods: CustomFood[];
  usage: Usage[];
  settings?: Settings;
}

export async function exportAll(): Promise<AllData> {
  const d = await db();
  const [entries, customFoods, usage, settings] = await Promise.all([
    d.getAll('entries'),
    d.getAll('customFoods'),
    d.getAll('usage'),
    d.get('kv', 'settings') as Promise<Settings | undefined>,
  ]);
  return { entries, customFoods, usage, settings };
}

/** Upsert everything in one transaction: items with the same id/ref are replaced, others kept. */
export async function importAll(data: AllData): Promise<void> {
  const tx = (await db()).transaction(['entries', 'customFoods', 'usage', 'kv'], 'readwrite');
  const puts: Promise<unknown>[] = [
    ...data.entries.map((e) => tx.objectStore('entries').put(e)),
    ...data.customFoods.map((f) => tx.objectStore('customFoods').put(f)),
    ...data.usage.map((u) => tx.objectStore('usage').put(u)),
  ];
  if (data.settings) puts.push(tx.objectStore('kv').put(data.settings, 'settings'));
  await Promise.all([...puts, tx.done]);
}

export async function clearAll(): Promise<void> {
  const tx = (await db()).transaction(['entries', 'customFoods', 'usage', 'kv'], 'readwrite');
  await Promise.all([
    tx.objectStore('entries').clear(),
    tx.objectStore('customFoods').clear(),
    tx.objectStore('usage').clear(),
    tx.objectStore('kv').clear(),
    tx.done,
  ]);
}

export async function putEntries(list: Entry[]): Promise<void> {
  const tx = (await db()).transaction('entries', 'readwrite');
  await Promise.all([...list.map((e) => tx.store.put(e)), tx.done]);
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await db()).get('entries', id);
}

export async function listCustomFoods(): Promise<CustomFood[]> {
  return (await db()).getAll('customFoods');
}

export async function putCustomFood(f: CustomFood): Promise<void> {
  await (await db()).put('customFoods', f);
}

export async function entriesFor(date: string): Promise<Entry[]> {
  const list = await (await db()).getAllFromIndex('entries', 'date', date);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putEntry(e: Entry): Promise<void> {
  await (await db()).put('entries', e);
}

export async function deleteEntry(id: string): Promise<void> {
  await (await db()).delete('entries', id);
}

export async function getSettings(): Promise<Settings | undefined> {
  return (await (await db()).get('kv', 'settings')) as Settings | undefined;
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await db()).put('kv', s, 'settings');
}

export function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}
