/// <reference lib="webworker" />
// Owns the food database so parsing and searching never block the UI thread.
import { buildEntry, search, type SearchEntry } from '../lib/search';
import type { Food } from '../lib/nutrients';
import type { WorkerRequest, WorkerResponse } from '../lib/foods';

interface FoodsFile {
  foods: [ref: string, sv: string, en: string | null, ...values: (number | null)[]][];
}

/** The user's own foods rank slightly above database foods with the same match. */
const CUSTOM_BOOST = 1;

let builtIn: Food[] = [];
let custom: Food[] = [];
let all: Food[] = [];
const byRef = new Map<string, Food>();
let index: Partial<Record<string, SearchEntry[]>> = {};

let ready: Promise<void> | undefined;

async function load(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`foods.json: HTTP ${res.status}`);
  const data = (await res.json()) as FoodsFile;
  builtIn = data.foods.map(([ref, sv, en, ...per100g]) => ({ ref, sv, en, per100g }));
  for (const f of builtIn) byRef.set(f.ref, f);
  rebuild();
}

function rebuild() {
  all = builtIn.concat(custom);
  index = {};
}

function indexFor(lang: string): SearchEntry[] {
  return (index[lang] ??= all.map((f, i) => {
    const e = buildEntry(i, [f.sv, f.en], lang === 'en' ? (f.en ?? f.sv) : f.sv);
    if (i >= builtIn.length) e.boost = CUSTOM_BOOST;
    return e;
  }));
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.type === 'init') {
    ready = load(req.dataUrl);
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
    await ready;
    if (req.type === 'search') {
      res = { id: req.id, foods: search(indexFor(req.lang), req.query, 40).map((i) => all[i]) };
    } else {
      res = { id: req.id, foods: req.refs.map((r) => byRef.get(r)).filter((f): f is Food => !!f) };
    }
  } catch (err) {
    res = { id: req.id, foods: [], error: String(err) };
  }
  (self as unknown as Worker).postMessage(res);
};
