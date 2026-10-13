// Downloads the inputs of the typical-price table (M33) into data/raw/prices/:
// - open-prices-sek.json: every SEK price on Open Food Facts' Open Prices (ODbL), slimmed to what
//   build-prices.mjs uses (product categories and pack size, store, date);
// - scb-kpi.json: SCB's monthly consumer price index per food and drink group (COICOP 01.1, 01.2,
//   02.1; CC0).
// - slv-ravaror.json: Livsmedelsverket's raw commodities per food (share and raw-weight factor), used
//   to price cooked foods and dishes, and each food's EuroFIR group (bröd, godis, maträtter …).
//   Rarely changes: kept unless --refresh-slv (~5 200 requests).
// Usage: node scripts/fetch-prices.mjs [--refresh-slv]
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';

const OUT = 'data/raw/prices';
await mkdir(OUT, { recursive: true });

const RAVAROR = `${OUT}/slv-ravaror.json`;
if (process.argv.includes('--refresh-slv') || !(await access(RAVAROR).then(() => true, () => false))) {
  const API = 'https://dataportal.livsmedelsverket.se/livsmedel/api/v1';
  const ids = JSON.parse(await readFile('data/raw/slv.json', 'utf8')).foods.map((f) => f.id);
  const out = {};
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      const rows = await json(`${API}/livsmedel/${id}/ravaror?sprak=1`);
      const classes = await json(`${API}/livsmedel/${id}/klassificeringar?sprak=1`);
      out[id] = {
        group: classes.find((c) => c.fasett.startsWith('A '))?.namn ?? null,
        // [FoodEx2 code, name, cooked?, share %, raw grams per 100 g of the food]
        raw: rows.map((r) => [r.foodEx2, r.namn.trim(), r.tillagning === 'Tillagad', r.andel, r.omraknadTillRa]),
      };
      if (Object.keys(out).length % 200 === 0) process.stdout.write(`\rLivsmedelsverket: ${Object.keys(out).length}/${ids.length}`);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  await writeFile(RAVAROR, JSON.stringify(out));
  console.log(`\nLivsmedelsverket: raw commodities of ${ids.length} foods`);
}

async function json(url, init) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res.json();
    if (attempt === 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt)); // both APIs rate-limit
  }
}

// Open Prices: 100 per page (the API's maximum).
const prices = [];
for (let page = 1, pages = 1; page <= pages; page++) {
  const d = await json(`https://prices.openfoodfacts.org/api/v1/prices?currency=SEK&size=100&page=${page}&order_by=id`);
  pages = d.pages;
  for (const p of d.items) {
    prices.push({
      id: p.id,
      date: p.date,
      price: p.price,
      per: p.price_per, // for category prices: KILOGRAM / UNIT
      discounted: p.price_is_discounted,
      code: p.product_code,
      category: p.category_tag, // prices without a barcode (loose fruit, vegetables …)
      name: p.product?.product_name ?? p.product_name,
      qty: p.product?.product_quantity,
      unit: p.product?.product_quantity_unit,
      categories: p.product?.categories_tags ?? [],
      store: p.location?.osm_brand ?? p.location?.osm_name ?? null,
      location: p.location_id,
      country: p.location?.osm_address_country_code ?? null,
    });
  }
  process.stdout.write(`\rOpen Prices: page ${page}/${pages}`);
}
console.log(`\nOpen Prices: ${prices.length} SEK prices`);
await writeFile(`${OUT}/open-prices-sek.json`, JSON.stringify(prices));

// SCB: index (2020=100) per food group, the last 36 months.
const TABLE = 'https://api.scb.se/OV0104/v1/doris/sv/ssd/PR/PR0101/PR0101A/KPI2020COICOPM';
const meta = await json(TABLE);
const groups = meta.variables[0].values.filter((v) => /^(01\.1|01\.2|02\.1)(\.|$)/.test(v)); // food, drinks
const d = await json(TABLE, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: [
      { code: 'VaruTjanstegrupp', selection: { filter: 'item', values: groups } },
      { code: 'ContentsCode', selection: { filter: 'item', values: ['0000080H'] } },
      { code: 'Tid', selection: { filter: 'top', values: ['36'] } },
    ],
    response: { format: 'json' },
  }),
});
const names = Object.fromEntries(meta.variables[0].values.map((v, i) => [v, meta.variables[0].valueTexts[i]]));
const index = {};
for (const r of d.data) {
  const [group, month] = r.key;
  const v = Number(r.values[0]);
  if (Number.isFinite(v)) ((index[group] ??= { name: names[group], months: {} }).months[month] = v);
}
console.log(`SCB: ${Object.keys(index).length} food groups`);
await writeFile(`${OUT}/scb-kpi.json`, JSON.stringify(index, null, 1));
