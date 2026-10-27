import { signal } from '@preact/signals';

import { dataLangOf } from './nutrients';

export type Lang = 'sv' | 'en' | 'da' | 'fi' | 'de' | 'so';

/** The language picker, in this order. */
export const LANGS: { code: Lang; name: string }[] = [
  { code: 'sv', name: 'Svenska' },
  { code: 'en', name: 'English' },
  { code: 'da', name: 'Dansk' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fi', name: 'Suomi' },
  { code: 'so', name: 'Soomaali' },
];

export const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.code === x);

const sv = {
  today: 'Idag',
  yesterday: 'Igår',
  tomorrow: 'Imorgon',
  prevDay: 'Föregående dag',
  nextDay: 'Nästa dag',
  breakfast: 'Frukost',
  lunch: 'Lunch',
  dinner: 'Middag',
  snack: 'Mellanmål',
  addFood: 'Lägg till',
  add: 'Lägg till',
  remove: 'Ta bort',
  per100g: 'per 100 g',
  diary: 'Dagbok',
  body: 'Kropp',
  nutrients: 'Näringsämnen',
  settings: 'Inställningar',
  energy: 'Energi',
  other: 'Övrigt',
  female: 'Kvinna',
  male: 'Man',
  emptyDay: 'Inget registrerat ännu. Tryck på ”Lägg till” vid en måltid.',
  copy: 'Kopiera',
  dayCost: 'Matkostnad: {kr}',
  costEdit: 'Pris: {name}',
  followDone: 'Ditt energimål ändrades: nu {kcal} kcal/dag ({delta}).',
  followWhy: 'Varför?',
  meal: 'Måltid',
  date: 'Datum',
  editFood: 'Redigera livsmedel',
  name: 'Namn',
  food: 'Livsmedel',
  supplements: 'Kosttillskott',
  supplementTaken: 'Tagen',
  perDayShort: 'dag',
  copyMeal: 'Kopiera måltid',
  copyDay: 'Kopiera hela dagen',
  saveAsMeal: 'Spara som måltid',
  clearMeal: 'Töm måltiden',
  clearMealConfirm: 'Ta bort allt i {meal} ({n} st)?',
  sameAsYesterday: 'Samma som igår',
  shoppingList: 'Inköpslista',
  checkinReady: 'Veckans avstämning är klar',
  checkinShow: 'Visa',
  dayComplete: 'Dagen är komplett',
  usualMeal: 'Som vanligt',
  notNow: 'Inte nu',
  updateReady: 'Det finns en ny version av appen.',
  restart: 'Starta om',
  foodsUnavailable: '{n} av livsmedlen finns inte längre och lades inte till.',
  weightKg: 'Vikt (kg)',
  activity: 'Aktivitetsnivå',
  bodyFatPct: 'Fettprocent (valfritt)',
  pregnant1: 'Gravid, trimester 1',
  pregnant2: 'Gravid, trimester 2',
  pregnant3: 'Gravid, trimester 3',
  lactating: 'Ammar',
  loading: 'Laddar…',
  activityLog: 'Aktivitet',
  water: 'Vatten',
  targetInclActivity: 'Målet inkluderar {kcal} kcal från aktivitet.',
  servings: 'Antal portioner',
  ingredients: 'Ingredienser',
  loadFailed: 'Kunde inte ladda. Kontrollera anslutningen.',
  retry: 'Försök igen',
  // Supplement times: the diary builds the key (t(`time_${…}`)), so they stay here (M39b review).
  time_any: 'Ingen särskild tid',
  time_morning: 'Morgon',
  time_midday: 'Mitt på dagen',
  time_evening: 'Kväll',
  time_night: 'Natt',
};

/** All strings: the first screen's (above) and the later screens' (strings-later.ts, M39b). */
export type Dict = typeof sv & typeof import('./strings-later').SV_LATER;

/** Adds the later screens' Swedish strings (strings-later.ts registers them when it loads). */
export function registerSv(later: typeof import('./strings-later').SV_LATER): void {
  Object.assign(sv, later);
}

/**
 * A language. Swedish is built in; the others load on demand (one small chunk each), so a new
 * language costs nothing in the first bundle. Missing strings fall back to English, then Swedish.
 */
export interface LangPack {
  strings: Partial<Dict>;
  /** Nutrient names by key (Swedish and English come from nutrients.json). */
  nutrients?: Record<string, string>;
  /** Activity names by id (Swedish and English come from activity-types.ts). */
  activities?: Record<string, string>;
  /** Household measures by stored name (Swedish and English: UNIT_LABELS below). */
  units?: Record<string, string>;
  /** Strings of the sync screens (Swedish ones live in strings-sync.ts, loaded with them). */
  sync?: Record<string, string>;
  /** Strings of the Open Food Facts upload screen (Swedish ones: strings-off.ts). */
  off?: Record<string, string>;
  /** Strings of the adaptive energy card (Swedish ones: strings-energy.ts). */
  energy?: Record<string, string>;
  /** Strings of suggestions, swaps and "what if" (Swedish ones: strings-suggest.ts). */
  suggest?: Record<string, string>;
  /** Strings of the weekly check-in (Swedish ones: strings-checkin.ts). */
  checkin?: Record<string, string>;
  /** Strings of the shopping list (Swedish ones: strings-shop.ts). */
  shop?: Record<string, string>;
  /** Strings of "Frukt i säsong" (Swedish ones: strings-fruit.ts). */
  fruit?: Record<string, string>;
}

