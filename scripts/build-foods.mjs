// Turns data/raw/slv.json into the compact food file the app ships:
// public/data/foods.json = { v, sources, keys, foods: [[ref, sv, en, ...valuesPer100g]] }
// Values follow the order of src/lib/nutrients.json; null = unknown.
// Usage: node scripts/build-foods.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const NUTRIENTS = JSON.parse(await readFile('src/lib/nutrients.json', 'utf8'));
const raw = JSON.parse(await readFile('data/raw/slv.json', 'utf8'));

// 3 significant digits is well within the precision of food composition data.
const round = (x) => (x == null ? null : x === 0 ? 0 : Number(x.toPrecision(3)));

const foods = raw.foods.map((f) => {
  const byCode = new Map();
  for (const n of f.nutrients) {
    // Energy is listed twice (kcal and kJ); keep kcal.
    if (n.code === 'ENERC' && n.unit !== 'kcal') continue;
    byCode.set(n.code, n.value);
  }
  return [`slv:${f.id}`, f.sv, f.en && f.en !== f.sv ? f.en : null, ...NUTRIENTS.map((n) => round(byCode.get(n.slv)))];
});

// Everyday foods get a ranking boost in search (see data/popular.txt).
const refBySv = new Map(raw.foods.map((f) => [f.sv.trim(), `slv:${f.id}`]));
const popular = [];
for (const line of (await readFile('data/popular.txt', 'utf8')).split('\n')) {
  const name = line.replace(/#.*/, '').trim();
  if (!name) continue;
  const ref = refBySv.get(name);
  if (ref) popular.push(ref);
  else console.warn(`popular.txt: no food named "${name}"`);
}

const out = {
  v: 1,
  sources: [{ id: 'slv', name: 'Livsmedelsverket, Livsmedelsdatabasen', license: 'CC BY 4.0', fetched: raw.fetched }],
  keys: NUTRIENTS.map((n) => n.key),
  popular,
  foods,
};

await mkdir('public/data', { recursive: true });
const json = JSON.stringify(out);
await writeFile('public/data/foods.json', json);
console.log(`Wrote ${foods.length} foods, ${(json.length / 1024).toFixed(0)} KB raw`);
