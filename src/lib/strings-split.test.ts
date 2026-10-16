import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// M39b: the Swedish strings are split. i18n.ts holds the first screen's; strings-later.ts the rest,
// loaded with every lazy screen (lazy.tsx) or imported by modules that need them. A string used
// where it isn't loaded would show as nothing — this guards the split by reading the import graph.
const files: string[] = [];
const walk = (d: string) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) && !p.includes(`${join('lib', 'lang')}`)) files.push(p);
  }
};
walk('src');
const code = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const resolve = (from: string, spec: string) => {
  if (!spec.startsWith('.')) return null;
  const base = join(from, '..', spec);
  return ['', '.ts', '.tsx'].map((e) => base + e).find((p) => code.has(p)) ?? null;
};
const staticImports = (f: string) =>
  [...code.get(f)!.matchAll(/^import\s+(?!type\b)(?:[^;]*?from\s+)?'([^']+)'/gms)].map((m) => resolve(f, m[1])).filter((x): x is string => !!x);
const closure = (roots: string[], stop = new Set<string>()) => {
  const seen = new Set<string>();
  const visit = (f: string) => {
    if (seen.has(f) || stop.has(f)) return;
    seen.add(f);
    for (const g of staticImports(f)) visit(g);
  };
  roots.forEach(visit);
  return seen;
};
const keysOf = (f: string, start: string) => {
  const s = code.get(f)!;
  const body = s.slice(s.indexOf(start), s.indexOf('\n};', s.indexOf(start)));
  return [...body.matchAll(/^ {2}([A-Za-z0-9_]+):/gm)].map((m) => m[1]);
};
const later = keysOf(join('src', 'lib', 'strings-later.ts'), 'export const SV_LATER = {');
const base = keysOf(join('src', 'lib', 'i18n.ts'), 'const sv = {');
/** Keys built at runtime: t(`time_${x}`) uses every key starting with "time_". */
const templatePrefixes = (f: string) => [...code.get(f)!.matchAll(/\bt\(`([A-Za-z0-9_]*)\$\{/g)].map((m) => m[1]);
const uses = (f: string, k: string) => code.get(f)!.includes(`'${k}'`) || templatePrefixes(f).some((p) => p && k.startsWith(p));
const initial = closure([join('src', 'main.tsx')]);
initial.delete(join('src', 'lib', 'i18n.ts'));
/**
 * Other non-literal keys in the first bundle, checked by hand: each takes its keys from literal
 * lists that are in the first bundle too (so `uses` sees them).
 */
const CHECKED_DYNAMIC: Record<string, string[]> = {
  [join('src', 'app.tsx')]: ['view.value', 'v'], // views: the TABS list and View type in app.tsx/state.ts
  [join('src', 'components', 'Diary.tsx')]: ['meal'], // meals: MEALS in db.ts
};

describe('the split Swedish strings (M39b)', () => {
  it('are split, not lost or doubled', () => {
    expect(later.length).toBeGreaterThan(100);
    expect(later.filter((k) => base.includes(k))).toEqual([]);
  });

  it('finds the keys of both parts (a format change would make these lists empty)', () => {
    expect(base.length).toBeGreaterThan(30);
    expect(base).toContain('time_morning');
  });

  it('the first bundle uses only the first screen’s strings', () => {
    const bad = [...initial].flatMap((f) => later.filter((k) => uses(f, k)).map((k) => `${f}: ${k}`));
    expect(bad).toEqual([]);
  });

  it('every module using a later string has it loaded: via a lazy screen, or by importing it', () => {
    const app = code.get(join('src', 'app.tsx'))!;
    const lazyRoots = [...app.matchAll(/lazyView\(\(\) => import\('([^']+)'\)\)/g)].map((m) => resolve(join('src', 'app.tsx'), m[1])!);
    const importers = files.filter((f) => staticImports(f).includes(join('src', 'lib', 'strings-later.ts')));
    // Covered: reached from a lazy screen or a module importing the strings (not via the first bundle).
    const covered = closure([...lazyRoots, ...importers], initial);
    const bad = files
      .filter((f) => f !== join('src', 'lib', 'strings-later.ts') && !initial.has(f) && !covered.has(f))
      .flatMap((f) => later.filter((k) => uses(f, k)).map((k) => `${f}: ${k}`));
    expect(bad).toEqual([]);
  });

  it('the first bundle builds no other keys at runtime than the checked ones', () => {
    const dynamic = [...initial].flatMap((f) =>
      [...code.get(f)!.matchAll(/\bt\(([^'`)][^)]*)\)/g)].map((m) => m[1].trim()).filter((e) => !(CHECKED_DYNAMIC[f] ?? []).includes(e)).map((e) => `${f}: t(${e})`),
    );
    expect(dynamic).toEqual([]);
  });

  it('every string the first bundle uses works without the later strings loaded', async () => {
    const { lang, t } = await import('./i18n'); // strings-later is never imported in this file
    lang.value = 'sv';
    const used = [...base, ...later].filter((k) => [...initial].some((f) => uses(f, k)));
    expect(used.length).toBeGreaterThan(20);
    expect(used.filter((k) => !t(k as never))).toEqual([]);
  });
});
