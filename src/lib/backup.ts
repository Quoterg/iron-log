// Backup (JSON) and spreadsheet (CSV) export, and strict validation of imported backups.
import { MEALS, type AllData, type CustomFood, type Entry, type Settings, type Usage } from './db';
import { foodName, NUTRIENTS, type Food } from './nutrients';
import { scale } from './totals';

export const BACKUP_FORMAT = 'iron-log-backup';
export const BACKUP_VERSION = 1;

export interface Backup extends AllData {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
}

export function makeBackup(data: AllData, now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), ...data };
}

export class BackupError extends Error {}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isStr = (x: unknown, max = 500): x is string => typeof x === 'string' && x.length <= max;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function entry(x: unknown): Entry {
  if (
    isObj(x) && isStr(x.id, 100) && isStr(x.date) && DATE.test(x.date) && MEALS.includes(x.meal as never) &&
    isStr(x.foodRef, 200) && isNum(x.grams) && x.grams > 0 && x.grams < 100000 && isNum(x.createdAt)
  ) {
    return { id: x.id, date: x.date, meal: x.meal as Entry['meal'], foodRef: x.foodRef, grams: x.grams, createdAt: x.createdAt };
  }
  throw new BackupError('entry');
}

function customFood(x: unknown): CustomFood {
  if (
    isObj(x) && isStr(x.ref, 200) && x.ref.startsWith('custom:') && isStr(x.sv) && (x.en === null || isStr(x.en)) &&
    Array.isArray(x.per100g) && x.per100g.length <= NUTRIENTS.length &&
    x.per100g.every((v) => v === null || (isNum(v) && v >= 0)) && isNum(x.createdAt) && isNum(x.updatedAt)
  ) {
    const f: CustomFood = { ref: x.ref, sv: x.sv, en: x.en, per100g: x.per100g, createdAt: x.createdAt, updatedAt: x.updatedAt };
    if (x.deleted === true) f.deleted = true;
    return f;
  }
  throw new BackupError('customFood');
}

function usage(x: unknown): Usage {
  if (isObj(x) && isStr(x.foodRef, 200) && isNum(x.count) && isNum(x.lastUsed) && isNum(x.lastGrams)) {
    const u: Usage = { foodRef: x.foodRef, count: x.count, lastUsed: x.lastUsed, lastGrams: x.lastGrams };
    if (x.fav === true) u.fav = true;
    return u;
  }
  throw new BackupError('usage');
}

function settings(x: unknown): Settings | undefined {
  if (!isObj(x) || !isObj(x.profile)) return undefined;
  const p = x.profile;
  if ((x.lang !== 'sv' && x.lang !== 'en') || (p.sex !== 'female' && p.sex !== 'male') || !isNum(p.kcal)) {
    return undefined; // settings are optional: ignore rather than reject the whole backup
  }
  const overrides: Record<string, number> = {};
  if (isObj(x.targetOverrides)) {
    for (const [k, v] of Object.entries(x.targetOverrides)) {
      if (NUTRIENTS.some((n) => n.key === k) && isNum(v) && v >= 0) overrides[k] = v;
    }
  }
  return { lang: x.lang, profile: { sex: p.sex, kcal: p.kcal }, targetOverrides: overrides };
}

/** Parse and validate a backup file. Throws BackupError on anything unexpected (nothing is imported). */
export function parseBackup(text: string): AllData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('json');
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT || !isNum(raw.version)) throw new BackupError('format');
  if (raw.version > BACKUP_VERSION) throw new BackupError('version');
  const list = (k: string) => {
    const v = raw[k as keyof typeof raw];
    if (v === undefined) return [];
    if (!Array.isArray(v)) throw new BackupError(k);
    return v;
  };
  return {
    entries: list('entries').map(entry),
    customFoods: list('customFoods').map(customFood),
    usage: list('usage').map(usage),
    settings: settings(raw.settings),
  };
}

/**
 * Diary as CSV, one row per entry with all nutrients for the logged amount.
 * Swedish uses ";" and decimal comma (what Excel expects in a Swedish locale).
 */
export function toCsv(entries: Entry[], foods: Map<string, Food>, lang: 'sv' | 'en', mealName: (m: string) => string): string {
  const sep = lang === 'sv' ? ';' : ',';
  const num = (n: number) => {
    const s = String(Math.round(n * 1000) / 1000);
    return lang === 'sv' ? s.replace('.', ',') : s;
  };
  const head = [
    lang === 'sv' ? 'Datum' : 'Date',
    lang === 'sv' ? 'Måltid' : 'Meal',
    lang === 'sv' ? 'Livsmedel' : 'Food',
    lang === 'sv' ? 'Mängd (g)' : 'Amount (g)',
    ...NUTRIENTS.map((n) => `${n[lang]} (${n.unit})`),
  ];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.createdAt - b.createdAt)
    .map((e) => {
      const f = foods.get(e.foodRef);
      const amounts = f ? scale(f.per100g, e.grams).map((v, i) => (f.per100g[i] == null ? '' : num(v))) : NUTRIENTS.map(() => '');
      return [e.date, mealName(e.meal), f ? foodName(f, lang) : e.foodRef, num(e.grams), ...amounts];
    });
  const BOM = '﻿'; // so Excel opens UTF-8 (å, ä, ö) correctly
  return BOM + [head, ...rows].map((r) => r.map((c) => cell(c, sep)).join(sep)).join('\r\n') + '\r\n';
}

function cell(v: string, sep: string): string {
  // Neutralise spreadsheet formulas (CSV injection), e.g. a food named "=HYPERLINK(...)".
  const safe = /^[=+\-@\t\r]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
  return safe.includes(sep) || safe.includes('"') || safe.includes('\n') ? `"${safe.replace(/"/g, '""')}"` : safe;
}
