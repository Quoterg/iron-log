// Backup (JSON) and spreadsheet (CSV) export, and strict validation of imported backups.
import { MEALS, type AllData, type CustomFood, type Entry, type OffFood, type Settings, type Usage, type UserServings } from './db';
import { foodName, NUTRIENTS, type Food } from './nutrients';
import { normalizeMacroPct, normalizeOverrides, snapPal } from './targets';
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
    const e: Entry = { id: x.id, date: x.date, meal: x.meal as Entry['meal'], foodRef: x.foodRef, grams: x.grams, createdAt: x.createdAt };
    if (x.unit !== undefined || x.qty !== undefined) {
      if (!isStr(x.unit, 50) || !isNum(x.qty) || x.qty <= 0) throw new BackupError('entry');
      e.unit = x.unit;
      e.qty = x.qty;
    }
    return e;
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

function servingList(x: unknown): { name: string; g: number }[] | null {
  if (!Array.isArray(x) || x.length > 50) return null;
  if (!x.every((s) => isObj(s) && isStr(s.name, 50) && s.name.trim() !== '' && isNum(s.g) && s.g > 0 && s.g < 100000)) return null;
  return (x as { name: string; g: number }[]).map(({ name, g }) => ({ name, g }));
}

function offFood(x: unknown): OffFood {
  if (
    isObj(x) && isStr(x.ref, 40) && /^off:\d{8,14}$/.test(x.ref) && isStr(x.sv) && (x.en === null || isStr(x.en)) &&
    Array.isArray(x.per100g) && x.per100g.length <= NUTRIENTS.length &&
    x.per100g.every((v) => v === null || (isNum(v) && v >= 0)) && isNum(x.fetchedAt)
  ) {
    const f: OffFood = { ref: x.ref, sv: x.sv, en: x.en, per100g: x.per100g, fetchedAt: x.fetchedAt };
    if (x.units !== undefined) {
      const units = servingList(x.units);
      if (!units) throw new BackupError('offFood');
      f.units = units;
    }
    return f;
  }
  throw new BackupError('offFood');
}

function usage(x: unknown): Usage {
  if (isObj(x) && isStr(x.foodRef, 200) && isNum(x.count) && isNum(x.lastUsed) && isNum(x.lastGrams)) {
    const u: Usage = { foodRef: x.foodRef, count: x.count, lastUsed: x.lastUsed, lastGrams: x.lastGrams };
    if (x.fav === true) u.fav = true;
    if (isStr(x.lastUnit, 50) && isNum(x.lastQty) && x.lastQty > 0) {
      u.lastUnit = x.lastUnit;
      u.lastQty = x.lastQty;
    }
    return u;
  }
  throw new BackupError('usage');
}

function servings(x: unknown): UserServings {
  if (
    isObj(x) && isStr(x.foodRef, 200) && Array.isArray(x.servings) && x.servings.length <= 50 &&
    x.servings.every((s) => isObj(s) && isStr(s.name, 50) && s.name.trim() !== '' && isNum(s.g) && s.g > 0 && s.g < 100000)
  ) {
    return { foodRef: x.foodRef, servings: (x.servings as { name: string; g: number }[]).map(({ name, g }) => ({ name, g })) };
  }
  throw new BackupError('servings');
}

function settings(x: unknown): Settings | undefined {
  if (!isObj(x) || !isObj(x.profile)) return undefined;
  const p = x.profile;
  if ((x.lang !== 'sv' && x.lang !== 'en') || (p.sex !== 'female' && p.sex !== 'male') || !isNum(p.kcal)) {
    return undefined; // settings are optional: ignore rather than reject the whole backup
  }
  // Accepts both the old `{ key: min }` and the current `{ key: { min, max } }` shape.
  const overrides = Object.fromEntries(
    Object.entries(normalizeOverrides(x.targetOverrides)).filter(([k]) => NUTRIENTS.some((n) => n.key === k)),
  );
  const profile: Settings['profile'] = { sex: p.sex, kcal: p.kcal };
  const inRange = (v: unknown, lo: number, hi: number) => isNum(v) && v >= lo && v <= hi;
  if (inRange(p.age, 18, 110) && Number.isInteger(p.age)) profile.age = p.age as number;
  if (inRange(p.weightKg, 30, 300)) profile.weightKg = Math.round((p.weightKg as number) * 10) / 10;
  if (inRange(p.heightCm, 120, 230) && Number.isInteger(p.heightCm)) profile.heightCm = p.heightCm as number;
  // Only the activity levels the UI offers, so the shown level always matches the energy estimate.
  if (inRange(p.pal, 1.2, 2.5)) profile.pal = snapPal(p.pal as number);
  // Automatic energy only when the data it needs survived validation.
  if (p.kcalAuto === true && profile.age && profile.weightKg && profile.heightCm) profile.kcalAuto = true;
  if (['none', 'pregnant1', 'pregnant2', 'pregnant3', 'lactating'].includes(p.status as string)) {
    profile.status = p.status as Settings['profile']['status'];
  }
  if (typeof p.menstruating === 'boolean') profile.menstruating = p.menstruating;
  const out: Settings = { lang: x.lang, profile, targetOverrides: overrides };
  if (['nnr', 'highProtein', 'lowCarb', 'keto', 'custom'].includes(x.macroPreset as string)) {
    out.macroPreset = x.macroPreset as Settings['macroPreset'];
  }
  const pct = normalizeMacroPct(x.macroPct);
  if (pct) out.macroPct = pct;
  if (out.macroPreset === 'custom' && !pct) out.macroPreset = 'nnr';
  return out;
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
    servings: list('servings').map(servings),
    offFoods: list('offFoods').map(offFood),
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
