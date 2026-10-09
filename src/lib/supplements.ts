// Supplements are custom foods measured per unit (tablet, capsule, ml…). One unit is stored as
// weighing 1 g, so per-100 g values are the per-unit amounts × 100 and "1 tablett" = 1 g gives
// exactly the label's amounts — logging, totals, reports and backups need no special cases.
import type { NutrientVector, Serving } from './nutrients';

export type SupplementTime = 'morning' | 'midday' | 'evening' | 'night';
export const SUPPLEMENT_TIMES: SupplementTime[] = ['morning', 'midday', 'evening', 'night'];

export interface SupplementInfo {
  /** What one unit is called, e.g. "tablett", "kapsel", "ml". */
  unit: string;
  /** Units per day for the daily checklist; 0 = taken as needed (not on the checklist). */
  perDay: number;
  /** Weekdays it's on the checklist (0 = Monday … 6 = Sunday); absent = every day. */
  days?: number[];
  /** When in the day it's taken: orders the checklist. */
  time?: SupplementTime;
}

/** 0 = Monday … 6 = Sunday, for a local YYYY-MM-DD date. */
export function weekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** On the daily checklist for this date (daily supplements on their scheduled weekdays). */
export const scheduledOn = (s: SupplementInfo, date: string): boolean =>
  s.perDay > 0 && (!s.days || s.days.includes(weekday(date)));

/** Stored form of a day selection: sorted, and absent when it's every day. */
export const normalizeDays = (days: number[]): number[] | undefined => (days.length >= 7 ? undefined : [...days].sort());

/** Checklist order: by time of day (unset last), then the caller's order (Array.sort is stable). */
export const timeRank = (s: SupplementInfo): number => (s.time ? SUPPLEMENT_TIMES.indexOf(s.time) : SUPPLEMENT_TIMES.length);

export const UNIT_GRAMS = 1;

export const perUnitToPer100g = (perUnit: NutrientVector): NutrientVector => perUnit.map((v) => (v == null ? null : v * 100));
export const per100gToPerUnit = (per100g: NutrientVector): NutrientVector => per100g.map((v) => (v == null ? null : v / 100));

export function supplementServings(s: SupplementInfo): Serving[] {
  return [{ name: s.unit, g: UNIT_GRAMS }];
}
