// App-wide reactive state (Preact signals) and the actions that change it.
import { computed, signal } from '@preact/signals';
import * as db from './lib/db';
import type { CustomFood, Entry, Meal, OffFood, Settings, Usage } from './lib/db';
import { getFoods, setCustomFoods, setUserBoosts } from './lib/foods';
import { fetchProduct } from './lib/off';
import { lang } from './lib/i18n';
import type { Food, NutrientVector, Serving } from './lib/nutrients';
import { recipeNutrition, recipeToFood, type Recipe, type StoredRecipe } from './lib/recipes';
import { computeTargets, DEFAULT_PROFILE, migrateEnergyProfile, normalizeOverrides, type Target } from './lib/targets';
import { scale, sum } from './lib/totals';

export type View = 'diary' | 'nutrients' | 'settings';

export const view = signal<View>('diary');
export const date = signal(db.isoDate(new Date()));
export const entries = signal<Entry[]>([]);
/** Every food referenced on screen, built-in or custom, by ref. */
export const foods = signal<Map<string, Food>>(new Map());
export const customFoods = signal<CustomFood[]>([]);
/** Per-food usage (count, last amount, favourite), by food ref. */
export const usage = signal<Map<string, Usage>>(new Map());
/** The user's recipes (with a nutrition snapshot). */
export const recipes = signal<StoredRecipe[]>([]);
/** Products looked up on Open Food Facts (cached locally). */
export const offFoods = signal<OffFood[]>([]);
/** The user's own household measures, by food ref. */
export const userServings = signal<Map<string, Serving[]>>(new Map());
export const settings = signal<Settings>({
  lang: lang.value,
  profile: DEFAULT_PROFILE,
  targetOverrides: {},
  version: db.SETTINGS_VERSION,
});

export const targets = computed<Record<string, Target>>(() => computeTargets(settings.value));

/** Nutrient totals for the selected day, in NUTRIENTS order. */
export const dayTotals = computed(() =>
  sum(
    entries.value.flatMap((e) => {
      const v = db.entryVector(e, foods.value);
      return v ? [scale(v, e.grams)] : [];
    }),
  ),
);

let loadSeq = 0;
export async function loadDay(d: string): Promise<void> {
  date.value = d;
  const seq = ++loadSeq;
  const list = await db.entriesFor(d);
  if (seq !== loadSeq) return;
  entries.value = list;
  if (list.length) await ensureFoods(list.map((e) => e.foodRef));
}

/** Make sure the given foods are in the `foods` map (fetching from the worker if needed). */
export async function ensureFoods(refs: string[]): Promise<void> {
  const missing = refs.filter((r) => !foods.value.has(r));
  if (!missing.length) return;
  const found = await getFoods(missing);
  foods.value = new Map([...foods.value, ...found]);
}

/** A logged amount: grams, plus the household measure it was entered in (if any). */
export interface Amount {
  grams: number;
  unit?: string;
  qty?: number;
}

export async function addEntry(meal: Meal, food: Food, amount: Amount): Promise<void> {
  const e: Entry = { id: db.newId(), date: date.value, meal, foodRef: food.ref, createdAt: Date.now(), ...measure(amount) };
  // Recipes can be edited later; keep what was eaten as logged.
  if (food.ref.startsWith('recipe:')) e.snap = food.per100g;
  foods.value = new Map(foods.value).set(food.ref, food);
  entries.value = [...entries.value, e];
  await db.putEntry(e);
  await recordUse(food.ref, amount);
}

/** Normalise an Amount: unit and qty are stored together or not at all. */
function measure(a: Amount): Amount {
  return a.unit && a.qty ? { grams: a.grams, unit: a.unit, qty: a.qty } : { grams: a.grams };
}

export type EntryPatch = Partial<Pick<Entry, 'meal' | 'date' | 'foodRef'>> & { amount?: Amount };

export async function updateEntry(id: string, patch: EntryPatch): Promise<void> {
  const e = entries.value.find((x) => x.id === id) ?? (await db.getEntry(id));
  if (!e) return;
  const { amount, ...rest } = patch;
  const next: Entry = { ...e, ...rest };
  // A measure belongs to a food ("2 st" of egg ≠ 2 st of banana): swapping the food keeps the grams.
  if (amount || patch.foodRef) {
    delete next.unit;
    delete next.qty;
  }
  if (amount) Object.assign(next, measure(amount));
  if (patch.foodRef) {
    await ensureFoods([patch.foodRef]);
    delete next.snap;
    if (patch.foodRef.startsWith('recipe:')) next.snap = foods.value.get(patch.foodRef)?.per100g;
  }
  // Moving to another day removes it from the day on screen.
  entries.value =
    next.date === date.value
      ? entries.value.map((x) => (x.id === id ? next : x))
      : entries.value.filter((x) => x.id !== id);
  await db.putEntry(next);
}