const LOADERS: Record<Exclude<Lang, 'sv'>, () => Promise<{ default: LangPack }>> = {
  en: () => import('./lang/en'),
  da: () => import('./lang/da'),
  fi: () => import('./lang/fi'),
  de: () => import('./lang/de'),
  so: () => import('./lang/so'),
};

const packs = new Map<Lang, LangPack>([['sv', { strings: sv }]]);

/** A loaded pack (for lazily loaded screens with their own strings, e.g. sync). */
export const packOf = (l: Lang): LangPack | undefined => packs.get(l);

/** The language used last on this device (a startup hint only; settings stay the truth). */
export function lastLang(): Lang | undefined {
  try {
    const l = localStorage.getItem('iron-log-lang');
    return isLang(l) ? l : undefined;
  } catch {
    return undefined;
  }
}

export function rememberLang(l: Lang): void {
  try {
    localStorage.setItem('iron-log-lang', l);
  } catch {
    // private mode etc.: only the startup hint is lost
  }
}

/** Load a language (and English, its fallback). Call before switching `lang` to it. */
export async function loadLang(l: Lang): Promise<void> {
  const need: Exclude<Lang, 'sv'>[] = l === 'sv' ? [] : l === 'en' ? ['en'] : [l, 'en'];
  await Promise.all(need.filter((x) => !packs.has(x)).map(async (x) => void packs.set(x, (await LOADERS[x]()).default)));
}

/** The browser's language if we have it; Norwegian reads Swedish; anything else gets English. */
export function detectLang(): Lang {
  const l = (typeof navigator === 'undefined' ? '' : (navigator.language ?? '')).toLowerCase().slice(0, 2);
  if (isLang(l)) return l;
  if (l === 'nb' || l === 'nn' || l === 'no' || !l) return 'sv';
  return 'en';
}

export const lang = signal<Lang>(detectLang());

export function t(key: keyof Dict): string {
  return packs.get(lang.value)?.strings[key] ?? packs.get('en')?.strings[key] ?? (sv as Dict)[key];
}

const LOCALES: Record<Lang, string> = { sv: 'sv-SE', en: 'en-GB', da: 'da-DK', fi: 'fi-FI', de: 'de-DE', so: 'so-SO' };

/** BCP 47 locale for a language; falls back to English where the browser lacks it (Somali on older Android). */
export function localeOf(l: Lang): string {
  const want = LOCALES[l];
  return Intl.NumberFormat.supportedLocalesOf([want]).length ? want : 'en-GB';
}

/** BCP 47 locale for dates and numbers. */
export const locale = (): string => localeOf(lang.value);

const commaCache = new Map<Lang, boolean>();
/** Whether a language writes decimals with a comma (1,5). */
export function decimalCommaOf(l: Lang): boolean {
  let c = commaCache.get(l);
  if (c === undefined) commaCache.set(l, (c = new Intl.NumberFormat(localeOf(l)).format(1.5).includes(',')));
  return c;
}

/** Which food-data names to show (foods only have Swedish and English names). */
export const dataLang = (): 'sv' | 'en' => dataLangOf(lang.value);

/** Whether the current language writes decimals with a comma (1,5) — inputs accept both anyway. */
export const decimalComma = (): boolean => decimalCommaOf(lang.value);

export function nutrientName(n: { key: string; sv: string; en: string }): string {
  return packs.get(lang.value)?.nutrients?.[n.key] ?? n[dataLang()];
}

export function activityName(a: { id: string; sv: string; en: string }): string {
  return packs.get(lang.value)?.activities?.[a.id] ?? a[dataLang()];
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware number formatting (decimal comma in Swedish). */
export function fmt(n: number, digits = 0): string {
  const k = `${lang.value}:${digits}`;
  let f = formatters.get(k);
  if (!f) {
    f = new Intl.NumberFormat(locale(), { maximumFractionDigits: digits });
    formatters.set(k, f);
  }
  return f.format(n);
}

const UNIT_LABELS: Record<string, [sv: string, en: string]> = {
  st: ['st', 'pc'],
  dl: ['dl', 'dl'],
  msk: ['msk', 'tbsp'],
  tsk: ['tsk', 'tsp'],
  skiva: ['skiva', 'slice'],
  glas: ['glas', 'glass'],
  kopp: ['kopp', 'cup'],
  portion: ['portion', 'serving'],
  smörgås: ['på smörgås', 'on a sandwich'],
  förpackning: ['förpackning', 'package'],
  helaReceptet: ['hela receptet', 'whole recipe'],
};

/** Display name of a household measure; user-defined names are shown as typed. */
export function unitLabel(name: string): string {
  const own = packs.get(lang.value)?.units?.[name];
  if (own) return own;
  const l = UNIT_LABELS[name];
  return l ? l[dataLang() === 'sv' ? 0 : 1] : name;
}

/** A number as typed into an input: decimal comma in Swedish (matches what parseNum accepts). */
export function inputNum(n: number): string {
  return decimalComma() ? String(n).replace('.', ',') : String(n);
}

/** Parse a user-typed number; accepts decimal comma ("1,5"). NaN when empty or invalid. */
export function parseNum(s: string): number {
  const t = s.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
}

/** Sensible precision for a nutrient amount. */
export function fmtAmount(n: number): string {
  const a = Math.abs(n);
  return fmt(n, a >= 100 ? 0 : a >= 10 ? 1 : 2);
}
