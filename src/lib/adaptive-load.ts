// Loads the adaptive estimate's inputs (M25): the last 4 weeks of intake and weigh-ins. Used by the
// Settings card, the weekly check-in and the weekly follow (M35); loaded with them, never up front.
import { ADAPTIVE, estimate, type DayIntake, type Estimate } from './adaptive';
import { addDays, bodyBetween, daysCompleteBetween, entriesBetween, entryVector, isoDate, localChanges } from './db';
import { value } from './nutrients';
import { ensureFoods, foods } from '../state';

/** The last estimate, reused while nothing changed (same day, no writes on this device). */
let cached: { key: string; est: Estimate } | undefined;

/** The last 4 weeks of intake (ending yesterday) and weigh-ins, read from the diary and body log. */
export async function loadEstimate(): Promise<Estimate> {
  const today = isoDate(new Date());
  const key = `${today}|${localChanges}`;
  if (cached?.key === key) return cached.est;
  const from = addDays(today, -ADAPTIVE.windowDays);
  const to = addDays(today, -1);
  const [list, marks, body] = await Promise.all([entriesBetween(from, to), daysCompleteBetween(from, to), bodyBetween(from, today)]);
  await ensureFoods([...new Set(list.map((e) => e.foodRef))]);
  const kcal = new Map<string, number>();
  const unknown = new Set<string>();
  for (const e of list) {
    const v = entryVector(e, foods.value);
    if (v) kcal.set(e.date, (kcal.get(e.date) ?? 0) + (value(v, 'kcal') * e.grams) / 100);
    else unknown.add(e.date);
  }
  const days: DayIntake[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, kcal: kcal.get(d) ?? 0, complete: marks.has(d), unknown: unknown.has(d) });
  const weighIns = body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, kg: b.weightKg! }));
  const est = estimate(days, weighIns);
  cached = { key, est };
  return est;
}

