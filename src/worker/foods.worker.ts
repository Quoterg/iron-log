/// <reference lib="webworker" />
// Owns the food databases so parsing and searching never block the UI thread.
// Each source (Livsmedelsverket, USDA, …) is one or more JSON files, loaded only when the source
// is enabled for search — or when a diary entry needs one of its foods.
import { buildEntry, search, type SearchEntry } from '../lib/search';
import type { Food } from '../lib/nutrients';
import type { WorkerRequest, WorkerResponse } from '../lib/foods';

interface FoodsFile {
  /** Nutrient keys in vector order; rows may be shorter (trailing unknowns left out). */
  keys: string[];
  popular?: string[];
  units?: Record<string, [name: string, grams: number][]>;
  foods: [ref: string, sv: string, en: string | null, ...values: (number | null)[]][];
}

/** The user's own foods rank slightly above database foods with the same match. */
const CUSTOM_BOOST = 1;
/** Everyday foods (data/popular.txt): "ris" → cooked rice before raw specialty rice. */
const POPULAR_BOOST = 2;

let files: Record<string, string[]> = {};
let enabled: string[] = [];
const sourceFoods = new Map<string, Food[]>();
const loading = new Map<string, Promise<void>>();
let custom: Food[] = [];
let builtInCount = 0;
let all: Food[] = [];
const byRef = new Map<string, Food>();
let index: Partial<Record<string, SearchEntry[]>> = {};
const popular = new Set<string>();
/** Per-food boost from the user's own history (count, favourites), set by the main thread. */
let userBoost: Record<string, number> = {};

async function loadFile(url: string): Promise<Food[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const data = (await res.json()) as FoodsFile;
  const units = data.units ?? {};
  for (const r of data.popular ?? []) popular.add(r);
  const n = data.keys.length;
  return data.foods.map(([ref, sv, en, ...per100g]) => {
    while (per100g.length < n) per100g.push(null);
    const f: Food = { ref, sv, en, per100g };
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
  const builtIn = enabled.flatMap((s) => sourceFoods.get(s) ?? []);
  builtInCount = builtIn.length;
  all = builtIn.concat(custom);
  index = {};
}

/**
 * Load the enabled sources. One failing (e.g. offline before USDA was cached) must not break the
 * others: search uses whatever loaded, and reports which sources are unavailable. A failed source
 * is retried on the next request.
 */
/** Top `n` built-in foods by one nutrient per 100 g: one pass, a small sorted list (no full sort). */
function richest(index: number, n: number): Food[] {
  const top: Food[] = [];
  const v = (f: Food) => f.per100g[index] ?? 0;
  for (let i = 0; i < builtInCount; i++) {
    const f = all[i];
    const x = v(f);
    if (x <= 0 || (top.length === n && x <= v(top[n - 1]))) continue;
    let j = top.length < n ? top.length : n - 1;
    while (j > 0 && v(top[j - 1]) < x) j--;
    top.splice(j, 0, f);
    if (top.length > n) top.pop();
  }
  return top;
}

async function ready(): Promise<string[]> {
  const results = await Promise.allSettled(enabled.map(loadSource));
  return enabled.filter((_, i) => results[i].status === 'rejected');
}

function indexFor(lang: string): SearchEntry[] {
  return (index[lang] ??= all.map((f, i) => {
    const e = buildEntry(i, [f.sv, f.en], lang === 'en' ? (f.en ?? f.sv) : f.sv);
    e.boost = boostFor(f.ref, i >= builtInCount);
    return e;
  }));
}

function boostFor(ref: string, isCustom: boolean): number {
  return (isCustom ? CUSTOM_BOOST : 0) + (popular.has(ref) ? POPULAR_BOOST : 0) + (userBoost[ref] ?? 0);
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
    indexFor(req.lang);
    return;
  }
  if (req.type === 'boost') {
    userBoost = req.boosts;
    // Update in place: cheaper than rebuilding the normalised index after every logged food.
    for (const entries of Object.values(index)) {
      for (const e of entries ?? []) e.boost = boostFor(all[e.i].ref, e.i >= builtInCount);
    }
    return;
  }
  if (req.type === 'custom') {
    for (const f of custom) byRef.delete(f.ref);
    custom = req.foods;
    for (const f of custom) byRef.set(f.ref, f);
    rebuild();
    return;
  }
  let res: WorkerResponse;
  try {
    if (req.type === 'search') {
      const failed = await ready();
      const ex = req.excludePrefix;
      const hits = search(indexFor(req.lang), req.query, ex ? 200 : 40).map((i) => all[i]);
      res = { id: req.id, foods: (ex ? hits.filter((f) => !f.ref.startsWith(ex)) : hits).slice(0, 40), failed };
    } else if (req.type === 'top') {
      const failed = await ready();
      res = { id: req.id, foods: richest(req.index, req.n), failed };
    } else {
      const failed = await loadFor(req.refs);
      res = { id: req.id, foods: req.refs.map((r) => byRef.get(r)).filter((f): f is Food => !!f), failed };
    }
  } catch (err) {
    res = { id: req.id, foods: [], error: String(err) };
  }
  (self as unknown as Worker).postMessage(res);
};
