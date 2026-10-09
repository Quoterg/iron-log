// Daily targets from the Nordic Nutrition Recommendations 2023 (NNR 2023).
// RI = recommended intake, AI = adequate intake. Values per sex, age band (18–24, 25–50,
// 51–70, 71+), pregnancy trimester and lactation, as tabulated by Helsedirektoratet's NNR 2023
// summary (tables 8–12): https://www.helsedirektoratet.no/rapporter/referanseverdier-for-energi-og-naeringsstoffer
// Official report: https://pub.norden.org/nord2023-003/ — users can override every value.

export type Sex = 'female' | 'male';
export type Status = 'none' | 'pregnant1' | 'pregnant2' | 'pregnant3' | 'lactating';

export interface Profile {
  sex: Sex;
  /** Effective daily energy target (kcal): computed when `kcalAuto`, else typed by the user. */
  kcal: number;
  kcalAuto?: boolean;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  /** Physical activity level (NNR: 1.4 low, 1.6 average/reference, 1.8 active, 2.0 very active). */
  pal?: number;
  status?: Status;
  /** Women: still menstruating (iron 15 mg). Defaults to age < 51. */
  menstruating?: boolean;
}

export interface Target {
  /** Lower bound to reach (RI/AI) — or null if only a limit applies. */
  min: number | null;
  /** Upper limit not to exceed — or null. */
  max: number | null;
}

export const PAL_LEVELS = [1.4, 1.6, 1.8, 2.0] as const;
export const DEFAULT_PROFILE: Profile = { sex: 'female', kcal: 2000 };

export function defaultKcal(sex: Sex): number {
  return sex === 'male' ? 2500 : 2000;
}

const KCAL_PER_MJ = 239.006;

/** Extra energy per day (NNR 2023, as summarised by DTU Food 2025): +0.3/+1.2/+2.3 MJ by trimester; +2.0 MJ when exclusively breastfeeding. */
const EXTRA_MJ: Record<Status, number> = { none: 0, pregnant1: 0.3, pregnant2: 1.2, pregnant3: 2.3, lactating: 2.0 };

/**
 * Energy need = BMR × PAL (+ pregnancy/lactation). BMR by Mifflin–St Jeor; NNR 2023 uses the
 * Henry equations, which give values within a few percent for adults. Null if data is missing.
 */
export function energyNeed(p: Profile): number | null {
  const { age, weightKg: w, heightCm: h } = p;
  if (!age || !w || !h) return null;
  const bmr = 10 * w + 6.25 * h - 5 * age + (p.sex === 'male' ? 5 : -161);
  const extra = p.sex === 'female' ? EXTRA_MJ[p.status ?? 'none'] * KCAL_PER_MJ : 0;
  return Math.round((bmr * (p.pal ?? 1.6) + extra) / 10) * 10;
}

/** The profile with `kcal` recomputed when energy is automatic and enough data is known. */
export function withEnergy(p: Profile): Profile {
  if (!p.kcalAuto) return p;
  const kcal = energyNeed(p);
  return kcal ? { ...p, kcal } : p;
}

type Pair = [female: number, male: number];

/** Adults 25–50 (the reference band). */
const BASE: Record<string, Pair> = {
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

/** Differences from BASE by age band. */
const BY_AGE: Record<'18-24' | '51-70' | '71+', Partial<Record<string, Pair>>> = {
  '18-24': { calcium: [1000, 1000], phosphorus: [550, 550] },
  '51-70': { vitE: [9, 11], zinc: [9.5, 12.4] },
  '71+': { vitA: [650, 750], vitD: [20, 20], vitE: [9, 11], vitB6: [1.6, 1.7], zinc: [9.3, 12.1], selenium: [75, 85] },
};

/** Pregnancy (by trimester) and lactation, replacing the female values. */
const BY_STATUS: Record<Exclude<Status, 'none'>, Partial<Record<string, number>>> = {
  pregnant1: { vitA: 750, vitE: 10, riboflavin: 1.6, vitB6: 1.6, folate: 600, vitB12: 4.5, vitC: 105, calcium: 950, phosphorus: 520, iron: 24, zinc: 9.7, iodine: 175, selenium: 80 },
  pregnant2: { vitA: 750, vitE: 11, riboflavin: 1.7, vitB6: 1.8, folate: 600, vitB12: 4.5, vitC: 105, calcium: 950, phosphorus: 520, iron: 25, zinc: 12.1, iodine: 200, selenium: 85 },
  pregnant3: { vitA: 750, vitE: 12, riboflavin: 1.8, vitB6: 2.0, folate: 600, vitB12: 4.5, vitC: 105, calcium: 950, phosphorus: 520, iron: 26, zinc: 12.1, iodine: 200, selenium: 90 },
  lactating: { vitA: 1400, vitE: 11, riboflavin: 2.0, vitB6: 1.7, folate: 490, vitB12: 5.5, vitC: 155, calcium: 950, phosphorus: 520, iron: 15, zinc: 12.6, iodine: 200, selenium: 85 },
};

const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export function ageBand(age?: number): '18-24' | '25-50' | '51-70' | '71+' {
  if (!age || (age >= 25 && age <= 50)) return '25-50';
  if (age < 25) return '18-24';
  return age <= 70 ? '51-70' : '71+';
}

/** NNR 2023 targets for a profile. */
export function nnrTargets(p: Profile): Record<string, Target> {
  const i = p.sex === 'male' ? 1 : 0;
  const band = ageBand(p.age);
  const status = p.sex === 'female' ? (p.status ?? 'none') : 'none';
  const mj = p.kcal / KCAL_PER_MJ;
  const ePct = (key: keyof typeof KCAL_PER_G, lo: number | null, hi: number | null): Target => ({
    min: lo == null ? null : Math.round((p.kcal * lo) / 100 / KCAL_PER_G[key]),
    max: hi == null ? null : Math.round((p.kcal * hi) / 100 / KCAL_PER_G[key]),
  });
  const older = (p.age ?? 0) > 65;

  const t: Record<string, Target> = {
    kcal: { min: p.kcal, max: null },
    // Older adults (>65): 15–20 E% protein (NNR 2023, Box 8 as corrected).
    protein: ePct('protein', older ? 15 : 10, 20),
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
  for (const [key, pair] of Object.entries(BASE)) {
    const v = (band !== '25-50' ? BY_AGE[band][key] : undefined) ?? pair;
    t[key] = { min: v[i], max: null };
  }
  if (p.sex === 'female') {
    // Iron: 15 mg while menstruating; after menopause 8 mg (7 mg from 71).
    const menstruating = p.menstruating ?? (p.age == null || p.age < 51);
    t.iron = { min: menstruating ? 15 : band === '71+' ? 7 : 8, max: null };
  }
  if (status !== 'none') for (const [key, v] of Object.entries(BY_STATUS[status])) t[key] = { min: v!, max: null };
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
