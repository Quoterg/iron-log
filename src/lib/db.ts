// User data lives on the device, in IndexedDB. Nothing is sent anywhere.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Food, Serving } from './nutrients';
import { MAX_WATER_ML, type Activity, type Water } from './activity';
import type { BodyEntry } from './body';
import type { StoredRecipe } from './recipes';
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
  /**
   * Per-100 g values when logged, for foods whose values can change later (recipes): editing a
   * recipe must not rewrite past days.
   */
  snap?: (number | null)[];
}

/** Nutrient values (per 100 g) to use for an entry: its snapshot if any, else the food's current ones. */
export function entryVector(e: Entry, foods: Map<string, Food>): (number | null)[] | undefined {
  return e.snap ?? foods.get(e.foodRef)?.per100g;
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
  /** Food databases to search (default by language: Swedish → Livsmedelsverket; English → both). */
  sources?: ('slv' | 'usda')[];
  /** Add the day's exercise energy to the day's energy target. */
  addBurnedToTarget?: boolean;
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
  recipes: { key: string; value: StoredRecipe };
  body: { key: string; value: BodyEntry };
  activities: { key: string; value: Activity; indexes: { date: string } };
  water: { key: string; value: Water };
}

let dbp: Promise<IDBPDatabase<Schema>> | undefined;

function db() {
  dbp ??= openDB<Schema>('iron-log', 8, {
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
      if (oldVersion < 6) d.createObjectStore('recipes', { keyPath: 'ref' });
      if (oldVersion < 7) d.createObjectStore('body', { keyPath: 'date' });
      if (oldVersion < 8) {
        d.createObjectStore('activities', { keyPath: 'id' }).createIndex('date', 'date');
        d.createObjectStore('water', { keyPath: 'date' });
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
  servings: UserServings[];
  offFoods: OffFood[];
  recipes: StoredRecipe[];
  body: BodyEntry[];
  activities: Activity[];
  water: Water[];
  settings?: Settings;
}

export async function exportAll(): Promise<AllData> {
  const d = await db();
  const [entries, customFoods, usage, servings, offFoods, recipes, body, activities, water, settings] = await Promise.all([
    d.getAll('entries'),
    d.getAll('customFoods'),
    d.getAll('usage'),
    d.getAll('servings'),
    d.getAll('offFoods'),
    d.getAll('recipes'),
    d.getAll('body'),
    d.getAll('activities'),
    d.getAll('water'),
    d.get('kv', 'settings') as Promise<Settings | undefined>,
  ]);
  return { entries, customFoods, usage, servings, offFoods, recipes, body, activities, water, settings };
}

/** Upsert everything in one transaction: items with the same id/ref are replaced, others kept. */
export async function importAll(data: AllData): Promise<void> {
  const tx = (await db()).transaction(
    ['entries', 'customFoods', 'usage', 'servings', 'offFoods', 'recipes', 'body', 'activities', 'water', 'kv'],
    'readwrite',
  );
  // Recipes and custom foods: keep whichever version is newer (an old backup must not undo edits).
  const newest = async <S extends 'recipes' | 'customFoods' | 'body'>(store: S, items: Schema[S]['value'][]) => {
    const os = tx.objectStore(store);
    for (const item of items) {
      const key = 'ref' in item ? item.ref : (item as BodyEntry).date;
      const cur = await os.get(key);
      if (!cur || cur.updatedAt <= item.updatedAt) await os.put(item as never);
    }
  };
  const puts: Promise<unknown>[] = [
    newest('recipes', data.recipes),
    newest('customFoods', data.customFoods),
    newest('body', data.body),
    ...data.activities.map((a) => tx.objectStore('activities').put(a)),
    // Water: the larger total wins (a day only ever adds up).
    ...data.water.map(async (w) => {
      const cur = await tx.objectStore('water').get(w.date);
      if (!cur || cur.ml < w.ml) await tx.objectStore('water').put(w);
    }),
    ...data.offFoods.map((f) => tx.objectStore('offFoods').put(f)),
    ...data.entries.map((e) => tx.objectStore('entries').put(e)),
    ...data.usage.map((u) => tx.objectStore('usage').put(u)),
    ...data.servings.map((s) => tx.objectStore('servings').put(s)),
  ];
  if (data.settings) puts.push(tx.objectStore('kv').put(data.settings, 'settings'));
  await Promise.all([...puts, tx.done]);
}

export async function clearAll(): Promise<void> {
  const tx = (await db()).transaction(
    ['entries', 'customFoods', 'usage', 'servings', 'offFoods', 'recipes', 'body', 'activities', 'water', 'kv'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('activities').clear(),
    tx.objectStore('water').clear(),
    tx.objectStore('body').clear(),
    tx.objectStore('recipes').clear(),
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

export async function activitiesFor(date: string): Promise<Activity[]> {
  return (await db()).getAllFromIndex('activities', 'date', date);
}

export async function putActivity(a: Activity): Promise<void> {
  await (await db()).put('activities', a);
}

export async function deleteActivity(id: string): Promise<void> {
  await (await db()).delete('activities', id);
}

export async function waterFor(date: string): Promise<number> {
  return (await (await db()).get('water', date))?.ml ?? 0;
}

/** Add `deltaMl` (may be negative) to a day's water in one transaction; returns the new total. */
export async function changeWater(date: string, deltaMl: number): Promise<number> {
  const tx = (await db()).transaction('water', 'readwrite');
  const cur = (await tx.store.get(date))?.ml ?? 0;
  const ml = Math.min(MAX_WATER_ML, Math.max(0, cur + deltaMl));
  await tx.store.put({ date, ml });
  await tx.done;
  return ml;
}

export async function listBody(): Promise<BodyEntry[]> {
  return (await db()).getAll('body');
}

export async function putBody(e: BodyEntry): Promise<void> {
  await (await db()).put('body', e);
}

export async function deleteBody(date: string): Promise<void> {
  await (await db()).delete('body', date);
}

export async function listRecipes(): Promise<StoredRecipe[]> {
  return (await db()).getAll('recipes');
}

export async function putRecipe(r: StoredRecipe): Promise<void> {
  await (await db()).put('recipes', r);
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

/** All entries from `from` to `to` (inclusive, YYYY-MM-DD) via the date index. */
export async function entriesBetween(from: string, to: string): Promise<Entry[]> {
  return (await db()).getAllFromIndex('entries', 'date', IDBKeyRange.bound(from, to));
}

/**
 * Logged dates walking back from `today` (unique index keys only — no entries loaded), stopping at
 * the first gap of more than one day: enough for the streak, O(streak) instead of O(history).
 */
export async function recentLoggedDates(today: string): Promise<Set<string>> {
  const out = new Set<string>();
  const index = (await db()).transaction('entries').store.index('date');
  let cur = await index.openKeyCursor(IDBKeyRange.upperBound(today), 'prevunique');
  let expected = today;
  while (cur) {
    const d = cur.key;
    // Allow "today not logged yet": the first expected day may be today or yesterday.
    if (d !== expected && !(out.size === 0 && d === addDays(today, -1))) break;
    out.add(d);
    expected = addDays(d, -1);
    cur = await cur.continue();
  }
  return out;
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
