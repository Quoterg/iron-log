// App-wide reactive state (Preact signals) and the actions that change it.
import { computed, signal } from '@preact/signals';
import * as db from './lib/db';
import type { CustomFood, Entry, Meal, Settings } from './lib/db';
import { getFoods, setCustomFoods } from './lib/foods';
import { lang } from './lib/i18n';
import type { Food, NutrientVector } from './lib/nutrients';
import { DEFAULT_PROFILE, nnrTargets, type Target } from './lib/targets';
import { scale, sum } from './lib/totals';

export type View = 'diary' | 'nutrients' | 'settings';

export const view = signal<View>('diary');
export const date = signal(db.isoDate(new Date()));
export const entries = signal<Entry[]>([]);
/** Every food referenced on screen, built-in or custom, by ref. */
export const foods = signal<Map<string, Food>>(new Map());
export const customFoods = signal<CustomFood[]>([]);
export const settings = signal<Settings>({
  lang: lang.value,
  profile: DEFAULT_PROFILE,
  targetOverrides: {},
});

export const targets = computed<Record<string, Target>>(() => {
  const s = settings.value;
  const t = nnrTargets(s.profile);
  for (const [k, min] of Object.entries(s.targetOverrides)) t[k] = { ...t[k], min };
  return t;
});

/** Nutrient totals for the selected day, in NUTRIENTS order. */
export const dayTotals = computed(() =>
  sum(
    entries.value.flatMap((e) => {
      const f = foods.value.get(e.foodRef);
      return f ? [scale(f.per100g, e.grams)] : [];
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

export async function addEntry(meal: Meal, food: Food, grams: number): Promise<void> {
  const e: Entry = { id: db.newId(), date: date.value, meal, foodRef: food.ref, grams, createdAt: Date.now() };
  foods.value = new Map(foods.value).set(food.ref, food);
  entries.value = [...entries.value, e];
  await db.putEntry(e);
}

export type EntryPatch = Partial<Pick<Entry, 'grams' | 'meal' | 'date' | 'foodRef'>>;

export async function updateEntry(id: string, patch: EntryPatch): Promise<void> {
  const e = entries.value.find((x) => x.id === id) ?? (await db.getEntry(id));
  if (!e) return;
  const next = { ...e, ...patch };
  // Moving to another day removes it from the day on screen.
  entries.value =
    next.date === date.value
      ? entries.value.map((x) => (x.id === id ? next : x))
      : entries.value.filter((x) => x.id !== id);
  if (patch.foodRef) await ensureFoods([patch.foodRef]);
  await db.putEntry(next);
}

export async function removeEntry(id: string): Promise<void> {
  entries.value = entries.value.filter((x) => x.id !== id);
  await db.deleteEntry(id);
}

export async function loadSettings(): Promise<void> {
  const s = await db.getSettings();
  if (s) {
    settings.value = s;
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

export async function loadCustomFoods(): Promise<void> {
  customFoods.value = await db.listCustomFoods();
  syncCustomFoods();
}

function syncCustomFoods() {
  const list = customFoods.value;
  setCustomFoods(list.filter((f) => !f.deleted).map(toFood), list.map(toFood));
  const map = new Map(foods.value);
  for (const f of list) map.set(f.ref, toFood(f));
  foods.value = map;
}

function toFood({ ref, sv, en, per100g }: CustomFood): Food {
  return { ref, sv, en, per100g };
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
