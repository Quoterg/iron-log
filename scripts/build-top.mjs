// Precomputes the richest foods per nutrient (per 100 g) for each database, so the nutrient page
// shows them from one small file instead of downloading and parsing every database.
//   public/data/top.<hash>.json = { v, keys, n, sources: { slv: { vitK: [[ref, sv, en, value], …] } } }
//   public/data/everyday.<hash>.json = { v, keys, n, sources: { slv: { iron: [[ref, sv, en, value, kcal, portionG], …] } } }
// The file names are recorded in src/lib/top.json. Run after build-foods / build-usda:
//   node scripts/build-top.mjs
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { topK } from './top.mjs';

const N = 10;
const NUTRIENTS = JSON.parse(await readFile('src/lib/nutrients.json', 'utf8'));
const sources = JSON.parse(await readFile('src/lib/sources.json', 'utf8'));

// Everyday foods (with household measures) richest per kcal, for suggestions (M27): concentrated
// items like dried herbs top the per-100 g lists but are never eaten by the 100 g.
const EVERYDAY = 12;
const out = { v: 1, keys: NUTRIENTS.map((n) => n.key), n: N, sources: {}, everyday: {} };
for (const [source, files] of Object.entries(sources)) {
  const rows = [];
  const units = {};
  for (const f of files) {
    const data = JSON.parse(await readFile(`public/data/${f}`, 'utf8'));
    rows.push(...data.foods);
    Object.assign(units, data.units ?? {});
  }
  const perKey = {};
  NUTRIENTS.forEach((n, i) => {
    const top = topK(rows, (r) => r[3 + i], N);
    if (top.length) perKey[n.key] = top.map((r) => [r[0], r[1], r[2], r[3 + i]]);
  });
  out.sources[source] = perKey;

  // [ref, sv, en, value per 100 g, kcal per 100 g, portion g (the largest household measure, ≤ 300 g)]
  // Never suggest drinks with alcohol.
  const alcohol = 3 + NUTRIENTS.findIndex((n) => n.key === 'alcohol');
  const withUnits = rows.filter((r) => units[r[0]]?.length && !((r[alcohol] ?? 0) > 0.5));
  const portion = (r) => Math.min(300, Math.max(...units[r[0]].map((u) => u[1])));
  const everyday = {};
  NUTRIENTS.forEach((n, i) => {
    if (n.key === 'kcal') return;
    const top = topK(withUnits, (r) => (r[3 + i] ?? 0) / Math.max(r[3] ?? 0, 20), EVERYDAY);
    if (top.length) everyday[n.key] = top.map((r) => [r[0], r[1], r[2], r[3 + i], r[3] ?? 0, portion(r)]);
  });
  if (Object.keys(everyday).length) out.everyday[source] = everyday;
}

// Two files: the nutrient detail only needs the per-100 g lists; suggestions only the everyday ones.
const { everyday, ...top } = out;
const files = {};
for (const [prefix, data] of [['top', { ...top, v: 1 }], ['everyday', { v: 1, keys: out.keys, n: EVERYDAY, sources: everyday }]]) {
  const json = JSON.stringify(data);
  for (const f of await readdir('public/data')) if (new RegExp(`^${prefix}\\.[0-9a-f]{8}\\.json$`).test(f)) await rm(`public/data/${f}`);
  const name = `${prefix}.${createHash('sha256').update(json).digest('hex').slice(0, 8)}.json`;
  await writeFile(`public/data/${name}`, json);
  files[prefix === 'top' ? 'file' : 'everyday'] = name;
  console.log(`Wrote ${name}, ${(json.length / 1024).toFixed(1)} KB raw`);
}
await writeFile('src/lib/top.json', JSON.stringify(files, null, 2) + '\n');
