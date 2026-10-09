// Downloads USDA FoodData Central (public domain) "SR Legacy" and "Foundation" CSV releases into
// data/raw/usda/<set>/ (unzipped). Needs the `unzip` command. Usage: node scripts/fetch-usda.mjs
import { execFileSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';

const BASE = 'https://fdc.nal.usda.gov/fdc-datasets/';
const SETS = {
  sr_legacy: 'FoodData_Central_sr_legacy_food_csv_2018-04.zip',
  foundation: 'FoodData_Central_foundation_food_csv_2026-04-30.zip',
};

for (const [name, file] of Object.entries(SETS)) {
  const dir = `data/raw/usda/${name}`;
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const res = await fetch(BASE + file);
  if (!res.ok) throw new Error(`${res.status} ${file}`);
  const zip = `${dir}.zip`;
  await writeFile(zip, Buffer.from(await res.arrayBuffer()));
  // -j: flatten the release's folder; only the CSVs we use.
  execFileSync('unzip', ['-q', '-o', '-j', zip, '*/food.csv', '*/food_nutrient.csv', '*/nutrient.csv', '*/food_portion.csv', '-d', dir]);
  await rm(zip);
  console.log(`${name}: ${file}`);
}
