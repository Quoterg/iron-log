import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { CSP, CSP_DIRECTIVES, THEME_BOOT, THEME_BOOT_HASH } from './csp';

describe('Content-Security-Policy', () => {
  it('stays strict: no unsafe-inline/unsafe-eval, no wildcards, no other hosts', () => {
    expect(CSP).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*|http:|data:|blob:/);
    const hosts = CSP.match(/https:\/\/[^\s;]+/g) ?? [];
    expect(hosts).toEqual(['https://world.openfoodfacts.org']);
  });

  it('locks down plugins, base URI and form submissions', () => {
    const d = Object.fromEntries(CSP_DIRECTIVES);
    expect([d['object-src'], d['base-uri'], d['form-action'], d['default-src']]).toEqual(["'none'", "'none'", "'none'", "'self'"]);
  });

  it('allows exactly one inline script: the theme boot in index.html, by its hash', () => {
    expect(`sha256-${createHash('sha256').update(THEME_BOOT).digest('base64')}`).toBe(THEME_BOOT_HASH);
    expect(CSP.match(/'sha256-[^']+'/g)).toEqual([`'${THEME_BOOT_HASH}'`]);
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(inline).toEqual([THEME_BOOT]);
  });
});
