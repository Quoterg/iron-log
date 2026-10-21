// Downloads the inputs of "Frukt i säsong" (M40) into data/raw/fruit/:
// - imports.json: SCB's monthly imports (tonnes) of each fruit's product codes from every country,
//   the last 36 months (table ImpTotalKNMan, CC0);
// - origins.json: Eurostat Comext (EU trade, free reuse with attribution): for each EU country, its monthly
//   imports from outside the EU and its exports of each code — fruit sent to Sweden via a trade hub
//   (mango via the Netherlands) is then counted as from outside Europe (see build-fruit.mjs);
// - sweden.json: Jordbruksverket's open statistics — monthly producer prices of Swedish apples and
//   strawberries (JO1001L2, the last 36 months) and yearly harvests (JO0102R21 fruit, JO0102R11 berries).
// Run by .github/workflows/prices.yml twice a year; build-fruit.mjs turns it into the app's table.
// Usage: node scripts/fetch-fruit.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { FRUITS } from './fruit-spec.mjs';

const OUT = 'data/raw/fruit';
await mkdir(OUT, { recursive: true });

async function json(url, body) {
  const init = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: body, response: { format: 'json' } }) } : undefined;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init).catch((e) => ({ ok: false, status: e.cause?.code ?? e.message })); // dropped connections too
    if (res.ok) return res.json();
    if (attempt === 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 3000 * attempt)); // SCB: 30 requests per 10 s
  }
}
/** Fail loudly when a source changes shape, rather than build an empty or shifted table. */
function expectShape(ok, what) {
  if (!ok) throw new Error(`Unexpected format: ${what}`);
}
const MONTH = /^\d{4}M\d{2}$/; // "2025M03"
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null); // ".." = not published

// --- SCB: imports by product code and country
const SCB = 'https://api.scb.se/OV0104/v1/doris/sv/ssd/HA/HA0201/HA0201B/ImpTotalKNMan';
const meta = await json(SCB);
const months = meta.variables.find((v) => v.code === 'Tid').values.slice(-36);
expectShape(months.length === 36 && months.every((m) => MONTH.test(m)), `SCB months ${months.slice(0, 2)}`);
const codes = [...new Set(FRUITS.flatMap((f) => f.cn))];
const imports = { months, codes: {} };
for (const code of codes) {
  const d = await json(SCB, [
    { code: 'VarugruppKN', selection: { filter: 'item', values: [code] } },
    { code: 'Handelspartner', selection: { filter: 'all', values: ['*'] } },
    { code: 'ContentsCode', selection: { filter: 'item', values: ['HA0201N1'] } }, // tonnes
    { code: 'Tid', selection: { filter: 'item', values: months } },
  ]);
  const byCountry = {};
  for (const r of d.data) {
    const [, partner, month] = r.key;
    const t = num(r.values[0]);
    if (!t) continue;
    (byCountry[partner] ??= Array(months.length).fill(0))[months.indexOf(month)] = t;
  }
  imports.codes[code] = byCountry;
  process.stdout.write(`\rSCB: ${Object.keys(imports.codes).length}/${codes.length} product codes`);
}
console.log(`\nSCB: ${months[0]}–${months.at(-1)}`);
await writeFile(`${OUT}/imports.json`, JSON.stringify(imports));