export async function removeEntry(id: string): Promise<void> {
  entries.value = entries.value.filter((x) => x.id !== id);
  await db.deleteEntry(id);
}

export async function loadSettings(): Promise<void> {
  const s = await db.getSettings();
  if (s) {
    // Older versions stored overrides as plain min numbers.
    let next: Settings = { ...s, targetOverrides: normalizeOverrides(s.targetOverrides) };
    if ((s.version ?? 1) < db.SETTINGS_VERSION) {
      // One-time move to tdeecalculator.net's activity levels; saved once, and the user is told
      // if their automatic energy target changed.
      const { profile, kcalChanged } = migrateEnergyProfile(s.profile);
      next = { ...next, profile, version: db.SETTINGS_VERSION, ...(kcalChanged ? { energyNotice: true } : {}) };
      await db.saveSettings(next);
    }
    settings.value = next;
    lang.value = s.lang;
  }
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  settings.value = { ...settings.value, ...patch };
  lang.value = settings.value.lang;
  document.documentElement.lang = lang.value;
  await db.saveSettings(settings.value);
}

// --- Custom foods ---

/**
 * Load the user's own foods (custom foods, scanned products, recipes) in parallel and hand them to
 * search once — one Map copy and one worker message instead of one per table.
 */
export async function loadLibrary(): Promise<void> {
  const [custom, off, rec] = await Promise.all([db.listCustomFoods(), db.listOffFoods(), db.listRecipes()]);
  customFoods.value = custom;
  offFoods.value = off;
  recipes.value = rec;
  syncCustomFoods();
}

/** Hand the user's own foods (custom + scanned products) to search and to the foods map. */
function syncCustomFoods() {
  const custom = customFoods.value;
  const off = offFoods.value.map(toFood);
  const rec = recipes.value;
  const recFoods = rec.map((r) => recipeToFood(r, r));
  setCustomFoods(
    [...custom.filter((f) => !f.deleted).map(toFood), ...off, ...recFoods.filter((_, i) => !rec[i].deleted)],
    [...custom.map(toFood), ...off, ...recFoods],
  );
  const map = new Map(foods.value);
  for (const f of custom) map.set(f.ref, toFood(f));
  for (const f of off) map.set(f.ref, f);
  for (const f of recFoods) map.set(f.ref, f);
  foods.value = map;
}

function toFood({ ref, sv, en, per100g, units }: Food): Food {
  return units ? { ref, sv, en, per100g, units } : { ref, sv, en, per100g };
}

/**
 * Find a product by barcode: the local cache first (works offline), else Open Food Facts.
 * Throws OffError ('notFound' | 'network' | 'noData').
 */
export async function lookupBarcode(code: string): Promise<Food> {
  const ref = `off:${code}`;
  const cached = offFoods.value.find((f) => f.ref === ref) ?? (await db.getOffFood(ref));
  if (cached) return toFood(cached);
  const food = await fetchProduct(code);
  const off: OffFood = { ...food, fetchedAt: Date.now() };
  offFoods.value = [...offFoods.value.filter((f) => f.ref !== ref), off];
  syncCustomFoods();
  await db.putOffFood(off);
  return food;
}

/** Create (no ref) or update a custom food. Returns its ref. */
export async function saveCustomFood(input: { ref?: string; name: string; per100g: NutrientVector }): Promise<string> {
  const now = Date.now();
  const prev = input.ref ? customFoods.value.find((f) => f.ref === input.ref) : undefined;
  const food: CustomFood = {
    ref: prev?.ref ?? `custom:${db.newId()}`,
    sv: input.name.trim(),
    en: null,
    per100g: input.per100g,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    // Editing a deleted food (opened from an old diary entry) must not bring it back into search.
    ...(prev?.deleted ? { deleted: true } : {}),
  };
  customFoods.value = prev
    ? customFoods.value.map((f) => (f.ref === food.ref ? food : f))
    : [...customFoods.value, food];
  syncCustomFoods();
  await db.putCustomFood(food);
  return food.ref;
}

/** Hide a custom food from search; diary entries that use it keep working. */
export async function deleteCustomFood(ref: string): Promise<void> {
  const f = customFoods.value.find((x) => x.ref === ref);
  if (!f) return;
  const next = { ...f, deleted: true, updatedAt: Date.now() };
  customFoods.value = customFoods.value.map((x) => (x.ref === ref ? next : x));
  syncCustomFoods();
  await db.putCustomFood(next);
}

// --- Usage: recent, frequent, favourites ---

export async function loadUsage(): Promise<void> {
  usage.value = new Map((await db.listUsage()).map((u) => [u.foodRef, u]));
  setUserBoosts(userBoosts(usage.value));
}

/** Ranking boost from history: grows with use (log scale, capped), extra for favourites. */
export function userBoosts(map: Map<string, Usage>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const u of map.values()) {
    const b = Math.min(3, 0.75 * Math.log2(1 + u.count)) + (u.fav ? 2 : 0);
    if (b > 0) out[u.foodRef] = b;
  }
  return out;
}

