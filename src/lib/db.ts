// User data lives on the device, in IndexedDB. Nothing is sent anywhere.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Food, Serving } from './nutrients';
import type { MacroPct, MacroPreset, Profile, TargetOverride } from './targets';

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
  /** Household measure the user logged with, e.g. 2 × "st" (grams stays the source of truth). */
  unit?: string;
  qty?: number;
}

export interface Settings {
  lang: 'sv' | 'en';
  profile: Profile;
  /** User overrides of target min/max, by nutrient key. */
  targetOverrides: Record<string, TargetOverride>;
  macroPreset?: MacroPreset;
  /** Energy-percent ranges when macroPreset is 'custom'. */
  macroPct?: MacroPct;
  /** Format version of these settings (absent = before 2: NNR-style activity levels). */
  version?: number;
  /** One-time notice: the automatic energy target changed with the new formula. */
  energyNotice?: boolean;
}

/** Current settings format version. */
export const SETTINGS_VERSION = 2;

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
  lastUnit?: string;
  lastQty?: number;
  fav?: boolean;
}

/** A product from Open Food Facts, cached after the first lookup (works offline afterwards). */
export interface OffFood extends Food {
  fetchedAt: number;
}

/** The user's own measures for a food ("min skål" = 300 g). */
export interface UserServings {
  foodRef: string;
  servings: Serving[];
}

interface Schema extends DBSchema {
  entries: { key: string; value: Entry; indexes: { date: string } };
  kv: { key: string; value: unknown };
  customFoods: { key: string; value: CustomFood };
  usage: { key: string; value: Usage };
  servings: { key: string; value: UserServings };
  offFoods: { key: string; value: OffFood };
}

let dbp: Promise<IDBPDatabase<Schema>> | undefined;

function db() {
  dbp ??= openDB<Schema>('iron-log', 5, {
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
      if (oldVersion < 4) d.createObjectStore('servings', { keyPath: 'foodRef' });
      if (oldVersion < 5) d.createObjectStore('offFoods', { keyPath: 'ref' });
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
  servings: UserServings[];
  offFoods: OffFood[];
  settings?: Settings;
}

export async function exportAll(): Promise<AllData> {
  const d = await db();
  const [entries, customFoods, usage, servings, offFoods, settings] = await Promise.all([
    d.getAll('entries'),
    d.getAll('customFoods'),
    d.getAll('usage'),
    d.getAll('servings'),
    d.getAll('offFoods'),
    d.get('kv', 'settings') as Promise<Settings | undefined>,
  ]);
  return { entries, customFoods, usage, servings, offFoods, settings };
}

/** Upsert everything in one transaction: items with the same id/ref are replaced, others kept. */
export async function importAll(data: AllData): Promise<void> {
  const tx = (await db()).transaction(['entries', 'customFoods', 'usage', 'servings', 'offFoods', 'kv'], 'readwrite');
  const puts: Promise<unknown>[] = [
    ...data.offFoods.map((f) => tx.objectStore('offFoods').put(f)),
    ...data.entries.map((e) => tx.objectStore('entries').put(e)),
    ...data.customFoods.map((f) => tx.objectStore('customFoods').put(f)),
    ...data.usage.map((u) => tx.objectStore('usage').put(u)),
    ...data.servings.map((s) => tx.objectStore('servings').put(s)),
  ];
  if (data.settings) puts.push(tx.objectStore('kv').put(data.settings, 'settings'));
  await Promise.all([...puts, tx.done]);
}

export async function clearAll(): Promise<void> {
  const tx = (await db()).transaction(['entries', 'customFoods', 'usage', 'servings', 'offFoods', 'kv'], 'readwrite');
  await Promise.all([
    tx.objectStore('offFoods').clear(),
    tx.objectStore('entries').clear(),
    tx.objectStore('customFoods').clear(),
    tx.objectStore('usage').clear(),
    tx.objectStore('servings').clear(),
    tx.objectStore('kv').clear(),
    tx.done,
  ]);
}

export async function listOffFoods(): Promise<OffFood[]> {
  return (await db()).getAll('offFoods');
}

export async function getOffFood(ref: string): Promise<OffFood | undefined> {
  return (await db()).get('offFoods', ref);
}

export async function putOffFood(f: OffFood): Promise<void> {
  await (await db()).put('offFoods', f);
}

export async function listServings(): Promise<UserServings[]> {
  return (await db()).getAll('servings');
}

export async function putServings(s: UserServings): Promise<void> {
  await (await db()).put('servings', s);
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
