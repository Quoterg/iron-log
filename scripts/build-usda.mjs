// Turns USDA FoodData Central CSVs (data/raw/usda, see fetch-usda.mjs) into the app's compact
// format, split into files that each stay well within the food-data budget:
//   public/data/usda-<n>.<hash>.json = { v, sources, keys, units, foods: [[ref, sv, en, ...per100g]] }
// and writes src/lib/sources.json (which files belong to which source) for the app.
// USDA data is public domain. Usage: node scripts/build-usda.mjs
import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import { writeSourceFiles } from './data-files.mjs';

const NUTRIENTS = JSON.parse(await readFile('src/lib/nutrients.json', 'utf8'));
// Well under the 250 KB per-file budget, leaving room for more nutrients later (M16).
const MAX_GZIP = 190 * 1024;

/** Our nutrient key → USDA nutrient ids in priority order (all per 100 g, same units as ours). */
const IDS = {
  kcal: [1008, 2048, 2047],
  protein: [1003],
  fat: [1004],
  fibre: [1079],
  sugar: [2000, 1063],
  addedSugar: [1235],
  satFat: [1258],
  monoFat: [1292],
  polyFat: [1293],
  omega6LA: [1316, 1269],
  omega3ALA: [1404, 1270],
  epa: [1278],
  dha: [1272],
  cholesterol: [1253],
  alcohol: [1018],
  water: [1051],
  vitA: [1106], // RAE (SLV uses RE; equal for preformed retinol, close for most foods)
  betaCarotene: [1107],
  vitD: [1114],
  vitE: [1109],
  thiamin: [1165],
  riboflavin: [1166],
  niacin: [1167], // preformed niacin; SLV reports niacin equivalents (incl. tryptophan)
  vitB6: [1175],
  folate: [1177, 1190],
  vitB12: [1178],
  vitC: [1162],
  calcium: [1087],
  phosphorus: [1091],
  potassium: [1092],
  magnesium: [1090],
  iron: [1089],
  zinc: [1095],
  selenium: [1103],
  iodine: [1100],
  sodium: [1093],
  vitK: [1185], // phylloquinone (K1)
  pantothenic: [1170],
  biotin: [1176],
  copper: [1098],
  manganese: [1101],
  dpa: [1280],
  // Essential amino acids (g/100 g); methCys and pheTyr are sums, see below.
  histidine: [1221],
  isoleucine: [1212],
  leucine: [1213],
  lysine: [1214],
  threonine: [1211],
  tryptophan: [1210],
  valine: [1219],
};

/** WHO counts these pairs together (the second can stand in for part of the first). */
const SUMS = { methCys: [1215, 1216], pheTyr: [1217, 1218] };

/** Trailing unknowns are left out of the file (the app pads them back): smaller downloads. */
function trimNulls(row) {
  let n = row.length;
  while (n > 3 && row[n - 1] == null) n--;
  return row.slice(0, n);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') out.push(cur), (cur = '');
    else cur += c;
  }
  out.push(cur);
  return out;
}

const REQUIRED = {
  'food.csv': ['fdc_id', 'data_type', 'description'],
  'food_nutrient.csv': ['fdc_id', 'nutrient_id', 'amount'],
  'food_portion.csv': ['fdc_id', 'amount', 'gram_weight', 'modifier', 'portion_description'],
};

async function* rows(path) {
  let header;
  for await (const line of createInterface({ input: createReadStream(path), crlfDelay: Infinity })) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    if (!header) {
      header = cells;
      // Fail loudly if a new USDA release changes the format.
      const missing = (REQUIRED[path.split('/').pop()] ?? []).filter((c) => !header.includes(c));
      if (missing.length) throw new Error(`${path}: missing columns ${missing.join(', ')}`);
    } else yield Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  }
}

const round = (x) => (x == null ? null : x === 0 ? 0 : Number(x.toPrecision(3)));
const foods = new Map(); // fdc_id → { id, name, set, values: Map<nutrientId, amount>, portions: [] }

