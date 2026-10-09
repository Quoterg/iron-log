// Backup (JSON) and spreadsheet (CSV) export, and strict validation of imported backups.
import { MEALS, SETTINGS_VERSION, type AllData, type CustomFood, type Entry, type OffFood, type Settings, type SyncStore, type Usage, type UserServings } from './db';
import { decimalCommaOf, isLang, type Lang } from './i18n';
import { dataLangOf, foodName, NUTRIENTS, type Food } from './nutrients';
import { MAX_ACTIVITY_KCAL, MAX_WATER_ML, type Activity, type Water } from './activity';
import type { BodyEntry } from './body';
import { padVector, type StoredRecipe } from './recipes';
import { normalizeDays, SUPPLEMENT_TIMES, type SupplementTime } from './supplements';
import { energyNeed, normalizeMacroPct, normalizeOverrides, snapPal } from './targets';
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

/** A nutrient vector: numbers ≥ 0 or null, at most NUTRIENTS.length long (older, shorter ones are padded). */
const isVector = (v: unknown): v is (number | null)[] =>
  Array.isArray(v) && v.length <= NUTRIENTS.length && v.every((n) => n === null || (isNum(n) && n >= 0));

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
    if (x.snap !== undefined) {
      if (!isVector(x.snap)) throw new BackupError('entry');
      e.snap = padVector(x.snap);
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
    if (x.supplement !== undefined) {
      const s = x.supplement;
      if (!isObj(s) || !isStr(s.unit, 30) || !s.unit.trim() || !isNum(s.perDay) || s.perDay < 0 || s.perDay > 100) {
        throw new BackupError('customFood');
      }
      f.supplement = { unit: s.unit, perDay: s.perDay };
      if (s.days !== undefined) {
        const days = s.days;
        if (!Array.isArray(days) || !days.length || days.length > 7 || new Set(days).size !== days.length || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
          throw new BackupError('customFood');
        }
        const d = normalizeDays(days as number[]);
        if (d) f.supplement.days = d;
      }
      if (s.time !== undefined) {
        if (!SUPPLEMENT_TIMES.includes(s.time as SupplementTime)) throw new BackupError('customFood');
        f.supplement.time = s.time as SupplementTime;
      }
    }
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

function recipe(x: unknown): StoredRecipe {
  const vector = isVector;
  if (
    isObj(x) && isStr(x.ref, 200) && x.ref.startsWith('recipe:') && isStr(x.name) && x.name.trim() !== '' &&
    Array.isArray(x.ingredients) && x.ingredients.length <= 200 && isNum(x.servings) && x.servings >= 1 &&
    x.servings <= 1000 && isNum(x.createdAt) && isNum(x.updatedAt) && vector(x.per100g) &&
    isNum(x.portionG) && x.portionG > 0 && isNum(x.totalG) && x.totalG > 0 &&
    (x.cookedWeightG === undefined || (isNum(x.cookedWeightG) && x.cookedWeightG > 0 && x.cookedWeightG < 100000))
  ) {
    const ingredients = x.ingredients.map((i) => {
      if (!isObj(i) || !isStr(i.foodRef, 200) || !isNum(i.grams) || !(i.grams > 0 && i.grams < 100000)) {
        throw new BackupError('recipe');
      }
      const out: StoredRecipe['ingredients'][number] = { foodRef: i.foodRef, grams: i.grams };
      if (i.per100g !== undefined) {
        if (!isVector(i.per100g)) throw new BackupError('recipe');
        out.per100g = padVector(i.per100g);
      }
      if (isStr(i.unit, 50) && isNum(i.qty) && i.qty > 0) {
        out.unit = i.unit;
        out.qty = i.qty;
      }
      return out;
    });
    const r: StoredRecipe = {
      ref: x.ref, name: x.name, ingredients, servings: x.servings, createdAt: x.createdAt, updatedAt: x.updatedAt,
      per100g: padVector(x.per100g as StoredRecipe['per100g']), portionG: x.portionG, totalG: x.totalG,
    };
    if (x.cookedWeightG !== undefined) r.cookedWeightG = x.cookedWeightG as number;
    if (x.deleted === true) r.deleted = true;
    return r;
  }
  throw new BackupError('recipe');
}

function body(x: unknown): BodyEntry {
  const opt = (v: unknown, lo: number, hi: number) => v === undefined || (isNum(v) && v >= lo && v <= hi);
  if (
    isObj(x) && isStr(x.date) && DATE.test(x.date) && isNum(x.updatedAt) &&
    opt(x.weightKg, 20, 400) && opt(x.bodyFatPct, 2, 75) && opt(x.waistCm, 30, 250)
  ) {
    const b: BodyEntry = { date: x.date, updatedAt: x.updatedAt };
    if (x.weightKg !== undefined) b.weightKg = x.weightKg as number;
    if (x.bodyFatPct !== undefined) b.bodyFatPct = x.bodyFatPct as number;
    if (x.waistCm !== undefined) b.waistCm = x.waistCm as number;
    return b;
  }
  throw new BackupError('body');
}

function activity(x: unknown): Activity {
  if (
    isObj(x) && isStr(x.id, 100) && isStr(x.date) && DATE.test(x.date) &&
    // Any id: a later release may rename or drop activities, and old backups must still restore.
    isStr(x.type, 50) && x.type !== '' &&
    isNum(x.minutes) && x.minutes > 0 && x.minutes <= 1440 && isNum(x.kcal) && x.kcal >= 0 && x.kcal <= MAX_ACTIVITY_KCAL &&
    isNum(x.createdAt)
  ) {
    return { id: x.id, date: x.date, type: x.type as string, minutes: x.minutes, kcal: x.kcal, createdAt: x.createdAt };
  }
  throw new BackupError('activity');
}

function water(x: unknown): Water {
  if (isObj(x) && isStr(x.date) && DATE.test(x.date) && isNum(x.ml) && x.ml >= 0 && x.ml <= MAX_WATER_ML) {
    return { date: x.date, ml: x.ml };
  }
  throw new BackupError('water');
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
  if (!isLang(x.lang) || (p.sex !== 'female' && p.sex !== 'male') || !isNum(p.kcal)) {
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
  if (inRange(p.bodyFatPct, 3, 70)) profile.bodyFatPct = Math.round((p.bodyFatPct as number) * 10) / 10;
  // Only the activity levels the UI offers, so the shown level always matches the energy estimate.
  if (inRange(p.pal, 1, 2.5)) profile.pal = snapPal(p.pal as number);
  // Automatic energy only when the data a formula needs survived validation.
  if (p.kcalAuto === true && energyNeed(profile) != null) profile.kcalAuto = true;
  if (['none', 'pregnant1', 'pregnant2', 'pregnant3', 'lactating'].includes(p.status as string)) {
    profile.status = p.status as Settings['profile']['status'];
  }
  if (typeof p.menstruating === 'boolean') profile.menstruating = p.menstruating;
  // Imported profiles are already in the current format (activity snapped above).
  const out: Settings = { lang: x.lang, profile, targetOverrides: overrides, version: SETTINGS_VERSION };
  if (['nnr', 'highProtein', 'lowCarb', 'keto', 'custom'].includes(x.macroPreset as string)) {
    out.macroPreset = x.macroPreset as Settings['macroPreset'];
  }
  const pct = normalizeMacroPct(x.macroPct);
  if (pct) out.macroPct = pct;
  if (out.macroPreset === 'custom' && !pct) out.macroPreset = 'nnr';
  if (x.addBurnedToTarget === true) out.addBurnedToTarget = true;
  if (Array.isArray(x.sources)) {
    const src = (['slv', 'usda'] as const).filter((s) => (x.sources as unknown[]).includes(s));
    if (src.length) out.sources = src;
  }
  return out;
}

/** Validators for single records arriving by device-to-device sync: the same rules as a backup. */
export const SYNC_VALIDATORS: Record<SyncStore, (x: unknown) => unknown> = {
  entries: entry,
  customFoods: customFood,
  usage,
  servings,
  offFoods: offFood,
  recipes: recipe,
  body,
  activities: activity,
  water,
  kv: (x) => {
    const s = settings(x);
    if (!s) throw new BackupError('settings');
    return s;
  },
};

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
    recipes: list('recipes').map(recipe),
    body: list('body').map(body),
    activities: list('activities').map(activity),
    water: list('water').map(water),
    settings: settings(raw.settings),
  };
}

