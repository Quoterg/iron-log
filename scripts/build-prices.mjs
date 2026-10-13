// Builds the typical-price table (M33): kr/kg for every Livsmedelsverket food the data supports.
//   public/data/prices.<hash>.json = { v, month, foods: { "slv:846": 14.1, … } }   (kr per kg)
//   src/lib/prices.json            = { file, month, foods }                       (for the app)
// Inputs: scripts/prices-spec.mjs (hand-made), data/prices-base.json (shelf prices, yearly), and
// data/raw/prices/* (pnpm data:fetch-prices: SCB's price index, Open Prices, Livsmedelsverket's raw
// commodities). Each price:
//   1. an item of the spec: its shelf price moved by SCB's index for its group to the latest month,
//      or the median of Open Prices (≥ 3 prices, ≥ 2 stores, last 12 months) when there are enough;
//   2. a food the spec names directly gets its item's price; for raw-priced items (meat, pasta,
//      rice, vegetables) cooked foods by the raw weight in them (Livsmedelsverket: cooked pasta =
//      50 g dry per 100 g → half the price per kg; porridge ≈ 15 g oats per 100 g);
//   3. other raw foods and home-style dishes: the sum of their raw commodities' prices, when ≥ 90 %
//      of the raw weight has a price. Industrial products without a shelf price get none.
// Fails (exit 1) when coverage drops more than 10 % from the previous table: check before merging.
// Usage: node scripts/build-prices.mjs [--review]   (--review: data/raw/prices/review.md lists what got which price)
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { FREE, INDUSTRIAL, ITEMS, SUM_GROUPS } from './prices-spec.mjs';

const read = async (f) => JSON.parse(await readFile(f, 'utf8'));
const base = await read('data/prices-base.json');
const scb = await read('data/raw/prices/scb-kpi.json');
const openPrices = await read('data/raw/prices/open-prices-sek.json');
const slvRaw = await read('data/raw/prices/slv-ravaror.json');
const names = new Map((await read('data/raw/slv.json')).foods.map((f) => [String(f.id), f.sv]));

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
/** "2026-10-13" → "2026M10" (SCB's month keys). */
const scbMonth = (date) => `${date.slice(0, 4)}M${date.slice(5, 7)}`;
const LATEST = Object.values(scb)
  .flatMap((g) => Object.keys(g.months))
  .sort()
  .at(-1);

/** SCB index factor for a group, from month `from` (or the latest before it) to the latest month. */
export function indexFactor(group, from) {
  const months = scb[group]?.months;
  if (!months?.[LATEST]) return 1;
  const known = Object.keys(months).filter((m) => m <= from).sort();
  const start = months[from] ?? months[known.at(-1)];
  return start ? months[LATEST] / start : 1;
}

// --- 1. Item prices
const since = new Date(`${LATEST.slice(0, 4)}-${LATEST.slice(5)}-01`);
since.setMonth(since.getMonth() - 11);
const sinceDate = since.toISOString().slice(0, 10);
function openPrice(p) {
  if (p.category) return p.per === 'KILOGRAM' ? p.price : null;
  const g = p.qty * ({ g: 1, ml: 1, kg: 1000, l: 1000 }[(p.unit ?? '').toLowerCase()] ?? NaN);
  return g > 0 ? (p.price / g) * 1000 : null;
}
const item = new Map(); // key → { kr, source }
for (const it of ITEMS) {
  const shelf = base.items[it.key];
  let price = shelf ? { kr: shelf.kr * indexFactor(it.scb, scbMonth(shelf.date)), source: 'shelf' } : null;
  if (it.off) {
    const tags = new Set(it.off);
    const found = openPrices.filter((p) => p.date >= sinceDate && (tags.has(p.category) || p.categories?.some((c) => tags.has(c))));
    const xs = found
      .map((p) => ({ kr: openPrice(p), p }))
      .filter((x) => x.kr > 0)
      .map((x) => ({ kr: x.kr * indexFactor(it.scb, scbMonth(x.p.date)), loc: x.p.location }));
    if (xs.length >= 3 && new Set(xs.map((x) => x.loc)).size >= 2) {
      const sorted = xs.map((x) => x.kr).sort((a, b) => a - b);
      const trim = Math.floor(sorted.length / 10); // outliers: drop the extreme 10 % on each side
      const kr = median(sorted.slice(trim, sorted.length - trim));
      // Open Prices comes from a few contributors: use it only when it agrees with the shelf within ×1.5.
      if (!price || (kr / price.kr < 1.5 && price.kr / kr < 1.5)) price = { kr, source: 'open-prices' };
    }
  }
  if (price) item.set(it.key, price);
}
const commodity = new Map();
for (const it of ITEMS) for (const c of it.com ?? []) if (item.has(it.key) && !commodity.has(c)) commodity.set(c, item.get(it.key).kr);

