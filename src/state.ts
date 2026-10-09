// App-wide reactive state (Preact signals) and the actions that change it.
import { computed, signal } from '@preact/signals';
import * as db from './lib/db';
import type { Entry, Meal, Settings } from './lib/db';
import { getFoods } from './lib/foods';
import { lang } from './lib/i18n';
import type { Food } from './lib/nutrients';
import { DEFAULT_PROFILE, nnrTargets, type Target } from './lib/targets';
import { scale, sum } from './lib/totals';

export type View = 'diary' | 'nutrients' | 'settings';

export const view = signal<View>('diary');
export const date = signal(db.isoDate(new Date()));
export const entries = signal<Entry[]>([]);
export const foods = signal<Map<string, Food>>(new Map());
export const settings = signal<Settings>({
  lang: lang.value,
  profile: DEFAULT_PROFILE,
  targetOverrides: {},
});
/** Meal the add-food sheet is open for, or null when closed. */
export const addingTo = signal<Meal | null>(null);

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
  if (list.length) {
    const found = await getFoods(list.map((e) => e.foodRef));
    foods.value = new Map([...foods.value, ...found]);
  }
}

export async function addEntry(meal: Meal, food: Food, grams: number): Promise<void> {
  const e: Entry = { id: db.newId(), date: date.value, meal, foodRef: food.ref, grams, createdAt: Date.now() };
  foods.value = new Map(foods.value).set(food.ref, food);
  entries.value = [...entries.value, e];
  await db.putEntry(e);
}

export async function updateGrams(id: string, grams: number): Promise<void> {
  const e = entries.value.find((x) => x.id === id);
  if (!e) return;
  const next = { ...e, grams };
  entries.value = entries.value.map((x) => (x.id === id ? next : x));
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
