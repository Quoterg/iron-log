// Iron Notes bridge (M53): body measurements and the diet phase from an Iron Notes backup file (the
// sister training app, on another origin: the two can't read each other's storage). Mirrors Iron
// Notes' own Iron Log import (its M30). Pure: parsing, validation and the merge plan; loaded lazily.
import type { BodyEntry } from './body';
import type { Goal } from './targets';

/** An Iron Notes backup is recognised by this, before anything else is parsed. */
export const isIronNotes = (x: unknown): boolean => !!x && typeof x === 'object' && (x as { app?: unknown }).app === 'iron-notes';

interface Metric {
  id: string;
  name: string;
  kind: string;
}
interface Measure {
  metricId: string;
  date: string;
  /** Stored in kg, %, cm or a plain number (Iron Notes converts for display only). */
  value: number;
  at: number;
}

export interface IronNotesData {
  /** Per date: what Iron Notes has for body weight, body fat and waist. */
  days: Map<string, Pick<BodyEntry, 'weightKg' | 'bodyFatPct' | 'waistCm'>>;
  /** The training app's diet phase as Iron Log's goal, if set. */
  goal?: Goal;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const FIELDS = [
  // [Iron Log field, Iron Notes kind, name pattern, range (as Iron Log's backup validation)]
  ['weightKg', 'weight', /weight|vikt/i, 20, 400],
  ['bodyFatPct', 'percent', /fat|fett/i, 2, 75],
  ['waistCm', 'length', /waist|midja/i, 30, 250],
] as const;
const GOALS: Record<string, Goal> = { cut: 'lose', maintain: 'maintain', build: 'gain' };

export class IronNotesError extends Error {}

/**
 * Body weight, body fat and waist by date (the latest entry of a date wins), and the diet phase. The
 * measures are the user's own, named freely: matched by kind and name ("Body weight", "Body fat",
 * "Waist" by default; Swedish names too), a lone weight measure is the body weight.
 */
export function parseIronNotes(x: unknown, today: string): IronNotesData {
  const b = x as { app?: unknown; version?: unknown; metrics?: unknown; body?: unknown; settings?: { diet?: unknown } };
  if (!isIronNotes(b) || b.version !== 1 || !Array.isArray(b.metrics ?? []) || !Array.isArray(b.body ?? [])) throw new IronNotesError('format');
  const metrics = ((b.metrics ?? []) as Metric[]).filter((m) => m && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.kind === 'string');
  const ids = new Map<string, (typeof FIELDS)[number]>();
  for (const f of FIELDS) {
    const ofKind = metrics.filter((m) => m.kind === f[1]);
    const m = ofKind.find((x) => f[2].test(x.name)) ?? (f[1] === 'weight' && ofKind.length === 1 ? ofKind[0] : undefined);
    if (m) ids.set(m.id, f);
  }
  const days: IronNotesData['days'] = new Map();
  const at = new Map<string, number>();
  for (const e of (b.body ?? []) as Measure[]) {
    const f = e && ids.get(e.metricId);
    if (!f || typeof e.date !== 'string' || !DATE.test(e.date) || e.date > today) continue;
    if (typeof e.value !== 'number' || !Number.isFinite(e.value) || e.value < f[3] || e.value > f[4]) continue;
    const key = `${e.date}|${f[0]}`;
    const when = typeof e.at === 'number' ? e.at : 0;
    if ((at.get(key) ?? -1) > when) continue;
    at.set(key, when);
    days.set(e.date, { ...days.get(e.date), [f[0]]: Math.round(e.value * 10) / 10 });
  }
  const goal = GOALS[String(b.settings?.diet)];
  return goal ? { days, goal } : { days };
}

export interface BodyPlan {
  /** Entries to write: new dates, or existing ones with a value they didn't have. */
  write: BodyEntry[];
  /** How many of each measure are new. */
  counts: { weightKg: number; bodyFatPct: number; waistCm: number };
}

/** What the import adds: never overwrites a value Iron Log already has for that date. */
export function planBody(data: IronNotesData, existing: BodyEntry[], now: number): BodyPlan {
  const byDate = new Map(existing.map((e) => [e.date, e]));
  const counts = { weightKg: 0, bodyFatPct: 0, waistCm: 0 };
  const write: BodyEntry[] = [];
  for (const [date, v] of [...data.days].sort(([a], [b]) => a.localeCompare(b))) {
    const cur = byDate.get(date);
    const next: BodyEntry = { ...cur, date, updatedAt: now };
    let added = false;
    for (const k of ['weightKg', 'bodyFatPct', 'waistCm'] as const) {
      if (v[k] != null && cur?.[k] == null) {
        next[k] = v[k];
        counts[k]++;
        added = true;
      }
    }
    if (added) write.push(next);
  }
  return { write, counts };
}
