// Adaptive energy expenditure (opt-in): what the user really burns, from how their weight changed
// against what they logged over the last 4 weeks — energy balance, ≈ 7700 kcal per kg of body
// weight. Never changes a target by itself; the user can choose to apply a suggested one.
// Loaded with the Settings screen only.
import { basalKcal, type Profile } from './targets';

export const ADAPTIVE = {
  /** Days looked at (ending yesterday: today isn't finished). */
  windowDays: 28,
  minDays: 10,
  minWeighIns: 3,
  /** The weigh-ins must span at least this many days. */
  minSpanDays: 14,
  kcalPerKg: 7700,
  /** An unmarked day below this share of the typical (median) intake counts as incomplete. */
  lowShare: 0.6,
  /** Fastest pace offered: % of body weight per week. */
  maxPctPerWeek: 0.75,
};

export type Goal = 'lose' | 'maintain' | 'gain';
export const GOALS: Goal[] = ['lose', 'maintain', 'gain'];
export const PACES = [0.25, 0.5, 0.75]; // kg per week

/** One day's logged energy, and whether the user marked it complete. */
export interface DayIntake {
  date: string;
  kcal: number;
  complete: boolean;
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
      /** ± about 95 % (two standard errors), rounded to 10. */
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

/** Days that count: marked complete, or logged and not far below the user's typical intake. */
export function countedDays(days: DayIntake[]): DayIntake[] {
  const logged = days.filter((d) => d.kcal > 0);
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
  const se = Math.sqrt((sd / Math.sqrt(intake.length)) ** 2 + (line.se * ADAPTIVE.kcalPerKg) ** 2);
  // Far outside what a body burns: something is missing from the log (or the scale).
  if (!(kcal >= 1000 && kcal <= 6000)) return { ok: false, reason: 'implausible', ...base };
  return {
    ok: true,
    kcal: round10(kcal),
    plusMinus: Math.max(10, round10(2 * se)),
    ...base,
    kgPerWeek: Math.round(line.slope * 7 * 100) / 100,
    weightKg: Math.round((line.intercept + line.slope * x[x.length - 1]) * 10) / 10,
  };
}

/** Paces offered for a body weight: at most ADAPTIVE.maxPctPerWeek % of it per week. */
export function allowedPaces(weightKg: number): number[] {
  return PACES.filter((p) => p <= (weightKg * ADAPTIVE.maxPctPerWeek) / 100 + 1e-9);
}

/** Never suggested below this: 1200 kcal (women) / 1500 kcal (men), and not below the basal rate. */
export function minIntake(p: Profile): number {
  return Math.max(p.sex === 'female' ? 1200 : 1500, Math.round(basalKcal(p) ?? 0));
}

/** Energy target for a goal: expenditure ± the pace's energy (7700 kcal per kg), never below `floor`. */
export function goalTarget(expenditure: number, goal: Goal, pacePerWeek: number, floor: number): { kcal: number; floored: boolean } {
  const delta = goal === 'maintain' ? 0 : ((goal === 'lose' ? -1 : 1) * pacePerWeek * ADAPTIVE.kcalPerKg) / 7;
  const kcal = round10(expenditure + delta);
  return kcal < floor ? { kcal: floor, floored: true } : { kcal, floored: false };
}
