// Precomputes the richest foods per nutrient (per 100 g) for each database, so the nutrient page
// shows them from one small file instead of downloading and parsing every database.
//   public/data/top.<hash>.json = { v, keys, n, sources: { slv: { vitK: [[ref, sv, en, value], …] } } }
// The file name is recorded in src/lib/top.json. Run after build-foods / build-usda:
//   node scripts/build-top.mjs
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { topK } from './top.mjs';

const N = 10;
const NUTRIENTS = JSON.parse(await readFile('src/lib/nutrients.json', 'utf8'));
const sources = JSON.parse(await readFile('src/lib/sources.json', 'utf8'));

const out = { v: 1, keys: NUTRIENTS.map((n) => n.key), n: N, sources: {} };
for (const [source, files] of Object.entries(sources)) {
  const rows = [];
  for (const f of files) rows.push(...JSON.parse(await readFile(`public/data/${f}`, 'utf8')).foods);
  const perKey = {};
  NUTRIENTS.forEach((n, i) => {
    const top = topK(rows, (r) => r[3 + i], N);
    if (top.length) perKey[n.key] = top.map((r) => [r[0], r[1], r[2], r[3 + i]]);
  });
  out.sources[source] = perKey;
}

const json = JSON.stringify(out);
for (const f of await readdir('public/data')) if (/^top\.[0-9a-f]{8}\.json$/.test(f)) await rm(`public/data/${f}`);
const name = `top.${createHash('sha256').update(json).digest('hex').slice(0, 8)}.json`;
await writeFile(`public/data/${name}`, json);
await writeFile('src/lib/top.json', JSON.stringify({ file: name }, null, 2) + '\n');
console.log(`Wrote ${name}, ${(json.length / 1024).toFixed(1)} KB raw`);
