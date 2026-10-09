// Exercise and water: energy burned, and the stored records. The activity table itself lives in
// activity-types.ts (loaded only when needed — it isn't part of the first screen).

/** Weight assumed when the profile has none (shown to the user). */
export const DEFAULT_WEIGHT_KG = 70;

/**
 * Energy burned *on top of resting* (kcal): (MET − 1) × kg × hours. Resting energy is already
 * part of the daily energy need, so counting the full MET would double-count it.
 */
export function burnedKcal(met: number, weightKg: number, minutes: number): number {
  return Math.round(Math.max(0, met - 1) * weightKg * (minutes / 60));
}

export interface Activity {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: string;
  minutes: number;
  kcal: number;
  createdAt: number;
}

export interface Water {
  /** YYYY-MM-DD */
  date: string;
  ml: number;
}
