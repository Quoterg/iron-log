// Builds the season table of "Frukt i säsong" (M40) from data/raw/fruit (fetch-fruit.mjs):
//   src/lib/fruit-season.json = { period, fruits: [{ key, sv, en, food, unit, t, se, eu, top }] }
// per fruit and calendar month (index 0 = January):
//   t    tonnes on the Swedish market in an average such month: imports + Swedish harvest
//   se   % of it Swedish, eu % from the rest of Europe (the rest from further away)
//   top  the biggest single origin (ISO country code, "SE" = Sweden; "" = from outside Europe via a
//        trade hub, origin country unknown)
// Imports: SCB's monthly imports by sending country, averaged per calendar month over the last 3 years.
// An EU country can send on fruit it imported (mango via the Netherlands): of what it sends, the share
// min(1, its imports from outside the EU ÷ its exports) that month (Eurostat) counts as from outside
// Europe — Spanish oranges in January stay Spanish, "Dutch" mangoes are counted as from further away.
// Swedish fruit: the yearly harvest (average of the last 3 published years), spread evenly over the
// months Swedish growers sold it (a producer price in at least half of the years) — Jordbruksverket.
// Fails (exit 1) when a fruit has no data or its food is missing: check fetch-fruit.mjs's output.
// Usage: node scripts/build-fruit.mjs
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { EUROPE, FRUITS } from './fruit-spec.mjs';

const read = async (f) => JSON.parse(await readFile(f, 'utf8'));
const imports = await read('data/raw/fruit/imports.json');
const sweden = await read('data/raw/fruit/sweden.json');
const origins = await read('data/raw/fruit/origins.json');
const foodsFile = (await readdir('public/data')).find((f) => /^foods\.[0-9a-f]+\.json$/.test(f));
const foodRefs = new Set((await read(`public/data/${foodsFile}`)).foods.map((f) => f[0]));
const monthOf = (key) => Number(key.slice(5)) - 1; // "2025M03" → 2

/** Average tonnes per calendar month of a series over `months` (each calendar month: its years' mean). */
function perMonth(series, months) {
  const sum = Array(12).fill(0);
  const n = Array(12).fill(0);
  months.forEach((m, i) => {
    sum[monthOf(m)] += series[i] ?? 0;
    n[monthOf(m)]++;
  });
  return sum.map((s, i) => (n[i] ? s / n[i] : 0));
}

/** Calendar months with a Swedish producer price in at least half of the years. */
function sellingMonths(product) {
  const prices = sweden.prices[product] ?? {};
  const seen = Array(12).fill(0);
  const priced = Array(12).fill(0);
  for (const [m, v] of Object.entries(prices)) {
    seen[monthOf(m)]++;
    if (v != null) priced[monthOf(m)]++;
  }
  return seen.map((s, i) => s > 0 && priced[i] / s >= 0.5);
}

/** Average yearly harvest (tonnes) over the last 3 published years. */
function harvest(crop) {
  const years = Object.entries(sweden.harvest[crop] ?? {})
    .filter(([, t]) => t != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-3);
  return years.length ? years.reduce((s, [, t]) => s + t, 0) / years.length : 0;
}

/** Share (0–1) of what EU country `c` sends of product codes `cn` that came from outside the EU, per calendar month. */
function farShare(cn, c) {
  const extra = Array(12).fill(0);
  const exp = Array(12).fill(0);
  for (const code of cn) {
    const o = origins[code]?.[c];
    if (!o) continue;
    imports.months.forEach((m, i) => {
      extra[monthOf(m)] += o.extraImports[i];
      exp[monthOf(m)] += o.exports[i];
    });
  }
  return exp.map((x, i) => (x > 0 ? Math.min(1, extra[i] / x) : 0));
}

const bad = [];
const round = (x) => Math.round(x);
const fruits = FRUITS.map((f) => {
  // Imports by country, per calendar month.
  const byCountry = {};
  for (const code of f.cn) {
    for (const [country, series] of Object.entries(imports.codes[code] ?? {})) {
      if (country === 'TOT') continue;
      const pm = perMonth(series, imports.months);
      byCountry[country] = (byCountry[country] ?? Array(12).fill(0)).map((x, i) => x + pm[i]);
    }
  }
  // Swedish harvest over the selling months (pears: the apple months).
  if (f.se) {
    const product = f.se.price ?? FRUITS.find((g) => g.key === f.se.like)?.se?.price;
    const months = sellingMonths(product);
    const n = months.filter(Boolean).length;
    const yearly = harvest(f.se.harvest[1]);
    if (n && yearly) byCountry.SE = months.map((on, i) => (on ? yearly / n : 0) + (byCountry.SE?.[i] ?? 0));
    else bad.push(`${f.key}: no Swedish harvest or selling months`);
  }
  // Fruit sent on by European trade hubs: that share moves to "" (outside Europe, origin unknown).
  const origin = { '': Array(12).fill(0) };
  for (const [c, v] of Object.entries(byCountry)) {
    const far = c !== 'SE' && EUROPE.has(c) ? farShare(f.cn, c) : Array(12).fill(0);
    origin[c] = v.map((x, i) => x * (1 - far[i]));
    origin[''] = origin[''].map((x, i) => x + v[i] * far[i]);
  }
  const t = Array.from({ length: 12 }, (_, i) => Object.values(origin).reduce((s, v) => s + v[i], 0));
  const share = (pick) => t.map((total, i) => (total ? round((100 * Object.entries(origin).filter(([c]) => pick(c)).reduce((s, [, v]) => s + v[i], 0)) / total) : 0));
  const top = t.map((_, i) => Object.entries(origin).sort((a, b) => b[1][i] - a[1][i])[0]?.[0] ?? '');
  if (!t.some((x) => x > 0)) bad.push(`${f.key}: no imports`);
  if (!foodRefs.has(f.food)) bad.push(`${f.key}: food ${f.food} not in ${foodsFile}`);
  return { key: f.key, sv: f.sv, en: f.en, food: f.food, unit: f.unit, t: t.map(round), se: share((c) => c === 'SE'), eu: share((c) => c !== 'SE' && EUROPE.has(c)), top };
});
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}

const period = `${imports.months[0]}–${imports.months.at(-1)}`;
await writeFile('src/lib/fruit-season.json', `${JSON.stringify({ period, fruits })}\n`);

// A readable summary for the review of the twice-yearly update.
const M = 'J F M A M J J A S O N D'.split(' ');
const lines = [
  `## Fruit seasons (${period})`,
  '',
  'Tonnes per month on the Swedish market (imports + Swedish harvest); **bold** = at least 120 % of the',
  'fruit\'s monthly average; `se` = Swedish share. Biggest origin in brackets.',
  '',
  `| Fruit | ${M.join(' | ')} |`,
  `|---|${M.map(() => '---').join('|')}|`,
  ...fruits.map((f) => {
    const avg = f.t.reduce((a, b) => a + b, 0) / 12;
    return `| ${f.sv} | ${f.t.map((x, i) => `${x >= avg * 1.2 ? `**${x}**` : x}${f.se[i] ? ` se ${f.se[i]} %` : ''} (${f.top[i]})`).join(' | ')} |`;
  }),
];
await writeFile('data/raw/fruit/summary.md', `${lines.join('\n')}\n`);
console.log(`Fruit seasons: ${fruits.length} fruits, ${period}`);
