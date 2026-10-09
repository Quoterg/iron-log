import { NUTRIENTS, type NutrientVector } from './nutrients';

/** Scale a per-100 g vector to an amount in grams. */
export function scale(per100g: NutrientVector, grams: number): number[] {
  const f = grams / 100;
  return per100g.map((v) => (v ?? 0) * f);
}

/** Sum nutrient vectors (missing values count as 0). */
export function sum(vectors: number[][]): number[] {
  const out = new Array<number>(NUTRIENTS.length).fill(0);
  for (const v of vectors) for (let i = 0; i < out.length; i++) out[i] += v[i] ?? 0;
  return out;
}

export interface MacroSplit {
  protein: number;
  carbs: number;
  fat: number;
  alcohol: number;
}

/** Share of energy (0–1) from each macronutrient, using Atwater factors. */
export function energySplit(protein: number, carbs: number, fat: number, alcohol: number): MacroSplit {
  const p = protein * 4, c = carbs * 4, f = fat * 9, a = alcohol * 7;
  const total = p + c + f + a;
  if (total === 0) return { protein: 0, carbs: 0, fat: 0, alcohol: 0 };
  return { protein: p / total, carbs: c / total, fat: f / total, alcohol: a / total };
}
