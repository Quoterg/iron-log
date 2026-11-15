/// <reference lib="webworker" />
// Owns the food databases so parsing and searching never block the UI thread.
// Each source (Livsmedelsverket, USDA, …) is one or more JSON files, loaded only when the source
// is enabled for search — or when a diary entry needs one of its foods.
import { FoodIndex } from '../lib/food-index';
import type { Food } from '../lib/nutrients';
import type { WorkerRequest, WorkerResponse } from '../lib/foods';
import { rowToFood } from '../lib/food-row';

interface FoodsFile {
  /** Nutrient keys in vector order; rows may be shorter (trailing unknowns left out). */
  keys: string[];
  popular?: string[];
  units?: Record<string, [name: string, grams: number][]>;
  foods: [ref: string, sv: string, en: string | null, ...values: (number | null)[]][];
}

let files: Record<string, string[]> = {};
let enabled: string[] = [];
const sourceFoods = new Map<string, Food[]>();
const loading = new Map<string, Promise<void>>();
let custom: Food[] = [];
const byRef = new Map<string, Food>();
/** The search index: the databases' part kept, the user's own rebuilt on change (lib/food-index.ts). */
const idx = new FoodIndex();

async function loadFile(url: string): Promise<Food[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const data = (await res.json()) as FoodsFile;
  const units = data.units ?? {};
  for (const r of data.popular ?? []) idx.popular.add(r);
  const n = data.keys.length;
  return data.foods.map((row) => {
    const f = rowToFood(row, n);
    const ref = f.ref;
    const u = units[ref];
    if (u) f.units = u.map(([name, g]) => ({ name, g }));
    return f;
  });
}

function loadSource(source: string): Promise<void> {
  let p = loading.get(source);
  if (!p) {
    p = (async () => {
      // One file at a time: keeps peak memory low on phones with little RAM.
      const list: Food[] = [];
      for (const url of files[source] ?? []) list.push(...(await loadFile(url)));
      sourceFoods.set(source, list);
      for (const f of list) byRef.set(f.ref, f);
      rebuild();
    })();
    // A failed download can be retried later (e.g. back online).
    p.catch(() => loading.delete(source));
    loading.set(source, p);
  }
  return p;
}

/** Search covers the enabled sources (in order) plus the user's own foods. */
function rebuild() {
  idx.setBuiltIn(enabled.flatMap((s) => sourceFoods.get(s) ?? []));
}

/**
 * Load the enabled sources. One failing (e.g. offline before USDA was cached) must not break the
 * others: search uses whatever loaded, and reports which sources are unavailable. A failed source
 * is retried on the next request.
 */
async function ready(): Promise<string[]> {
  const results = await Promise.allSettled(enabled.map(loadSource));
  return enabled.filter((_, i) => results[i].status === 'rejected');
}

/** Load only the sources these refs need (e.g. an old USDA entry while USDA is off). */
async function loadFor(refs: string[]): Promise<string[]> {
  // "custom:", "off:", "recipe:" refs aren't database files: the `in files` filter skips them.
  const needed = [...new Set(refs.map((r) => r.slice(0, r.indexOf(':'))).filter((s) => s in files))];
  const results = await Promise.allSettled(needed.map(loadSource));
  return needed.filter((_, i) => results[i].status === 'rejected');
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.type === 'init') {
    files = req.files;
    enabled = req.sources;
    return;
  }
  if (req.type === 'sources') {
    enabled = req.sources;
    rebuild();
    void ready();
    return;
  }
  if (req.type === 'warm') {
    // At idle after first paint: load, then build the search index so the first keystroke is fast.
    await ready();
    idx.indexFor(req.lang);
    return;
  }
  if (req.type === 'boost') {
    idx.setBoosts(req.boosts);
    return;
  }
  if (req.type === 'custom') {
    for (const f of custom) byRef.delete(f.ref);
    custom = req.foods;
    for (const f of custom) byRef.set(f.ref, f);
    idx.setCustom(custom);
    return;
  }
  let res: WorkerResponse;
  try {
    if (req.type === 'search') {
      const failed = await ready();
      const ex = req.excludePrefix;
      const hits = idx.search(req.query, req.lang, ex ? 200 : 40);
      res = { id: req.id, foods: (ex ? hits.filter((f) => !f.ref.startsWith(ex)) : hits).slice(0, 40), failed };
    } else {
      const failed = await loadFor(req.refs);
      res = { id: req.id, foods: req.refs.map((r) => byRef.get(r)).filter((f): f is Food => !!f), failed };
    }
  } catch (err) {
    res = { id: req.id, foods: [], error: String(err) };
  }
  (self as unknown as Worker).postMessage(res);
};
