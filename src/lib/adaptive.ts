// Adaptive energy expenditure (opt-in): what the user really burns, from how their weight changed
// against what they logged over the last 4 weeks — energy balance, ≈ 7700 kcal per kg of body
// weight. Never changes a target by itself; the user can choose to apply a suggested one.
// Loaded with the Settings screen only.
import { KCAL_PER_KG } from './targets';

export { allowedPaces, goalTarget, GOALS, minIntake, PACES, type Goal } from './targets';

export const ADAPTIVE = {
  /** Days looked at (ending yesterday: today isn't finished). */
  windowDays: 28,
  minDays: 10,
  minWeighIns: 3,
  /** The weigh-ins must span at least this many days. */
  minSpanDays: 14,
  kcalPerKg: KCAL_PER_KG,
  /** An unmarked day below this share of the typical (median) intake counts as incomplete. */
  lowShare: 0.6,
  /** Day-to-day scale noise (water, food in the gut) the trend can't see through, in kg. */
  scaleNoiseKg: 0.3,
};

/** Two-sided 95 % t-quantiles for 1–10 degrees of freedom (≈ 2 beyond). */
const T95 = [12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23];

/** One day's logged energy, and whether the user marked it complete. */
export interface DayIntake {
  date: string;
  kcal: number;
  complete: boolean;
  /** Some of the day's foods have no data here (e.g. a source turned off): its energy is unknown. */
  unknown?: boolean;
}

export interface WeighIn {
  date: string;
  kg: number;
}

export type Estimate =
  | {
      ok: true;
      /** Daily expenditure (kcal), rounded to 10. */
      kcal: number;
      /** ± about 95 % (intake, trend and scale noise), rounded to 10. */
      plusMinus: number;
      days: number;
      weighIns: number;
      /** Weight trend, kg per week (negative = losing). */
      kgPerWeek: number;
      /** Trend weight at the last weigh-in. */
      weightKg: number;
    }
  | { ok: false; reason: 'data' | 'implausible'; days: number; weighIns: number };

const DAY = 86_400_000;
const time = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const round10 = (x: number) => Math.round(x / 10) * 10;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Days that count: marked complete, or logged and not far below the user's typical intake. Days
 * with foods of unknown energy never count (they would make intake, and so expenditure, too low).
 */
export function countedDays(days: DayIntake[]): DayIntake[] {
  const logged = days.filter((d) => d.kcal > 0 && !d.unknown);
  if (!logged.length) return [];
  const typical = median(logged.map((d) => d.kcal));
  return logged.filter((d) => d.complete || d.kcal >= ADAPTIVE.lowShare * typical);
}

/** Least-squares line through (x, y): slope and its standard error. */
function fit(xs: number[], ys: number[]): { slope: number; intercept: number; se: number } {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - intercept - slope * xs[i]) ** 2;
  const se = n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : 0;
  return { slope, intercept, se };
}

/**
 * Expenditure = average intake − weight change × 7700 kcal/kg. The weight trend is a straight
 * line through the weigh-ins (smooths day-to-day water swings). `days` and `weighIns` should cover
 * the window (see ADAPTIVE.windowDays).
 */
export function estimate(days: DayIntake[], weighIns: WeighIn[]): Estimate {
  const counted = countedDays(days);
  const w = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const span = w.length ? (time(w[w.length - 1].date) - time(w[0].date)) / DAY : 0;
  const base = { days: counted.length, weighIns: w.length };
  if (counted.length < ADAPTIVE.minDays || w.length < ADAPTIVE.minWeighIns || span < ADAPTIVE.minSpanDays) {
    return { ok: false, reason: 'data', ...base };
  }
  const x = w.map((p) => (time(p.date) - time(w[0].date)) / DAY);
  const line = fit(x, w.map((p) => p.kg));
  const intake = counted.map((d) => d.kcal);
  const mean = intake.reduce((a, b) => a + b, 0) / intake.length;
  const sd = Math.sqrt(intake.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, intake.length - 1));
  const kcal = mean - line.slope * ADAPTIVE.kcalPerKg;
  // ± about 95 %: the intake mean (normal), the trend slope (t for few weigh-ins), and scale noise
  // over the span, which a near-perfect line through 3 weigh-ins would otherwise hide.
  const t = T95[w.length - 3] ?? 2;
  const slopeErr = Math.hypot(t * line.se, ADAPTIVE.scaleNoiseKg / span);
  const err = Math.hypot((2 * sd) / Math.sqrt(intake.length), slopeErr * ADAPTIVE.kcalPerKg);
  // Far outside what a body burns: something is missing from the log (or the scale).
  if (!(kcal >= 1000 && kcal <= 6000)) return { ok: false, reason: 'implausible', ...base };
  return {
    ok: true,
    kcal: round10(kcal),
    plusMinus: Math.max(10, round10(err)),
    ...base,
    kgPerWeek: Math.round(line.slope * 7 * 100) / 100,
    weightKg: Math.round((line.intercept + line.slope * x[x.length - 1]) * 10) / 10,
  };
}

/** Largest weekly change when the target follows the estimate (M35): one noisy week can't swing it. */
export const FOLLOW_STEP = 150;

/** The next target: toward `want`, at most FOLLOW_STEP from `current`, never below `floor`. */
export function followStep(current: number, want: number, floor: number): number {
  const next = Math.min(current + FOLLOW_STEP, Math.max(current - FOLLOW_STEP, want));
  return Math.max(floor, next);
}

/**
 * Whether this week's step is still due. Synced settings can lose `followWeek` (an older version on
 * another device drops keys it doesn't know), so this week's note also counts: never two steps a week.
 */
export function followDue(s: { followWeek?: string; followNote?: { week: string } }, week: string): boolean {
  return s.followWeek !== week && s.followNote?.week !== week;
}
