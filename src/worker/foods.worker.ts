/// <reference lib="webworker" />
// Owns the food database so parsing and searching never block the UI thread.
import { buildEntry, search, type SearchEntry } from '../lib/search';
import type { Food } from '../lib/nutrients';
import type { WorkerRequest, WorkerResponse } from '../lib/foods';

interface FoodsFile {
  foods: [ref: string, sv: string, en: string | null, ...values: (number | null)[]][];
}

let foods: Food[] = [];
const byRef = new Map<string, Food>();
const index: Partial<Record<string, SearchEntry[]>> = {};

let ready: Promise<void> | undefined;

async function load(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`foods.json: HTTP ${res.status}`);
  const data = (await res.json()) as FoodsFile;
  foods = data.foods.map(([ref, sv, en, ...per100g]) => ({ ref, sv, en, per100g }));
  for (const f of foods) byRef.set(f.ref, f);
}

function indexFor(lang: string): SearchEntry[] {
  return (index[lang] ??= foods.map((f, i) =>
    buildEntry(i, [f.sv, f.en], lang === 'en' ? (f.en ?? f.sv) : f.sv),
  ));
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.type === 'init') {
    ready = load(req.dataUrl);
    return;
  }
  let res: WorkerResponse;
  try {
    await ready;
    if (req.type === 'search') {
      res = { id: req.id, foods: search(indexFor(req.lang), req.query, 40).map((i) => foods[i]) };
    } else {
      res = { id: req.id, foods: req.refs.map((r) => byRef.get(r)).filter((f): f is Food => !!f) };
    }
  } catch (err) {
    res = { id: req.id, foods: [], error: String(err) };
  }
  (self as unknown as Worker).postMessage(res);
};
