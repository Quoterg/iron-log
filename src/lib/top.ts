// The richest database foods per nutrient, precomputed at build time (scripts/build-top.mjs) into
// small files — the nutrient page never has to download and parse the food databases.
import TOP from './top.json';

/** [ref, Swedish name, English name, value per 100 g] */
export type TopRow = [ref: string, sv: string, en: string | null, value: number];
/** [ref, Swedish name, English name, value per 100 g, kcal per 100 g, household portion in g] */
export type EverydayRow = [ref: string, sv: string, en: string | null, value: number, kcal: number, portionG: number];
interface RowsFile<R> {
  sources: Record<string, Record<string, R[]>>;
}

const files = new Map<string, Promise<unknown>>();

/** One data file, fetched once (and again after a failure, e.g. back online). */
function load<R>(name: string): Promise<RowsFile<R>> {
  let p = files.get(name);
  if (!p) {
    p = fetch(new URL(`data/${name}`, document.baseURI).href).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    files.set(name, p);
    p.catch(() => files.delete(name));
  }
  return p as Promise<RowsFile<R>>;
}

/** Everyday foods rich in nutrient `key` per kcal, with a household portion (suggestions, M27). */
export async function everydayFoods(key: string, sources: string[]): Promise<EverydayRow[]> {
  const data = await load<EverydayRow>(TOP.everyday);
  return sources.flatMap((s) => data.sources[s]?.[key] ?? []);
}

/** The `n` richest foods in nutrient `key` across `sources`, largest first. */
export async function richestFoods(key: string, sources: string[], n = 10): Promise<TopRow[]> {
  const data = await load<TopRow>(TOP.file);
  return sources
    .flatMap((s) => data.sources[s]?.[key] ?? [])
    .sort((a, b) => b[3] - a[3])
    .slice(0, n);
}

/** A ranked row for the nutrient page: [ref, Swedish name, English name, amount in the chosen measure]. */
export type RankRow = TopRow;

/**
 * Everyday foods by amount per 100 kcal (M49): what gives the most of the nutrient for its energy,
 * without spices and powders. Foods without energy (water, salt) are left out.
 */
export function perKcal(rows: EverydayRow[], n = 10): RankRow[] {
  return dedupe(rows.filter((r) => r[4] > 0).map((r) => [r[0], r[1], r[2], (r[3] / r[4]) * 100] as RankRow), n);
}

/**
 * Foods by amount per 10 kr (M49), from the everyday and richest lists, with the user's own price
 * before the typical one (kr/kg). Foods without a price are left out.
 */
export function perKrona(rows: (TopRow | EverydayRow)[], krPerKg: (ref: string) => number | undefined, n = 10): RankRow[] {
  const out: RankRow[] = [];
  for (const r of rows) {
    const kr = krPerKg(r[0]);
    if (kr && kr > 0) out.push([r[0], r[1], r[2], (r[3] * 100) / kr]); // per 100 g ÷ (kr per 100 g) × 10 kr
  }
  return dedupe(out, n);
}

/** Largest first, each food once. */
function dedupe(rows: RankRow[], n: number): RankRow[] {
  const seen = new Set<string>();
  return rows
    .sort((a, b) => b[3] - a[3])
    .filter((r) => !seen.has(r[0]) && seen.add(r[0]))
    .slice(0, n);
}
