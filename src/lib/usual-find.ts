// "Your usual": the rules (see usual.ts). Loaded on demand, once a day, for today's diary.
import { addDays, isoDate, type Entry, type Meal } from './db';
import { itemsFromEntries } from './templates';
import { DEFAULT_WINDOW, USUAL_RULES, type UsualMeal } from './usual';

const weekend = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  const w = new Date(y, m - 1, d).getDay();
  return w === 0 || w === 6;
};

/** The last 6 days before `today` of the same kind (weekday or weekend), newest first. */
export function comparableDays(today: string): string[] {
  const out: string[] = [];
  for (let i = 1; i <= USUAL_RULES.maxLookback && out.length < USUAL_RULES.comparableDays; i++) {
    const d = addDays(today, -i);
    if (weekend(d) === weekend(today)) out.push(d);
  }
  return out;
}

/** Share of `a`'s energy that comes from foods also in `b`. */
function share(a: Map<string, number>, b: Map<string, number>): number {
  let total = 0;
  let same = 0;
  for (const [ref, w] of a) {
    total += w;
    if (b.has(ref)) same += w;
  }
  return total ? same / total : 0;
}

/**
 * The usual `meal` for `today`, from the entries of the days before (any range covering the
 * comparable days; supplements already filtered out), or null if there is none.
 * `kcalOf` gives an entry's energy.
 */
export function findUsual(today: string, meal: Meal, entries: Entry[], kcalOf: (e: Entry) => number): UsualMeal | null {
  const days = comparableDays(today);
  const byDay = days.map((d) => entries.filter((e) => e.date === d && e.meal === meal));
  // Each day's meal as food → energy (at least a little weight, so coffee or water still count).
  const vec = byDay.map((list) => {
    const m = new Map<string, number>();
    for (const e of list) m.set(e.foodRef, (m.get(e.foodRef) ?? 0) + Math.max(1, kcalOf(e)));
    return m;
  });
  const same = (i: number, j: number) =>
    vec[i].size > 0 && vec[j].size > 0 && share(vec[i], vec[j]) >= USUAL_RULES.sameShare && share(vec[j], vec[i]) >= USUAL_RULES.sameShare;
  // Newest first: the most recent qualifying day gives the foods and amounts.
  for (let i = 0; i < days.length; i++) {
    const matching = days.map((_, j) => j).filter((j) => same(i, j));
    if (matching.length < USUAL_RULES.minDays) continue;
    return {
      meal,
      items: itemsFromEntries(byDay[i]),
      kcal: byDay[i].reduce((s, e) => s + kcalOf(e), 0),
      window: windowFor(meal, matching.map((j) => byDay[j])),
    };
  }
  return null;
}

/**
 * When the user usually logs this meal: from an hour before to 1½ hours after their own logging
 * times on those days (only entries logged on the day itself count), else the meal's default window.
 */
function windowFor(meal: Meal, days: Entry[][]): [number, number] {
  const times: number[] = [];
  for (const list of days) {
    const first = list.find((e) => isoDate(new Date(e.createdAt)) === e.date);
    if (first) {
      const t = new Date(first.createdAt);
      times.push(t.getHours() * 60 + t.getMinutes());
    }
  }
  if (times.length < USUAL_RULES.minDays - 1) return DEFAULT_WINDOW[meal];
  const from = Math.max(0, Math.min(...times) - 60);
  const to = Math.min(24 * 60 - 1, Math.max(...times) + 90);
  // Logged at all hours (e.g. everything in the evening): the times say nothing — use the default.
  return to - from > 6 * 60 ? DEFAULT_WINDOW[meal] : [from, to];
}
