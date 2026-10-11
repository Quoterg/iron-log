// The richest database foods per nutrient, precomputed at build time (scripts/build-top.mjs) into
// one small file — the nutrient page never has to download and parse the food databases.
import TOP from './top.json';

/** [ref, Swedish name, English name, value per 100 g] */
export type TopRow = [ref: string, sv: string, en: string | null, value: number];
/** [ref, Swedish name, English name, value per 100 g, kcal per 100 g, household portion in g] */
export type EverydayRow = [ref: string, sv: string, en: string | null, value: number, kcal: number, portionG: number];
interface TopFile {
  sources: Record<string, Record<string, TopRow[]>>;
  /** Everyday foods (with household measures) richest per kcal, per source and nutrient. */
  everyday?: Record<string, Record<string, EverydayRow[]>>;
}

let file: Promise<TopFile> | undefined;

function load(): Promise<TopFile> {
  file ??= fetch(new URL(`data/${TOP.file}`, document.baseURI).href).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<TopFile>;
  });
  return file.catch((err: unknown) => {
    file = undefined; // allow a retry (e.g. back online)
    throw err;
  });
}

/** Everyday foods rich in nutrient `key` per kcal, with a household portion (suggestions, M27). */
export async function everydayFoods(key: string, sources: string[]): Promise<EverydayRow[]> {
  const data = await load();
  return sources.flatMap((s) => data.everyday?.[s]?.[key] ?? []);
}

/** The `n` richest foods in nutrient `key` across `sources`, largest first. */
export async function richestFoods(key: string, sources: string[], n = 10): Promise<TopRow[]> {
  const data = await load();
  return sources
    .flatMap((s) => data.sources[s]?.[key] ?? [])
    .sort((a, b) => b[3] - a[3])
    .slice(0, n);
}