// --- 2./3. Food prices
/** The commodity row that is ≥ 90 % of a food (ignoring water), if any. */
function dominant(rows) {
  const solid = rows.filter((r) => !FREE.has(r[1]));
  const total = solid.reduce((s, r) => s + (r[3] ?? 0), 0);
  const top = solid.reduce((a, r) => ((r[3] ?? 0) > (a?.[3] ?? 0) ? r : a), null);
  return top && total && top[3] / total >= 0.9 ? top : null;
}
/** A food in a cooked (or otherwise prepared) state, by its name. */
const COOKED = /kokt|stekt|tillagad|grillad|grillat|gröt|bakad|friterad|wokad|brynt|förvälld|rostad|fräst|värmd|stuvad|gratinerad/;

/** kr/kg of a food from its raw commodities, when ≥ 90 % of the raw weight has a price. */
function summed(raw) {
  let cost = 0;
  let priced = 0;
  let weight = 0;
  for (const [, c, , , rawG] of raw) {
    if (!(rawG > 0) || FREE.has(c)) continue;
    weight += rawG;
    const p = commodity.get(c);
    if (p == null) continue;
    cost += (rawG / 100) * p;
    priced += rawG;
  }
  return weight && priced / weight >= 0.9 ? (cost * weight) / priced : null; // the rest at the same average
}

const foods = {};
const how = { item: 0, sum: 0, none: 0 };
const review = new Map(); // --review: which foods each item priced, and the summed ones
const byGroup = {};
for (const [id, { group, raw }] of Object.entries(slvRaw)) {
  const name = names.get(id);
  if (!name) continue;
  let kr = null;
  const it = ITEMS.find((i) => i.slv?.test(name) && item.has(i.key));
  if (it) {
    kr = item.get(it.key).kr;
    const f = it.factors?.find(([re]) => re.test(name));
    if (f) kr *= f[1];
    if (it.raw && COOKED.test(name)) {
      const d = dominant(raw);
      if (d?.[4] > 0) kr *= d[4] / 100; // raw grams of it per 100 g of the food
      else kr = summed(raw) ?? kr; // e.g. porridge on milk: oats and milk
    }
    how.item++;
    if (!review.has(it.key)) review.set(it.key, []);
    review.get(it.key).push(`${name} ${Math.round(kr)}`);
  } else if (SUM_GROUPS.has(group) && !INDUSTRIAL.test(name)) {
    kr = summed(raw);
    if (kr != null) {
      how.sum++;
      if (!review.has(`sum: ${group}`)) review.set(`sum: ${group}`, []);
      review.get(`sum: ${group}`).push(`${name} ${Math.round(kr)}`);
    }
  }
  const g = (byGroup[group] ??= { priced: 0, all: 0 });
  g.all++;
  if (kr != null && kr > 0) {
    foods[`slv:${id}`] = Math.round(kr * 10) / 10;
    g.priced++;
  } else how.none++;
}

if (process.argv.includes('--review')) {
  const unpriced = Object.entries(slvRaw).filter(([id]) => !foods[`slv:${id}`]).map(([id, f]) => `${names.get(id)} (${f.group})`);
  const out = [...review].map(([k, v]) => `## ${k}${item.has(k) ? ` ${Math.round(item.get(k).kr)} kr/kg (${item.get(k).source})` : ''}\n${v.join(' | ')}`);
  await writeFile('data/raw/prices/review.md', [...out, `## unpriced\n${unpriced.join(' | ')}`].join('\n\n') + '\n');
}

// --- Output
const count = Object.keys(foods).length;
let previous = null;
try {
  previous = (await read('src/lib/prices.json')).foods;
} catch {
  // first build
}
const json = JSON.stringify({ v: 1, month: LATEST, foods });
for (const f of await readdir('public/data')) if (/^prices\.[0-9a-f]{8}\.json$/.test(f)) await rm(`public/data/${f}`);
const file = `prices.${createHash('sha256').update(json).digest('hex').slice(0, 8)}.json`;
await writeFile(`public/data/${file}`, json);
await writeFile('src/lib/prices.json', JSON.stringify({ file, month: LATEST, foods: count }, null, 2) + '\n');

const fromOpen = [...item.values()].filter((p) => p.source === 'open-prices').length;
const summary = [
  `Typical prices for ${LATEST}: **${count} of ${names.size} foods** (${how.item} by a shelf price, ${how.sum} summed from their raw commodities).`,
  `Shelf prices from ${base.source}, collected ${base.collected}; moved by SCB's price index to ${LATEST}. ${fromOpen} of ${item.size} items from Open Prices.`,
  previous != null ? `Previous table: ${previous} foods.` : '',
  '',
  '| Group | Priced |',
  '|---|---|',
  ...Object.entries(byGroup)
    .sort((a, b) => b[1].all - a[1].all)
    .map(([g, x]) => `| ${g} | ${x.priced}/${x.all} |`),
].join('\n');
await writeFile('data/raw/prices/summary.md', summary + '\n');
console.log(summary.split('\n').slice(0, 3).join('\n'));
console.log(`Wrote ${file}, ${(json.length / 1024).toFixed(1)} KB raw`);
if (previous != null && count < previous * 0.9) {
  console.error(`Coverage dropped from ${previous} to ${count} foods (more than 10 %): check the inputs.`);
  process.exit(1);
}
