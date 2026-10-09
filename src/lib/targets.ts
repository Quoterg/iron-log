// Daily targets from the Nordic Nutrition Recommendations 2023 (NNR 2023),
// adults 25–50 years. RI = recommended intake, AI = adequate intake.
// Source: https://pub.norden.org/nord2023-003/ (tables 12–15), cross-checked with
// Helsedirektoratet's NNR 2023 summary. Users can override every value.

export type Sex = 'female' | 'male';

export interface Profile {
  sex: Sex;
  kcal: number;
}

export interface Target {
  /** Lower bound to reach (RI/AI) — or null if only a limit applies. */
  min: number | null;
  /** Upper limit not to exceed — or null. */
  max: number | null;
}

type Pair = [female: number, male: number];

const MICROS: Record<string, Pair> = {
  vitA: [700, 800],
  vitD: [10, 10],
  vitE: [10, 11],
  riboflavin: [1.6, 1.6],
  vitB6: [1.6, 1.8],
  folate: [330, 330],
  vitB12: [4, 4],
  vitC: [95, 110],
  calcium: [950, 950],
  phosphorus: [520, 520],
  potassium: [3500, 3500],
  magnesium: [300, 350],
  iron: [15, 9],
  zinc: [9.7, 12.7],
  iodine: [150, 150],
  selenium: [75, 90],
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9, alcohol: 7 } as const;

export const DEFAULT_PROFILE: Profile = { sex: 'female', kcal: 2000 };

export function defaultKcal(sex: Sex): number {
  return sex === 'male' ? 2500 : 2000;
}

/** NNR 2023 defaults for a profile. */
export function nnrTargets(p: Profile): Record<string, Target> {
  const i = p.sex === 'male' ? 1 : 0;
  const mj = p.kcal * 0.004184;
  const ePct = (key: keyof typeof KCAL_PER_G, lo: number | null, hi: number | null): Target => ({
    min: lo == null ? null : Math.round((p.kcal * lo) / 100 / KCAL_PER_G[key]),
    max: hi == null ? null : Math.round((p.kcal * hi) / 100 / KCAL_PER_G[key]),
  });

  const t: Record<string, Target> = {
    kcal: { min: p.kcal, max: null },
    protein: ePct('protein', 10, 20),
    carbs: ePct('carbs', 45, 60),
    fat: ePct('fat', 25, 40),
    fibre: { min: p.sex === 'male' ? 35 : 25, max: null },
    satFat: { min: null, max: Math.round((p.kcal * 0.1) / 9) },
    addedSugar: { min: null, max: Math.round((p.kcal * 0.1) / 4) },
    // Thiamin and niacin are set per MJ of energy intake.
    thiamin: { min: round1(0.1 * mj), max: null },
    niacin: { min: round1(1.6 * mj), max: null },
    sodium: { min: 1500, max: 2300 },
    salt: { min: null, max: 6 },
  };
  for (const [key, pair] of Object.entries(MICROS)) t[key] = { min: pair[i], max: null };
  return t;
}

function round1(x: number) {
  return Math.round(x * 10) / 10;
}

/** Fraction (0..∞) of the target reached; null when the nutrient has no lower target. */
export function progress(amount: number, target: Target | undefined): number | null {
  if (!target) return null;
  if (target.min) return amount / target.min;
  if (target.max) return amount / target.max;
  return null;
}
