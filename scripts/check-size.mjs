// Fails the build when the performance budget in docs/ARCHITECTURE.md is exceeded.
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = {
  initialJs: 40 * KB, // entry chunk(s) referenced by index.html
  css: 8 * KB,
  workerJs: 15 * KB,
  foodData: 250 * KB, // per file
};

const gz = async (p) => gzipSync(await readFile(p), { level: 9 }).length;
const html = await readFile('dist/index.html', 'utf8');
const assets = await readdir('dist/assets');

// Every food-data file must fit the budget on its own (they load independently).
const dataFiles = (await readdir('dist/data')).filter((f) => f.endsWith('.json'));
let largestData = 0;
for (const f of dataFiles) largestData = Math.max(largestData, await gz(`dist/data/${f}`));
const sizes = { initialJs: 0, css: 0, workerJs: 0, foodData: largestData };
for (const f of assets) {
  const size = await gz(`dist/assets/${f}`);
  if (f.endsWith('.css')) sizes.css += size;
  else if (f.endsWith('.js') && html.includes(f)) sizes.initialJs += size;
  else if (f.endsWith('.js') && f.includes('worker')) sizes.workerJs += size;
}

let failed = false;
for (const [k, limit] of Object.entries(BUDGET)) {
  const ok = sizes[k] <= limit;
  failed ||= !ok;
  console.log(`${ok ? '✓' : '✗'} ${k.padEnd(10)} ${(sizes[k] / KB).toFixed(1).padStart(6)} KB gzip (budget ${limit / KB} KB)`);
}
if (failed) {
  console.error('Performance budget exceeded.');
  process.exit(1);
}
