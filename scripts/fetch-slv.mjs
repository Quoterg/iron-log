// Downloads the Swedish Food Agency (Livsmedelsverket) food composition database
// into data/raw/slv.json. Licensed CC BY 4.0 — attribution is shown in the app.
// Usage: node scripts/fetch-slv.mjs
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';
const CONCURRENCY = 4;

async function getJson(url, tries = 4) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

const list = async (lang) =>
  (await getJson(`${API}/livsmedel?offset=0&limit=5000&sprak=${lang}`)).livsmedel;

const sv = await list(1);
const en = await list(2);
const enByNum = new Map(en.map((f) => [f.nummer, f.namn]));

const foods = sv.map((f) => ({
  id: f.nummer,
  sv: f.namn,
  en: enByNum.get(f.nummer) ?? null,
  nutrients: null,
}));

let next = 0;
let done = 0;
async function worker() {
  while (next < foods.length) {
    const food = foods[next++];
    const rows = await getJson(`${API}/livsmedel/${food.id}/naringsvarden?sprak=2`);
    food.nutrients = rows.map((r) => ({
      code: r.euroFIRkod,
      name: r.namn,
      unit: r.enhet,
      value: r.varde,
    }));
    if (++done % 200 === 0) console.log(`${done}/${foods.length}`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

await mkdir('data/raw', { recursive: true });
await writeFile('data/raw/slv.json', JSON.stringify({ fetched: new Date().toISOString(), foods }));
console.log(`Wrote ${foods.length} foods to data/raw/slv.json`);
