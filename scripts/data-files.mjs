// Writes content-hashed data files (cache-first in the service worker: a changed file gets a new
// name, an unchanged one is never downloaded again) and records them in src/lib/sources.json.
import { createHash } from 'node:crypto';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';

export async function writeSourceFiles(source, base, jsons) {
  for (const f of await readdir('public/data')) {
    if (f.startsWith(`${base}`) && f.endsWith('.json')) await rm(`public/data/${f}`);
  }
  const names = [];
  for (const [i, json] of jsons.entries()) {
    const hash = createHash('sha256').update(json).digest('hex').slice(0, 8);
    const name = jsons.length === 1 ? `${base}.${hash}.json` : `${base}-${i}.${hash}.json`;
    await writeFile(`public/data/${name}`, json);
    names.push(name);
  }
  let sources = {};
  try {
    sources = JSON.parse(await readFile('src/lib/sources.json', 'utf8'));
  } catch {
    // first build
  }
  sources[source] = names;
  await writeFile('src/lib/sources.json', JSON.stringify(sources, null, 2) + '\n');
  return names;
}