// --- Eurostat Comext: every EU country's imports from outside the EU and its exports, same months
const EU27 = 'AT BE BG CY CZ DE DK EE ES FI FR GR HR HU IE IT LT LU LV MT NL PL PT RO SE SI SK'.split(' ');
const COMEXT = 'https://ec.europa.eu/eurostat/api/comext/dissemination/statistics/1.0/data/DS-045409';
const dash = (m) => m.replace('M', '-'); // SCB "2025M03" → Eurostat "2025-03"
const origins = {};
for (const code of codes) {
  const q = [
    'format=JSON', 'lang=en', 'freq=M', ...EU27.map((r) => `reporter=${r}`), 'partner=EXT_EU27_2020', 'partner=WORLD',
    `product=${code}`, 'flow=1', 'flow=2', 'indicators=QUANTITY_IN_100KG', `sinceTimePeriod=${dash(months[0])}`,
  ].join('&');
  const d = await json(`${COMEXT}?${q}`);
  const idx = (dim, k) => d.dimension[dim].category.index[k];
  expectShape(d.id?.join() === 'freq,reporter,partner,product,flow,indicators,time', `Eurostat dimensions ${d.id}`);
  const [, np, , nf, , nt] = d.size.slice(1); // reporter, partner, product, flow, indicator, time
  const at = (r, p, f, t) => d.value[((idx('reporter', r) * np + idx('partner', p)) * nf + idx('flow', f)) * nt + idx('time', t)] ?? 0;
  for (const r of EU27) {
    if (idx('reporter', r) == null) continue;
    const series = (p, f) => months.map((m) => (idx('time', dash(m)) == null ? 0 : at(r, p, f, dash(m)) / 10)); // 100 kg → tonnes
    const extraImports = series('EXT_EU27_2020', '1');
    const exports = series('WORLD', '2');
    if (exports.some((x) => x > 0)) (origins[code] ??= {})[r] = { extraImports, exports };
  }
  process.stdout.write(`\rEurostat: ${Object.keys(origins).length}/${codes.length} product codes`);
}
console.log('');
await writeFile(`${OUT}/origins.json`, JSON.stringify(origins));

// --- Jordbruksverket: Swedish producer prices by month, harvests by year
const JBV = 'https://statistik.jordbruksverket.se/PXWeb/api/v1/sv/Jordbruksverkets%20statistikdatabas';
const PRICES = `${JBV}/Priser%20och%20prisindex/Priser/Avrakningspriser20/JO1001L2.px`;
const pmeta = await json(PRICES);
const mvar = pmeta.variables.find((v) => v.code === 'Månad');
const mIds = mvar.values.slice(-36);
expectShape(mIds.every((id) => MONTH.test(mvar.valueTexts[mvar.values.indexOf(id)])), `Jordbruksverket months ${mvar.valueTexts.slice(-2)}`);
const products = [...new Set(FRUITS.map((f) => f.se?.price).filter(Boolean))];
const pd = await json(PRICES, [
  { code: 'Produkter', selection: { filter: 'item', values: products } },
  { code: 'Månad', selection: { filter: 'item', values: mIds } },
]);
const sweden = { prices: {}, harvest: {} };
for (const r of pd.data) {
  const [product, m] = r.key;
  (sweden.prices[product] ??= {})[mvar.valueTexts[mvar.values.indexOf(m)]] = num(r.values[0]);
}
const tables = {};
for (const f of FRUITS.filter((f) => f.se)) (tables[f.se.harvest[0]] ??= []).push(f);
for (const [table, fruits] of Object.entries(tables)) {
  const url = `${JBV}/Tradgardsodling/Odling/Atbara%20vaxter/${table}.px`;
  const m = await json(url);
  const v = Object.fromEntries(m.variables.map((x) => [x.code, x]));
  const crop = (name) => v['Gröda'].values[v['Gröda'].valueTexts.indexOf(name)];
  const d = await json(url, [
    { code: 'Län', selection: { filter: 'item', values: [v['Län'].values[0]] } }, // 00 Riket
    { code: 'Gröda', selection: { filter: 'item', values: fruits.map((f) => crop(f.se.harvest[1])) } },
    { code: 'Variabel', selection: { filter: 'item', values: v.Variabel.values.filter((_, i) => v.Variabel.valueTexts[i].startsWith('Skörd')) } },
    { code: 'År', selection: { filter: 'item', values: v['År'].values.slice(-6) } },
  ]);
  for (const r of d.data) {
    const name = v['Gröda'].valueTexts[v['Gröda'].values.indexOf(r.key[1])];
    const year = v['År'].valueTexts[v['År'].values.indexOf(r.key.at(-1))];
    (sweden.harvest[name] ??= {})[year] = num(r.values[0]);
  }
}
console.log(`Jordbruksverket: prices for ${Object.keys(sweden.prices).length} products, harvests for ${Object.keys(sweden.harvest).join(', ')}`);
await writeFile(`${OUT}/sweden.json`, JSON.stringify(sweden, null, 1));
