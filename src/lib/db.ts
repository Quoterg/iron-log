// User data lives on the device, in IndexedDB. Nothing is sent anywhere (device-to-device sync,
// lib/sync.ts, only runs when the user pairs two of their own devices).
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Lang } from './i18n';
import type { Food, Serving } from './nutrients';
import { MAX_WATER_ML, type Activity, type Water } from './activity';
import type { BodyEntry } from './body';
import type { StoredRecipe } from './recipes';
import type { SupplementInfo } from './supplements';
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
  lang: Lang;
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
  /** Set for supplements (values per unit, see lib/supplements.ts). */
  supplement?: SupplementInfo;
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
  /** Sync bookkeeping: `${store}:${key}` → when the record last changed, or was deleted. */
  meta: { key: string; value: Meta };
}

/** The stores that sync between devices (kv: only the 'settings' key exists). */
export type SyncStore = 'entries' | 'customFoods' | 'usage' | 'servings' | 'offFoods' | 'recipes' | 'body' | 'activities' | 'water' | 'kv';
export const SYNC_STORES: SyncStore[] = ['entries', 'customFoods', 'usage', 'servings', 'offFoods', 'recipes', 'body', 'activities', 'water', 'kv'];

/** Last change of a record (ms since epoch); `del` marks a deletion so it can't come back on sync. */
export interface Meta {
  mt: number;
  del?: true;
}

export const metaKey = (store: SyncStore, key: string) => `${store}:${key}`;

/** Where each synced store keeps its key (kv is keyed explicitly: only 'settings'). */
export const KEY_PATH: Record<Exclude<SyncStore, 'kv'>, string> = {
  entries: 'id',
  customFoods: 'ref',
  usage: 'foodRef',
  servings: 'foodRef',
  offFoods: 'ref',
  recipes: 'ref',
  body: 'date',
  activities: 'id',
  water: 'date',
};

let dbp: Promise<IDBPDatabase<Schema>> | undefined;

function db() {
  dbp ??= openDB<Schema>('iron-log', 9, {
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
      if (oldVersion < 9) {
        // Stamp every existing record now, so the change log covers everything (sync reads only
        // the log) and devices holding different pre-v9 versions of a record still converge.
        const meta = d.createObjectStore('meta');
        const mt = Date.now();
        for (const store of SYNC_STORES) {
          const keys = store === 'kv' ? ((await tx.objectStore('kv').get('settings')) ? ['settings'] : []) : await tx.objectStore(store).getAllKeys();
          for (const key of keys) await meta.put({ mt }, metaKey(store, String(key)));
        }
      }
    },
  });
  return dbp;
}

/** The database, for the sync engine (lib/sync.ts). Everything else goes through the functions here. */
export const openDb = () => db();

/**
 * Write records and record the change for sync, in one transaction. Every write to a synced store
 * goes through here (or stamps meta itself), so sync can never miss a change.
 */
async function put<S extends SyncStore>(store: S, values: Schema[S]['value'][], key?: string): Promise<void> {
  const tx = (await db()).transaction([store, 'meta'], 'readwrite');
  const mt = Date.now();
  const os = tx.objectStore(store) as unknown as { put(v: unknown, k?: string): Promise<IDBValidKey> };
  const writes = values.map(async (v) => {
    const k = await os.put(v, key);
    await tx.objectStore('meta').put({ mt }, metaKey(store, String(k)));
  });
  await Promise.all([...writes, tx.done]);
}

