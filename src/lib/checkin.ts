// Weekly check-in (M26, opt-in): the week before, in a few calm lines. Pure helpers; the sheet
// (components/CheckIn.tsx) loads the data.
import { addDays } from './db';
import { NUTRIENT_INDEX } from './nutrients';
import type { Target } from './targets';

/** ISO week (Monday–Sunday) of a date: key like "2026-W41", first and last day. */
export function isoWeek(date: string): { key: string; start: string; end: string } {
  const [y, m, d] = date.split('-').map(Number);
  const day = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const start = addDays(date, -day);
  // The ISO year/week is that of the week's Thursday.
  const thu = addDays(start, 3);
  const [ty, tm, td] = thu.split('-').map(Number);
  const jan1 = new Date(ty, 0, 1);
  // Whole days (round: a summer-time date is an hour short of a whole number of days from 1 Jan).
  const days = Math.round((new Date(ty, tm - 1, td).getTime() - jan1.getTime()) / 864e5);
  const week = Math.floor(days / 7) + 1;
  return { key: `${ty}-W${String(week).padStart(2, '0')}`, start, end: addDays(start, 6) };
}

/** The last complete week before `today`'s week. */
export const previousWeek = (today: string) => isoWeek(addDays(isoWeek(today).start, -1));

/** Change of the average weigh-in from the week before to this week (kg), or null without weigh-ins in both. */
export function weightChange(weighIns: { date: string; kg: number }[], week: { start: string; end: string }): number | null {
  const before = addDays(week.start, -7);
  const avg = (from: string, to: string) => {
    const w = weighIns.filter((x) => x.date >= from && x.date <= to);
    return w.length ? w.reduce((s, x) => s + x.kg, 0) / w.length : null;
  };
  const a = avg(before, addDays(week.start, -1));
  const b = avg(week.start, week.end);
  return a == null || b == null ? null : Math.round((b - a) * 10) / 10;
}

export type Positive = { kind: 'logged'; days: number } | { kind: 'energy' } | { kind: 'nutrient'; key: string };

/** Nutrients worth a word of credit when reached on average (main ones people track). */
const CREDIT = ['protein', 'fibre', 'vitC', 'iron', 'folate', 'calcium', 'vitD', 'potassium'];

/**
 * What went well (at most 2): logging most days, energy close to the target, and nutrients reached on
 * average (only those the week's foods mostly report — `covered`).
 */
export function positives(amounts: number[], targets: Record<string, Target>, daysLogged: number, covered: boolean[]): Positive[] {
  const out: Positive[] = [];
  if (daysLogged >= 6) out.push({ kind: 'logged', days: daysLogged });
  const kcal = targets.kcal?.min;
  if (kcal && Math.abs(amounts[NUTRIENT_INDEX.kcal] - kcal) <= kcal * 0.1) out.push({ kind: 'energy' });
  for (const key of CREDIT) {
    const i = NUTRIENT_INDEX[key];
    const min = targets[key]?.min;
    if (min && covered[i] && amounts[i] >= min) out.push({ kind: 'nutrient', key });
  }
  return out.slice(0, 2);
}
