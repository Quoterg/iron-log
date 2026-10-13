// Compiles the base shelf prices of the typical-price table (M33): one search on willys.se per item
// of prices-spec.mjs, the median comparison price (kr/kg) of the matching products, into
// data/prices-base.json. Run by hand about once a year (owner's choice, 2026-10-13) — never in CI;
// between runs SCB's price index moves the prices (build-prices.mjs). A few requests, spaced out.
// Usage: node scripts/compile-base-prices.mjs [key …]   (only the given items, keeping the rest)
import { readFile, writeFile } from 'node:fs/promises';
import { ITEMS } from './prices-spec.mjs';

const OUT = 'data/prices-base.json';
const MAX = 12; // products per item (most relevant first)
const only = new Set(process.argv.slice(2));

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** kr per kg from Willys' comparison price ("87,90 kr" per kg / l / st). */
export function krPerKg(compare, unit, item) {
  const kr = Number(String(compare).replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (!(kr > 0)) return null;
  if (unit === 'kg') return kr;
  if (unit === 'l') return kr / (item.density ?? 1);
  if (unit === 'st' && item.pieceG) return (kr / item.pieceG) * 1000;
  return null;
}

let base = { items: {} };
try {
  base = JSON.parse(await readFile(OUT, 'utf8'));
} catch {
  // first run
}
const today = new Date().toISOString().slice(0, 10);
const problems = [];
for (const item of ITEMS) {
  if (only.size && !only.has(item.key)) continue;
  const queries = [item.q].flat();
  const prices = [];
  const names = [];
  for (const q of queries) {
    const url = `https://www.willys.se/search?q=${encodeURIComponent(q)}&size=40`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'iron-log price table (github.com/Quoterg/iron-log)' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    let taken = 0; // per query, so each search contributes its most relevant products
    for (const p of (await res.json()).results ?? []) {
      if (names.includes(p.name)) continue;
      if (item.re && !item.re.test(p.name)) continue;
      if (item.not && item.not.test(p.name)) continue;
      const x = krPerKg(p.comparePrice, p.comparePriceUnit, item);
      if (x == null) continue;
      prices.push(x);
      names.push(p.name);
      if (++taken === Math.ceil(MAX / queries.length)) break;
    }
    if (queries.length > 1) await new Promise((r) => setTimeout(r, 1500));
  }
  if (prices.length < 3) problems.push(`${item.key}: ${prices.length} products (${item.q})`);
  if (prices.length) {
    base.items[item.key] = { kr: Math.round(median(prices) * 10) / 10, n: prices.length, date: today, examples: names.slice(0, 3) };
  }
  console.log(`${item.key.padEnd(22)} ${prices.length ? base.items[item.key].kr : '-'} kr/kg  (${prices.length})`);
  await new Promise((r) => setTimeout(r, 1500));
}
base.source = 'willys.se jämförpriser';
base.collected = today;
await writeFile(OUT, JSON.stringify(base, null, 1) + '\n');
if (problems.length) console.log(`\nFewer than 3 products:\n  ${problems.join('\n  ')}`);
