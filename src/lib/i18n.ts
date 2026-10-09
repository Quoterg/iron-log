import { signal } from '@preact/signals';

import { dataLangOf } from './nutrients';

export type Lang = 'sv' | 'en' | 'da' | 'fi' | 'de' | 'so';

/** The language picker, in this order. Machine-assisted translations are marked beta until reviewed. */
export const LANGS: { code: Lang; name: string; beta?: true }[] = [
  { code: 'sv', name: 'Svenska' },
  { code: 'en', name: 'English' },
  { code: 'da', name: 'Dansk', beta: true },
  { code: 'de', name: 'Deutsch', beta: true },
  { code: 'fi', name: 'Suomi', beta: true },
  { code: 'so', name: 'Soomaali', beta: true },
];

export const isLang = (x: unknown): x is Lang => LANGS.some((l) => l.code === x);

const sv = {
  appName: 'Iron Log',
  carbsAbbr: 'K',
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
  body: 'Kropp',
  bodyWeight: 'Vikt',
  bodyFat: 'Fettprocent',
  bodyWaist: 'Midjemått',
  logBody: 'Registrera mått',
  bodySaved: 'Sparat.',
  bodyInvalid: 'Kontrollera datum och värden (inte framtida datum; vikt 20–400 kg, fett 2–75 %, midja 30–250 cm).',
  noBodyData: 'Inga mått ännu. Din senaste vikt uppdaterar också profilen.',
  range: 'Tidsperiod',
  range30: '30 dagar',
  range90: '90 dagar',
  range365: '1 år',
  rangeAll: 'Allt',
  measurement: 'Mätning',
  measurements: 'mätningar',
  latest: 'senast',
  trend7: 'Trend 7 dagar',
  chartHint: 'Peka i diagrammet eller använd piltangenterna för värden.',
  showTable: 'Visa som tabell',
  hideTable: 'Dölj tabellen',
  nutrients: 'Näringsämnen',
  settings: 'Inställningar',
  energy: 'Energi',
  macros: 'Makronäringsämnen',
  carbsDetail: 'Kolhydrater',
  lipids: 'Fetter',
  vitamins: 'Vitaminer',
  minerals: 'Mineraler',
  aminoAcids: 'Essentiella aminosyror',
  other: 'Övrigt',
  target: 'Mål',
  limit: 'Max',
  language: 'Språk',
  sex: 'Kön',
  female: 'Kvinna',
  male: 'Man',
  dailyEnergy: 'Energibehov per dag (kcal)',
  targetsNote: 'Målen bygger på de nordiska näringsrekommendationerna (NNR 2023) för din ålder och livssituation.',
  emptyDay: 'Inget registrerat ännu. Tryck på ”Lägg till” vid en måltid.',
  attribution: 'Livsmedelsdata: Livsmedelsverkets livsmedelsdatabas (CC BY 4.0).',
  privacy: 'All data sparas bara på den här enheten.',
  copy: 'Kopiera',
  offAdd: 'Lägg till produkten på Open Food Facts',
  offComplete: 'Fyll i näringsvärdena på Open Food Facts',
  offHelpNote: 'Sidan öppnas i webbläsaren. När produkten finns där hittar alla den nästa gång.',
  offFix: 'Rätta eller komplettera på Open Food Facts',
  reportError: 'Rapportera fel i livsmedelsdata',
  privacyPolicy: 'Integritet',
  aboutApp: 'Om Iron Log',
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
  food: 'Livsmedel',
  nutrientsPer100g: 'Näringsvärden per 100 g',
  nutrientsForAmount: 'Näringsvärden för vald mängd',
  showAllNutrients: 'Visa alla näringsämnen',
  supplements: 'Kosttillskott',
  supplementBadge: 'Tillskott',
  newSupplement: 'Nytt kosttillskott',
  editSupplement: 'Ändra kosttillskott',
  supplementUnit: 'Enhet',
  supplementUnitDefault: 'tablett',
  supplementPerDay: 'Antal per dag',
  supplementPerDayHint: 'Med antal per dag visas tillskottet som en bock i dagboken. 0 = vid behov.',
  supplementPerUnit: 'Innehåll per {unit}',
  supplementTaken: 'Tagen',
  supplementDays: 'Dagar',
  supplementDaysMissing: 'Välj minst en dag.',
  supplementTime: 'Tid på dagen',
  time_any: 'Ingen särskild tid',
  time_morning: 'Morgon',
  time_midday: 'Mitt på dagen',
  time_evening: 'Kväll',
  time_night: 'Natt',
  perDayShort: 'dag',
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
  copyMeal: 'Kopiera måltid',
  copyDay: 'Kopiera hela dagen',
  toDate: 'Till datum',
  toMeal: 'Till måltid',
  sameMeal: 'Samma måltider',
  searchHint: 'Tips: tidigare och favoritmarkerade livsmedel visas här.',
  yourData: 'Dina data',
  exportBackup: 'Exportera säkerhetskopia (JSON)',
  exportCsv: 'Exportera dagbok som kalkylark (CSV)',
  importBackup: 'Importera säkerhetskopia',
  importConfirm: 'Importera {n} poster och {f} egna livsmedel? Befintliga data behålls: bara det som saknas (eller är äldre här) läggs till.',
  importDone: 'Importen är klar.',
  importFailed: 'Filen kunde inte importeras: den är inte en giltig säkerhetskopia från Iron Log.',
  deleteAll: 'Radera all data',
  deleteAllConfirm: 'Radera ALL data på den här enheten (dagbok, egna livsmedel, inställningar)? Det går inte att ångra. Exportera en säkerhetskopia först. Data på enheter du synkar med påverkas inte och kommer tillbaka om du synkar igen.',
  storagePersistent: 'Lagringen är skyddad: webbläsaren rensar inte dina data automatiskt.',
  storageNotPersistent: 'Webbläsaren kan rensa dina data om utrymmet tar slut. Installera appen och exportera säkerhetskopior regelbundet.',
  installApp: 'Installera appen',
  installIosHint: 'Installera på iPhone: tryck på Dela-knappen och välj ”Lägg till på hemskärmen”.',
  unit: 'Mått',
  addServing: '+ Eget mått',
  servingName: 'Namn på måttet',
  servingGrams: 'Vikt (g)',
  servingNameHint: 't.ex. min skål',
  scanBarcode: 'Skanna streckkod',
  barcode: 'Streckkod',
  lookUp: 'Sök',
  barcodeBadge: 'Streckkod',
  scanStarting: 'Startar kameran…',
  scanHint: 'Rikta kameran mot streckkoden.',
  scanNoCamera: 'Kameran är inte tillgänglig. Skriv in streckkoden nedan.',
  scanLooking: 'Söker produkten…',
  scanNotFound: 'Produkten finns inte i Open Food Facts. Du kan skapa den som eget livsmedel.',
  scanNoData: 'Produkten saknar näringsvärden i Open Food Facts. Du kan skapa den som eget livsmedel.',
  scanNetwork: 'Kunde inte nå Open Food Facts. Kontrollera anslutningen och försök igen.',
  scanInvalid: 'Ogiltig streckkod (8, 12, 13 eller 14 siffror).',
  offPrivacy: 'Endast streckkoden skickas till Open Food Facts. Hittade produkter sparas på enheten.',
  sourceOff: 'Källa: Open Food Facts (ODbL), streckkod',
  attributionOff: 'Produktdata: Open Food Facts (ODbL).',
  attributionUsda: 'Amerikanska livsmedelsdata: USDA FoodData Central (public domain).',
  foodDatabases: 'Livsmedelsdatabaser i sökningen',
  sourceNameSlv: 'Livsmedelsverket (Sverige, svenska namn)',
  sourceNameUsda: 'USDA (USA, engelska namn, ca 8 000 livsmedel)',
  sourceUsda: 'Källa: USDA FoodData Central (public domain).',
  sourcesUnavailable: '{list} kunde inte laddas (offline?). Sökningen visar övriga livsmedel och försöker igen automatiskt.',
  profile: 'Profil',
  age: 'Ålder',
  weightKg: 'Vikt (kg)',
  heightCm: 'Längd (cm)',
  activity: 'Aktivitetsnivå',
  palSedentary: 'Stillasittande (kontorsjobb)',
  palLight: 'Lätt träning (1–2 dagar/vecka)',
  palModerate: 'Måttlig träning (3–5 dagar/vecka)',
  palHeavy: 'Hård träning (6–7 dagar/vecka)',
  palAthlete: 'Idrottare (2 pass/dag)',
  bodyFatPct: 'Fettprocent (valfritt)',
  energyNotice: 'Energibehovet räknas nu som på tdeecalculator.net (Katch–McArdle med fettprocent, annars Mifflin–St Jeor) med nya aktivitetsnivåer. Ditt automatiska energimål har ändrats – kontrollera din aktivitetsnivå.',
  ok: 'OK',
  formulaKatch: 'Beräknat med Katch–McArdle (fettfri massa), som tdeecalculator.net.',
  formulaMifflin: 'Beräknat med Mifflin–St Jeor, som tdeecalculator.net. Ange fettprocent för Katch–McArdle.',
  lifeStage: 'Livssituation',
  statusNone: 'Ej gravid eller ammande',
  pregnant1: 'Gravid, trimester 1',
  pregnant2: 'Gravid, trimester 2',
  pregnant3: 'Gravid, trimester 3',
  lactating: 'Ammar',
  menstruating: 'Har menstruation (påverkar järnbehovet)',
  kcalAuto: 'Räkna ut energibehovet automatiskt',
  kcalAutoHint: 'Fyll i ålder, vikt och längd – eller vikt och fettprocent – för att räkna ut energibehovet.',
  kcalEstimate: 'Uppskattat energibehov',
  weightBeforePregnancy: 'Vikt före graviditeten (kg)',
  lactationNote: 'Energitillägget gäller vid helamning (första 6 månaderna).',
  loading: 'Laddar…',
  activityLog: 'Aktivitet',
  addActivity: 'Lägg till aktivitet',
  activityType: 'Aktivitet',
  minutes: 'Minuter',
  activityNote: 'Uppskattning: (MET − 1) × din vikt × tid, alltså energi utöver vila (som redan ingår i ditt energibehov).',
  activityNoWeight: 'Uppskattat för {kg} kg – ange din vikt i profilen för en bättre uppskattning.',
  water: 'Vatten',
  addBurnedToTarget: 'Lägg till förbränd energi från aktiviteter i dagens energimål',
  targetInclActivity: 'Målet inkluderar {kcal} kcal från aktivitet.',
  periodLabel: 'Period',
  periodDay: 'Dagen',
  period7: '7 dagar',
  period30: '30 dagar',
  averageNote: 'Genomsnitt per loggad dag ({n} av {d} dagar har registreringar).',
  streak: 'Du har loggat {n} dagar i rad.',
  insights: 'Att tänka på',
  lowNutrients: 'Under 70 % av målet',
  overLimit: 'Över gränsen',
  topSources: 'Största källor',
  noSources: 'Inga livsmedel med det här näringsämnet under perioden.',
  richestFoods: 'Rikast i livsmedelsdatabasen',
  richestNote: 'Per 100 g – kryddor och torkade livsmedel kan toppa listan.',
  noRichest: 'Inga livsmedel i de valda databaserna har värden för detta.',
  noTarget: 'inget mål',
  createRecipe: 'Skapa recept',
  editRecipe: 'Redigera recept',
  myRecipes: 'Mina recept',
  noRecipes: 'Du har inga recept ännu.',
  servings: 'Antal portioner',
  ingredients: 'Ingredienser',
  ingredient: 'Ingrediens',
  noIngredients: 'Lägg till minst en ingrediens.',
  addIngredient: 'Lägg till ingrediens',
  addToRecipe: 'Lägg till i receptet',
  cookedWeight: 'Vikt efter tillagning (g, valfritt)',
  cookedWeightHint: 'Väg rätten när den är klar för exaktare värden – vatten kokar bort eller tas upp. Lämna tomt för att använda ingrediensernas vikt.',
  perPortion: 'Per portion',
  portionShort: 'portion',
  ingredientsMissing: 'Några ingredienser saknar näringsvärden (t.ex. ett borttaget livsmedel). Ta bort eller byt dem innan du sparar.',
  recipeEditNote: 'Ändringar gäller nya registreringar – dagar du redan har loggat behåller sina värden.',
  servingsInvalid: 'Ange antal portioner mellan 0,5 och 1000.',
  draftFound: 'Du har ett osparat utkast för det här receptet.',
  restore: 'Återställ',
  discard: 'Kasta',
  recipeBadge: 'Recept',
  sourceRecipe: 'Källa: ditt recept (beräknat från ingredienserna).',
  confirmDeleteRecipe: 'Ta bort receptet? Det försvinner från sökningen men finns kvar i dagboken.',
  adjustTargets: 'Anpassa mål',
  macroDistribution: 'Fördelning av energi (E%)',
  preset: 'Förval',
  preset_nnr: 'NNR 2023 (rekommenderat)',
  preset_highProtein: 'Högt protein',
  preset_lowCarb: 'Låg kolhydrat',
  preset_keto: 'Keto',
  preset_custom: 'Egen fördelning',
  minPct: 'Min %',
  maxPct: 'Max %',
  customHint: 'Ändra procenten genom att välja ”Egen fördelning” (den utgår från nuvarande fördelning och följer inte med om din ålder ändras).',
  invalidTarget: 'Ogiltigt värde för {name}: ange ett tal från 0 och se till att målet inte är högre än max.',
  invalidPct: 'Ogiltig procent för {name}: 0–100 och min högst max.',
  conflictNote: 'Ditt eget värde ignoreras eftersom det motsäger förvalet.',
  loadFailed: 'Kunde inte ladda. Kontrollera anslutningen.',
  retry: 'Försök igen',
  pctSumWarning: 'Intervallen går inte ihop till 100 % – kontrollera min och max.',
  perNutrient: 'Mål per näringsämne',
  perNutrientHint: 'Lämna tomt för att använda standardvärdet (visas i grått). Målet är ett minimum, max är en övre gräns.',
  resetTargets: 'Återställ alla mål',
  resetTargetsConfirm: 'Återställa alla mål till NNR 2023?',
};

export type Dict = typeof sv;

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
  return packs.get(lang.value)?.strings[key] ?? packs.get('en')?.strings[key] ?? sv[key];
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
