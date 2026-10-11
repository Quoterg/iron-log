// "Your usual": offer a whole meal only when it truly is the usual — never as noise.
// A meal counts as the usual when the same meal (≥ 80 % of its energy from the same foods, both
// ways) was logged in that slot on ≥ 4 of the last 6 comparable days (weekdays and weekends are
// compared separately), it is the time of day the user usually logs it, the meal is still empty,
// and the user hasn't dismissed it today or paused it (3 dismissals in a row → 14 days off).
// The rules run in usual-find.ts (loaded on demand); this module is what the diary needs.
import { addDays, type Meal } from './db';
import type { TemplateItem } from './templates';

export const USUAL_RULES = { comparableDays: 6, minDays: 4, sameShare: 0.8, maxLookback: 21, pauseAfter: 3, pauseDays: 14 };

export interface UsualMeal {
  meal: Meal;
  items: TemplateItem[];
  kcal: number;
  /** Minutes after midnight when it may be offered: [from, to]. */
  window: [number, number];
}

/** When each meal is offered if the user's own logging times don't tell (minutes after midnight). */
export const DEFAULT_WINDOW: Record<Meal, [number, number]> = {
  breakfast: [5 * 60, 10 * 60 + 30],
  lunch: [10 * 60 + 30, 14 * 60 + 30],
  dinner: [16 * 60, 21 * 60],
  snack: [14 * 60 + 30, 16 * 60],
};

/**
 * The one meal to offer now (one card at most): among usual meals that are empty, in their time
 * window and not dismissed, the one whose window started most recently.
 */
export function pickUsual(usual: Partial<Record<Meal, UsualMeal>>, empty: (m: Meal) => boolean, s: UsualState, today: string, now: Date): Meal | null {
  let best: UsualMeal | null = null;
  for (const u of Object.values(usual)) {
    if (!u || !empty(u.meal) || !inWindow(u, now) || hidden(s, u.meal, today)) continue;
    if (!best || u.window[0] > best.window[0]) best = u;
  }
  return best?.meal ?? null;
}

export const inWindow = (u: UsualMeal, now: Date) => {
  const m = now.getHours() * 60 + now.getMinutes();
  return m >= u.window[0] && m <= u.window[1];
};

/** The meal to add to right now (home-screen shortcut): by the default times of day. */
export function mealAt(now: Date): Meal {
  const m = now.getHours() * 60 + now.getMinutes();
  const hit = (['breakfast', 'lunch', 'dinner'] as const).find((k) => m >= DEFAULT_WINDOW[k][0] && m < DEFAULT_WINDOW[k][1]);
  return hit ?? 'snack';
}

// --- Dismissals: per device (a convenience, not synced) ---

export interface SlotState {
  /** Day it was last dismissed. */
  last?: string;
  /** Dismissals in a row (days), without logging it in between. */
  streak?: number;
  /** Not offered before this day. */
  pausedUntil?: string;
}
export type UsualState = Partial<Record<Meal, SlotState>>;

export function dismiss(s: UsualState, meal: Meal, today: string): UsualState {
  const cur = s[meal] ?? {};
  const streak = cur.last === today ? (cur.streak ?? 1) : (cur.streak ?? 0) + 1;
  const next: SlotState = streak >= USUAL_RULES.pauseAfter ? { last: today, streak: 0, pausedUntil: addDays(today, USUAL_RULES.pauseDays) } : { ...cur, last: today, streak };
  return { ...s, [meal]: next };
}

/** Logged it: the dismissal streak starts over. */
export function accept(s: UsualState, meal: Meal): UsualState {
  const cur = s[meal];
  return cur?.streak ? { ...s, [meal]: { ...cur, streak: 0 } } : s;
}

/**
 * The meal was logged (any way) on a day after the last dismissal: the dismissals weren't "in a
 * row", so the streak starts over. `loggedDays`: days on which the meal has entries.
 */
export function resetIfLogged(s: UsualState, meal: Meal, loggedDays: Iterable<string>): UsualState {
  const cur = s[meal];
  if (!cur?.streak || !cur.last) return s;
  for (const d of loggedDays) if (d > cur.last) return accept(s, meal);
  return s;
}

export function hidden(s: UsualState, meal: Meal, today: string): boolean {
  const cur = s[meal];
  return !!cur && (cur.last === today || (!!cur.pausedUntil && today < cur.pausedUntil));
}
