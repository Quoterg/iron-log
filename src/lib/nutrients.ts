import list from './nutrients.json';

export type NutrientGroup = 'energy' | 'macro' | 'carb' | 'lipid' | 'other' | 'vitamin' | 'mineral';

export interface Nutrient {
  key: string;
  unit: string;
  group: NutrientGroup;
  sv: string;
  en: string;
}

/** All tracked nutrients. Food vectors use this order. */
export const NUTRIENTS = list as (Nutrient & { slv: string })[];

export const NUTRIENT_INDEX: Record<string, number> = Object.fromEntries(
  NUTRIENTS.map((n, i) => [n.key, i]),
);

/** Per-100 g nutrient values in NUTRIENTS order; null = not analysed. */
export type NutrientVector = (number | null)[];

export interface Food {
  /** `<source>:<id>`, e.g. `slv:123`, `custom:<uuid>`. */
  ref: string;
  sv: string;
  en: string | null;
  per100g: NutrientVector;
}

export function foodName(food: Food, lang: string): string {
  return lang === 'en' ? (food.en ?? food.sv) : food.sv;
}

export function value(v: NutrientVector, key: string): number {
  return v[NUTRIENT_INDEX[key]] ?? 0;
}
