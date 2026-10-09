// Body measurements (weight, body fat, waist) and their trend.

export interface BodyEntry {
  /** Local date, YYYY-MM-DD (one entry per day). */
  date: string;
  weightKg?: number;
  bodyFatPct?: number;
  waistCm?: number;
  updatedAt: number;
}

export type BodyMetric = 'weightKg' | 'bodyFatPct' | 'waistCm';

export interface Point {
  date: string;
  value: number;
}

const DAY = 86_400_000;
const time = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

/** One metric's measurements, oldest first. */
export function series(entries: BodyEntry[], metric: BodyMetric): Point[] {
  return entries
    .filter((e) => e[metric] != null)
    .map((e) => ({ date: e.date, value: e[metric]! }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Trend: for each measurement, the mean of all measurements in the `days`-day window ending on
 * that date (a time window, so irregular weigh-ins don't skew it). Points must be sorted.
 */
export function movingAverage(points: Point[], days = 7): Point[] {
  const out: Point[] = [];
  let start = 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].value;
    const t = time(points[i].date);
    while (time(points[start].date) <= t - days * DAY) sum -= points[start++].value;
    out.push({ date: points[i].date, value: Math.round((sum / (i - start + 1)) * 100) / 100 });
  }
  return out;
}

/** Points within the last `days` days up to `today` (all points when days is null). */
export function lastDays(points: Point[], today: string, days: number | null): Point[] {
  if (days == null) return points;
  const from = time(today) - (days - 1) * DAY;
  return points.filter((p) => time(p.date) >= from);
}

/** "Nice" axis bounds and ~4 ticks covering the values. */
export function niceScale(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}