/**
 * Diary as CSV, one row per entry with all nutrients for the logged amount.
 * Swedish uses ";" and decimal comma (what Excel expects in a Swedish locale).
 */
/** Column labels for the CSV (the app passes translated ones; defaults: Swedish or English). */
export interface CsvLabels {
  date: string;
  meal: string;
  food: string;
  amount: string;
  supplements: string;
  nutrient: (n: (typeof NUTRIENTS)[number]) => string;
}

function defaultLabels(lang: string): CsvLabels {
  const sv = lang === 'sv';
  return {
    date: sv ? 'Datum' : 'Date',
    meal: sv ? 'Måltid' : 'Meal',
    food: sv ? 'Livsmedel' : 'Food',
    amount: sv ? 'Mängd (g)' : 'Amount (g)',
    supplements: sv ? 'Kosttillskott' : 'Supplements',
    nutrient: (n) => n[dataLangOf(lang)],
  };
}

/**
 * The diary as a spreadsheet. Where the language writes decimals with a comma (sv, da, de, fi…)
 * the file uses `;` between columns and `,` in numbers — what Excel expects in those locales.
 */
export function toCsv(
  entries: Entry[],
  foods: Map<string, Food>,
  lang: Lang,
  mealName: (m: string) => string,
  supplementRefs: ReadonlySet<string> = new Set(),
  labels: CsvLabels = defaultLabels(lang),
): string {
  const comma = decimalCommaOf(lang);
  const sep = comma ? ';' : ',';
  const num = (n: number) => {
    const s = String(Math.round(n * 1000) / 1000);
    return comma ? s.replace('.', ',') : s;
  };
  const head = [labels.date, labels.meal, labels.food, labels.amount, ...NUTRIENTS.map((n) => `${labels.nutrient(n)} (${n.unit})`)];
  const rows = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || a.createdAt - b.createdAt)
    .map((e) => {
      const f = foods.get(e.foodRef);
      const v = e.snap ?? f?.per100g; // as logged, for recipes
      const amounts = v ? scale(v, e.grams).map((x, i) => (v[i] == null ? '' : num(x))) : NUTRIENTS.map(() => '');
      const meal = supplementRefs.has(e.foodRef) ? labels.supplements : mealName(e.meal);
      return [e.date, meal, f ? foodName(f, lang) : e.foodRef, num(e.grams), ...amounts];
    });
  const BOM = '﻿'; // so Excel opens UTF-8 (å, ä, ö) correctly
  return BOM + [head, ...rows].map((r) => r.map((c) => cell(c, sep)).join(sep)).join('\r\n') + '\r\n';
}

function cell(v: string, sep: string): string {
  // Neutralise spreadsheet formulas (CSV injection), e.g. a food named "=HYPERLINK(...)".
  const safe = /^[=+\-@\t\r]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
  return safe.includes(sep) || safe.includes('"') || safe.includes('\n') ? `"${safe.replace(/"/g, '""')}"` : safe;
}
