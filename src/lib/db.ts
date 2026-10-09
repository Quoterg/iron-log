// User data lives on the device, in IndexedDB. Nothing is sent anywhere.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
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

interface Schema extends DBSchema {
  entries: { key: string; value: Entry; indexes: { date: string } };
  kv: { key: string; value: unknown };
}

let dbp: Promise<IDBPDatabase<Schema>> | undefined;

function db() {
  dbp ??= openDB<Schema>('opennutri', 1, {
    upgrade(d) {
      d.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
      d.createObjectStore('kv');
    },
  });
  return dbp;
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