async function putUsage(u: Usage) {
  usage.value = new Map(usage.value).set(u.foodRef, u);
  setUserBoosts(userBoosts(usage.value));
  await db.putUsage(u);
}

async function recordUse(ref: string, amount: Amount) {
  const prev = usage.value.get(ref);
  const m = measure(amount);
  await putUsage({
    foodRef: ref,
    fav: prev?.fav,
    count: (prev?.count ?? 0) + 1,
    lastUsed: Date.now(),
    lastGrams: m.grams,
    lastUnit: m.unit,
    lastQty: m.qty,
  });
}

export async function toggleFavourite(ref: string): Promise<void> {
  const prev = usage.value.get(ref);
  await putUsage({ foodRef: ref, count: 0, lastUsed: 0, lastGrams: 100, ...prev, fav: !prev?.fav });
}

function isHidden(ref: string) {
  return customFoods.value.some((f) => f.ref === ref && f.deleted);
}

/** Favourites (most used first) and other recently used foods (newest first). */
export const favourites = computed(() =>
  [...usage.value.values()].filter((u) => u.fav && !isHidden(u.foodRef)).sort((a, b) => b.count - a.count),
);
export const recent = computed(() =>
  [...usage.value.values()]
    .filter((u) => u.lastUsed > 0 && !u.fav && !isHidden(u.foodRef))
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 15),
);

// --- Copy meals / days ---

/** Copy the selected day's entries (optionally one meal) to another date and meal. */
export async function copyEntries(opts: { fromMeal?: Meal; toDate: string; toMeal?: Meal }): Promise<number> {
  const src = entries.value.filter((e) => !opts.fromMeal || e.meal === opts.fromMeal);
  const now = Date.now();
  const copies: Entry[] = src.map((e, i) => ({
    ...e,
    id: db.newId(),
    date: opts.toDate,
    meal: opts.toMeal ?? e.meal,
    createdAt: now + i, // keep the original order
  }));
  await db.putEntries(copies);
  if (opts.toDate === date.value) entries.value = [...entries.value, ...copies];
  return copies.length;
}

// --- User-defined household measures ---

export async function loadServings(): Promise<void> {
  userServings.value = new Map((await db.listServings()).map((s) => [s.foodRef, s.servings]));
}

export async function addServing(ref: string, s: Serving): Promise<void> {
  const list = [...(userServings.value.get(ref) ?? []).filter((x) => x.name !== s.name), s];
  userServings.value = new Map(userServings.value).set(ref, list);
  await db.putServings({ foodRef: ref, servings: list });
}

// --- Recipes ---

export type RecipeDraft = Pick<Recipe, 'name' | 'ingredients' | 'servings' | 'cookedWeightG'> & { ref?: string };

/** The recipe being edited (shared by the editor and the add-ingredient flow). */
export const recipeDraft = signal<RecipeDraft | null>(null);

/** Create (no ref) or update a recipe; nutrition is computed from the ingredients now. Returns its ref. */
export async function saveRecipe(draft: RecipeDraft): Promise<string> {
  await ensureFoods(draft.ingredients.map((i) => i.foodRef));
  // Snapshot each ingredient's values so it can't silently drop out later.
  const ingredients = draft.ingredients.map((i) => {
    const per100g = foods.value.get(i.foodRef)?.per100g ?? i.per100g;
    return per100g ? { ...i, per100g } : i;
  });
  const n = recipeNutrition({ ...draft, ingredients }, foods.value);
  // Never store under-counted nutrition (the editor blocks this too).
  if (n.missing.length) throw new Error(`Recipe ingredients without data: ${n.missing.join(', ')}`);
  const now = Date.now();
  const prev = draft.ref ? recipes.value.find((r) => r.ref === draft.ref) : undefined;
  const r: StoredRecipe = {
    ref: prev?.ref ?? `recipe:${db.newId()}`,
    name: draft.name.trim(),
    ingredients,
    servings: draft.servings,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
    per100g: n.per100g,
    portionG: n.portionG,
    totalG: n.totalG,
  };
  if (draft.cookedWeightG) r.cookedWeightG = draft.cookedWeightG;
  recipes.value = prev ? recipes.value.map((x) => (x.ref === r.ref ? r : x)) : [...recipes.value, r];
  syncCustomFoods();
  await db.putRecipe(r);
  return r.ref;
}

/** Hide a recipe from search; diary entries that use it keep working. */
export async function deleteRecipe(ref: string): Promise<void> {
  const r = recipes.value.find((x) => x.ref === ref);
  if (!r) return;
  const next = { ...r, deleted: true, updatedAt: Date.now() };
  recipes.value = recipes.value.map((x) => (x.ref === ref ? next : x));
  syncCustomFoods();
  await db.putRecipe(next);
}
