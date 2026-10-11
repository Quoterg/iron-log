// Saved meals ("templates"): a named set of foods and amounts, logged again in one tap.
import type { Entry } from './db';

export interface TemplateItem {
  foodRef: string;
  grams: number;
  /** Household measure it was logged with (grams stays the source of truth). */
  unit?: string;
  qty?: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  items: TemplateItem[];
  createdAt: number;
  updatedAt: number;
}

/** Per device: how often (`n`) and when (`last`) each saved meal was logged, by id. */
export type TemplateUse = Record<string, { n: number; last: number } | undefined>;

export const MAX_TEMPLATE_ITEMS = 50;
export const MAX_TEMPLATE_NAME = 80;

/** The foods and amounts of logged entries, in logged order. */
export function itemsFromEntries(entries: Entry[]): TemplateItem[] {
  return [...entries]
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, MAX_TEMPLATE_ITEMS)
    .map((e) => (e.unit && e.qty ? { foodRef: e.foodRef, grams: e.grams, unit: e.unit, qty: e.qty } : { foodRef: e.foodRef, grams: e.grams }));
}

/** A first suggestion for the name: the first foods, e.g. "Havregryn, mjölk, banan". */
export function suggestName(names: string[]): string {
  const first = names.slice(0, 3).map((n) => n.split(',')[0].trim());
  const s = first.join(', ') + (names.length > 3 ? ' …' : '');
  return s.slice(0, MAX_TEMPLATE_NAME);
}

/** Most used first, then most recently used, then by name. */
export function sortTemplates(list: MealTemplate[], use: TemplateUse, lang: string): MealTemplate[] {
  const n = (m: MealTemplate) => use[m.id]?.n ?? 0;
  const last = (m: MealTemplate) => use[m.id]?.last ?? 0;
  return [...list].sort((a, b) => n(b) - n(a) || last(b) - last(a) || a.name.localeCompare(b.name, lang));
}
