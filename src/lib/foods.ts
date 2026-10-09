// Main-thread client for the food worker.
import type { Food } from './nutrients';

export type WorkerRequest =
  | { id: number; type: 'init'; dataUrl: string }
  | { id: number; type: 'custom'; foods: Food[] }
  | { id: number; type: 'boost'; boosts: Record<string, number> }
  | { id: number; type: 'search'; query: string; lang: string }
  | { id: number; type: 'get'; refs: string[] };

export interface WorkerResponse {
  id: number;
  foods: Food[];
  error?: string;
}

type Pending = { resolve: (f: Food[]) => void; reject: (e: Error) => void };

let worker: Worker | undefined;
let customVisible: Food[] = [];
let nextId = 1;
const pending = new Map<number, Pending>();
const cache = new Map<string, Food>();

type Query = Extract<WorkerRequest, { type: 'search' | 'get' }>;
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;

function call(req: WithoutId<Query>): Promise<Food[]> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ ...req, id } as WorkerRequest);
  });
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('../worker/foods.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
    const p = pending.get(ev.data.id);
    if (!p) return;
    pending.delete(ev.data.id);
    if (ev.data.error) p.reject(new Error(ev.data.error));
    else {
      for (const f of ev.data.foods) cache.set(f.ref, f);
      p.resolve(ev.data.foods);
    }
  };
  // Resolve against the page so the app works from any base path (e.g. GitHub Pages /repo/).
  const init: WorkerRequest = { id: 0, type: 'init', dataUrl: new URL('data/foods.json', document.baseURI).href };
  w.postMessage(init);
  if (customVisible.length) postCustom(w);
  if (Object.keys(userBoosts).length) postBoosts(w);
  return (worker = w);
}

let userBoosts: Record<string, number> = {};

function postBoosts(w: Worker) {
  const msg: WorkerRequest = { id: 0, type: 'boost', boosts: userBoosts };
  w.postMessage(msg);
}

/** Search ranking boosts from the user's history, by food ref. */
export function setUserBoosts(boosts: Record<string, number>): void {
  userBoosts = boosts;
  if (worker) postBoosts(worker);
}

function postCustom(w: Worker) {
  const msg: WorkerRequest = { id: 0, type: 'custom', foods: customVisible };
  w.postMessage(msg);
}

/** Start loading the food database early (call after first paint). */
export function warmUp(): void {
  void call({ type: 'get', refs: [] });
}

/**
 * Hand the user's custom foods to the search worker. `visible` are searchable;
 * `all` (including deleted ones) stay resolvable for old diary entries.
 */
export function setCustomFoods(visible: Food[], all: Food[]): void {
  for (const f of all) cache.set(f.ref, f);
  customVisible = visible;
  // Don't start the worker (and the food download) just for this; it gets them on creation.
  if (worker) postCustom(worker);
}

export function searchFoods(query: string, lang: string): Promise<Food[]> {
  return call({ type: 'search', query, lang });
}

export async function getFoods(refs: string[]): Promise<Map<string, Food>> {
  const missing = [...new Set(refs)].filter((r) => !cache.has(r));
  if (missing.length) await call({ type: 'get', refs: missing });
  return new Map(refs.filter((r) => cache.has(r)).map((r) => [r, cache.get(r)!]));
}