/** Delete a record and leave a tombstone, so the deletion syncs instead of the record coming back. */
async function del(store: SyncStore, key: string): Promise<void> {
  const tx = (await db()).transaction([store, 'meta'], 'readwrite');
  await Promise.all([tx.objectStore(store).delete(key), tx.objectStore('meta').put({ mt: Date.now(), del: true }, metaKey(store, key)), tx.done]);
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
  await put('usage', [u]);
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

/**
 * Restore a backup in one transaction. A restore only adds what is missing or older here: it never
 * writes over a newer local copy or over a later deletion, and restored records keep their own
 * change time (not "now") — so restoring an old backup can't undo newer edits, here or, via sync,
 * on a paired device.
 */
export async function importAll(data: AllData): Promise<void> {
  const tx = (await db()).transaction([...SYNC_STORES, 'meta'], 'readwrite');
  const meta = tx.objectStore('meta');
  const restore = async <S extends SyncStore>(
    store: S,
    item: Schema[S]['value'],
    key: string,
    mt: number,
    replaces: (cur: Schema[S]['value']) => boolean = () => false,
  ) => {
    const m = await meta.get(metaKey(store, key));
    if (m?.del && m.mt >= mt) return; // deleted after this copy was made
    const os = tx.objectStore(store) as unknown as { get(k: string): Promise<Schema[S]['value'] | undefined>; put(v: unknown, k?: string): Promise<unknown> };
    const cur = await os.get(key);
    if (cur !== undefined && !replaces(cur)) return;
    await os.put(item, store === 'kv' ? key : undefined);
    await meta.put({ mt: Math.max(mt, m && !m.del ? m.mt : 0) }, metaKey(store, key));
  };
  const puts: Promise<unknown>[] = [
    // Recipes, custom foods, body: the newer version wins (an old backup must not undo edits).
    ...data.recipes.map((r) => restore('recipes', r, r.ref, r.updatedAt, (cur) => cur.updatedAt < r.updatedAt)),
    ...data.customFoods.map((f) => restore('customFoods', f, f.ref, f.updatedAt, (cur) => cur.updatedAt < f.updatedAt)),
    ...data.body.map((b) => restore('body', b, b.date, b.updatedAt, (cur) => cur.updatedAt < b.updatedAt)),
    // Water: the larger total wins (a day only ever adds up). Raising a total here is a change now;
    // a day that was missing keeps time 0, so a paired device's own value for it wins.
    ...data.water.map(async (w) => {
      const cur = await tx.objectStore('water').get(w.date);
      if (cur && cur.ml >= w.ml) return;
      await tx.objectStore('water').put(w);
      await meta.put({ mt: cur ? Date.now() : 0 }, metaKey('water', w.date));
    }),
    // The rest: added when missing, kept when present.
    ...data.entries.map((e) => restore('entries', e, e.id, e.createdAt)),
    ...data.activities.map((a) => restore('activities', a, a.id, a.createdAt)),
    ...data.offFoods.map((f) => restore('offFoods', f, f.ref, f.fetchedAt)),
    ...data.usage.map((u) => restore('usage', u, u.foodRef, u.lastUsed)),
    ...data.servings.map((sv) => restore('servings', sv, sv.foodRef, 0)),
  ];
  // Settings from a backup replace this device's (the user chose to restore them).
  if (data.settings) {
    puts.push(tx.objectStore('kv').put(data.settings, 'settings').then(() => meta.put({ mt: Date.now() }, metaKey('kv', 'settings'))));
  }
  await Promise.all([...puts, tx.done]);
}

/**
 * Erase this device. Device-local on purpose: the change log is cleared too, so a later sync with a
 * paired device copies its data back (like reinstalling) — wiping a phone before giving it away must
 * never delete the data on the user's other devices.
 */
export async function clearAll(): Promise<void> {
  const tx = (await db()).transaction([...SYNC_STORES, 'meta'], 'readwrite');
  await Promise.all([
    tx.objectStore('meta').clear(),
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
  await put('offFoods', [f]);
}

export async function activitiesFor(date: string): Promise<Activity[]> {
  return (await db()).getAllFromIndex('activities', 'date', date);
}

export async function putActivity(a: Activity): Promise<void> {
  await put('activities', [a]);
}

export async function deleteActivity(id: string): Promise<void> {
  await del('activities', id);
}

export async function waterFor(date: string): Promise<number> {
  return (await (await db()).get('water', date))?.ml ?? 0;
}

/** Add `deltaMl` (may be negative) to a day's water in one transaction; returns the new total. */
export async function changeWater(date: string, deltaMl: number): Promise<number> {
  const tx = (await db()).transaction(['water', 'meta'], 'readwrite');
  const cur = (await tx.objectStore('water').get(date))?.ml ?? 0;
  const ml = Math.min(MAX_WATER_ML, Math.max(0, cur + deltaMl));
  await tx.objectStore('water').put({ date, ml });
  await tx.objectStore('meta').put({ mt: Date.now() }, metaKey('water', date));
  await tx.done;
  return ml;
}

export async function listBody(): Promise<BodyEntry[]> {
  return (await db()).getAll('body');
}

export async function putBody(e: BodyEntry): Promise<void> {
  await put('body', [e]);
}

export async function deleteBody(date: string): Promise<void> {
  await del('body', date);
}

export async function listRecipes(): Promise<StoredRecipe[]> {
  return (await db()).getAll('recipes');
}

export async function putRecipe(r: StoredRecipe): Promise<void> {
  await put('recipes', [r]);
}

export async function listServings(): Promise<UserServings[]> {
  return (await db()).getAll('servings');
}

export async function putServings(s: UserServings): Promise<void> {
  await put('servings', [s]);
}

export async function putEntries(list: Entry[]): Promise<void> {
  await put('entries', list);
}

export async function getEntry(id: string): Promise<Entry | undefined> {
  return (await db()).get('entries', id);
}

export async function listCustomFoods(): Promise<CustomFood[]> {
  return (await db()).getAll('customFoods');
}

export async function putCustomFood(f: CustomFood): Promise<void> {
  await put('customFoods', [f]);
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
  await put('entries', [e]);
}

export async function deleteEntry(id: string): Promise<void> {
  await del('entries', id);
}

export async function getSettings(): Promise<Settings | undefined> {
  return (await (await db()).get('kv', 'settings')) as Settings | undefined;
}

export async function saveSettings(s: Settings): Promise<void> {
  await put('kv', [s], 'settings');
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