for (const set of ['foundation', 'sr_legacy']) {
  const dir = `data/raw/usda/${set}`;
  const keepType = set === 'foundation' ? 'foundation_food' : 'sr_legacy_food';
  for await (const r of rows(`${dir}/food.csv`)) {
    if (r.data_type === keepType) foods.set(r.fdc_id, { id: r.fdc_id, name: r.description.trim(), set, values: new Map(), portions: [] });
  }
  for await (const r of rows(`${dir}/food_nutrient.csv`)) {
    const f = foods.get(r.fdc_id);
    if (f && r.amount !== '') f.values.set(Number(r.nutrient_id), Number(r.amount));
  }
  for await (const r of rows(`${dir}/food_portion.csv`)) {
    const f = foods.get(r.fdc_id);
    const g = Number(r.gram_weight);
    const amount = Number(r.amount) || 1;
    const label = (r.modifier || r.portion_description || '').trim().replace(/\s+/g, ' ');
    if (f && g > 0 && label && label.length <= 30 && !/^\d/.test(label)) f.portions.push([label, Math.round((g / amount) * 10) / 10]);
  }
}

const out = [];
const units = {};
for (const f of foods.values()) {
  const v = Object.fromEntries(NUTRIENTS.map((n) => [n.key, null]));
  for (const [key, ids] of Object.entries(IDS)) {
    for (const id of ids) {
      if (f.values.has(id)) {
        v[key] = f.values.get(id);
        break;
      }
    }
  }
  for (const [key, [a, b]] of Object.entries(SUMS)) {
    if (f.values.has(a) && f.values.has(b)) v[key] = f.values.get(a) + f.values.get(b);
  }
  // Carbohydrates: SLV reports *available* carbohydrates (excl. fibre); USDA "by difference" includes fibre.
  const bySum = f.values.get(1050);
  const byDiff = f.values.get(1005);
  v.carbs = bySum ?? (byDiff == null ? null : Math.max(0, byDiff - (v.fibre ?? 0)));
  if (v.sodium != null) v.salt = (v.sodium * 2.5) / 1000;
  if (v.kcal == null) continue; // unusable without energy
  const ref = `usda:${f.id}`;
  out.push(trimNulls([ref, f.name, null, ...NUTRIENTS.map((n) => round(v[n.key]))]));
  const seen = new Set();
  const p = f.portions.filter(([label]) => !seen.has(label) && seen.add(label)).slice(0, 3);
  if (p.length) units[ref] = p;
}
// The same food can appear in both sets (or twice in Foundation, from different analyses).
// Keep one per name: the most complete, preferring Foundation (newer analyses) on ties.
const byName = new Map();
const known = (row) => row.slice(3).filter((x) => x != null).length;
for (const row of out) {
  const prev = byName.get(row[1]);
  const isFoundation = foods.get(row[0].slice(5)).set === 'foundation';
  if (!prev || known(row) > known(prev.row) || (known(row) === known(prev.row) && isFoundation && !prev.isFoundation)) {
    byName.set(row[1], { row, isFoundation });
  }
}
const before = out.length;
out.length = 0;
for (const { row } of byName.values()) out.push(row);
console.log(`De-duplicated by name: kept ${out.length}, dropped ${before - out.length} duplicates`);
out.sort((a, b) => a[1].localeCompare(b[1], 'en'));

// Split into files under the budget (greedy by size).
const files = [];
let chunk = [];
const fileFor = (foodsChunk) => {
  const u = Object.fromEntries(foodsChunk.filter((f) => units[f[0]]).map((f) => [f[0], units[f[0]]]));
  return JSON.stringify({
    v: 1,
    sources: [{ id: 'usda', name: 'USDA FoodData Central (SR Legacy 2018-04, Foundation 2026-04-30)', license: 'Public domain (CC0)' }],
    keys: NUTRIENTS.map((n) => n.key),
    units: u,
    foods: foodsChunk,
  });
};
const step = 500;
for (let i = 0; i < out.length; i += step) {
  const next = [...chunk, ...out.slice(i, i + step)];
  if (chunk.length && gzipSync(fileFor(next)).length > MAX_GZIP) {
    files.push(chunk);
    chunk = out.slice(i, i + step);
  } else chunk = next;
}
if (chunk.length) files.push(chunk);

const jsons = files.map(fileFor);
const names = await writeSourceFiles('usda', 'usda', jsons);
for (const [i, name] of names.entries()) {
  console.log(`${name}: ${files[i].length} foods, ${(gzipSync(jsons[i]).length / 1024).toFixed(0)} KB gzip`);
}
console.log(`USDA: ${out.length} foods in ${names.length} files`);
