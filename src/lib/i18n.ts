import { signal } from '@preact/signals';

export type Lang = 'sv' | 'en';

const sv = {
  appName: 'Iron Log',
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
  searchPlaceholder: 'Sök livsmedel, t.ex. havregryn',
  noResults: 'Inga träffar',
  loadingFoods: 'Laddar livsmedel…',
  amount: 'Mängd',
  grams: 'g',
  add: 'Lägg till',
  cancel: 'Avbryt',
  remove: 'Ta bort',
  close: 'Stäng',
  per100g: 'per 100 g',
  diary: 'Dagbok',
  nutrients: 'Näringsämnen',
  settings: 'Inställningar',
  energy: 'Energi',
  macros: 'Makronäringsämnen',
  carbsDetail: 'Kolhydrater',
  lipids: 'Fetter',
  vitamins: 'Vitaminer',
  minerals: 'Mineraler',
  other: 'Övrigt',
  target: 'Mål',
  limit: 'Max',
  language: 'Språk',
  sex: 'Kön',
  female: 'Kvinna',
  male: 'Man',
  dailyEnergy: 'Energibehov per dag (kcal)',
  targetsNote: 'Målen bygger på de nordiska näringsrekommendationerna (NNR 2023) för vuxna 25–50 år.',
  emptyDay: 'Inget registrerat ännu. Tryck på ”Lägg till” vid en måltid.',
  attribution: 'Livsmedelsdata: Livsmedelsverkets livsmedelsdatabas (CC BY 4.0).',
  privacy: 'All data sparas bara på den här enheten.',
  back: 'Tillbaka',
  save: 'Spara',
  meal: 'Måltid',
  date: 'Datum',
  changeFood: 'Byt livsmedel',
  createFood: 'Skapa eget livsmedel',
  editFood: 'Redigera livsmedel',
  myFoods: 'Mina livsmedel',
  noCustomFoods: 'Du har inga egna livsmedel ännu. Skapa ett från sökningen.',
  name: 'Namn',
  nutrientsPer100g: 'Näringsvärden per 100 g',
  nutrientsForAmount: 'Näringsvärden för vald mängd',
  showAllNutrients: 'Visa alla näringsämnen',
  kcalHint: 'Lämna tomt för att räkna ut från protein, kolhydrater, fett och fibrer.',
  sourceSlv: 'Källa: Livsmedelsverkets livsmedelsdatabas (CC BY 4.0).',
  sourceCustom: 'Källa: ditt eget livsmedel.',
  confirmDeleteFood: 'Ta bort livsmedlet? Det försvinner från sökningen men finns kvar i dagboken.',
  customBadge: 'Eget',
  nameRequired: 'Ange ett namn.',
  invalidNumber: 'Ogiltigt tal.',
  favourites: 'Favoriter',
  recent: 'Senaste',
  addFavourite: '☆ Favorit',
  isFavourite: '★ Favorit',
  copy: 'Kopiera',
  copyMeal: 'Kopiera måltid',
  copyDay: 'Kopiera hela dagen',
  toDate: 'Till datum',
  toMeal: 'Till måltid',
  sameMeal: 'Samma måltider',
  searchHint: 'Tips: tidigare och favoritmarkerade livsmedel visas här.',
};

type Dict = typeof sv;

const en: Dict = {
  appName: 'Iron Log',
  today: 'Today',
  yesterday: 'Yesterday',
  tomorrow: 'Tomorrow',
  prevDay: 'Previous day',
  nextDay: 'Next day',
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  addFood: 'Add',
  searchPlaceholder: 'Search foods, e.g. oats',
  noResults: 'No results',
  loadingFoods: 'Loading foods…',
  amount: 'Amount',
  grams: 'g',
  add: 'Add',
  cancel: 'Cancel',
  remove: 'Remove',
  close: 'Close',
  per100g: 'per 100 g',
  diary: 'Diary',
  nutrients: 'Nutrients',
  settings: 'Settings',
  energy: 'Energy',
  macros: 'Macronutrients',
  carbsDetail: 'Carbohydrates',
  lipids: 'Fats',
  vitamins: 'Vitamins',
  minerals: 'Minerals',
  other: 'Other',
  target: 'Target',
  limit: 'Max',
  language: 'Language',
  sex: 'Sex',
  female: 'Female',
  male: 'Male',
  dailyEnergy: 'Daily energy need (kcal)',
  targetsNote: 'Targets follow the Nordic Nutrition Recommendations (NNR 2023) for adults aged 25–50.',
  emptyDay: 'Nothing logged yet. Tap “Add” on a meal.',
  attribution: 'Food data: Swedish Food Agency food composition database (CC BY 4.0).',
  privacy: 'All data is stored only on this device.',
  back: 'Back',
  save: 'Save',
  meal: 'Meal',
  date: 'Date',
  changeFood: 'Change food',
  createFood: 'Create custom food',
  editFood: 'Edit food',
  myFoods: 'My foods',
  noCustomFoods: 'You have no custom foods yet. Create one from search.',
  name: 'Name',
  nutrientsPer100g: 'Nutrition per 100 g',
  nutrientsForAmount: 'Nutrition for this amount',
  showAllNutrients: 'Show all nutrients',
  kcalHint: 'Leave empty to calculate from protein, carbs, fat and fibre.',
  sourceSlv: 'Source: Swedish Food Agency food composition database (CC BY 4.0).',
  sourceCustom: 'Source: your custom food.',
  confirmDeleteFood: 'Delete this food? It disappears from search but stays in your diary.',
  customBadge: 'Custom',
  nameRequired: 'Enter a name.',
  invalidNumber: 'Invalid number.',
  favourites: 'Favourites',
  recent: 'Recent',
  addFavourite: '☆ Favourite',
  isFavourite: '★ Favourite',
  copy: 'Copy',
  copyMeal: 'Copy meal',
  copyDay: 'Copy whole day',
  toDate: 'To date',
  toMeal: 'To meal',
  sameMeal: 'Same meals',
  searchHint: 'Tip: foods you have logged or marked as favourite show up here.',
};

const dicts: Record<Lang, Dict> = { sv, en };

export function detectLang(): Lang {
  const l = typeof navigator === 'undefined' ? '' : navigator.language?.toLowerCase();
  return l?.startsWith('en') ? 'en' : 'sv';
}

export const lang = signal<Lang>(detectLang());

export function t(key: keyof Dict): string {
  return dicts[lang.value][key];
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Locale-aware number formatting (decimal comma in Swedish). */
export function fmt(n: number, digits = 0): string {
  const k = `${lang.value}:${digits}`;
  let f = formatters.get(k);
  if (!f) {
    f = new Intl.NumberFormat(lang.value === 'sv' ? 'sv-SE' : 'en-GB', { maximumFractionDigits: digits });
    formatters.set(k, f);
  }
  return f.format(n);
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
