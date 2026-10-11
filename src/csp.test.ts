import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
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

  it('allows exactly one inline script: the theme boot, by its hash', () => {
    expect(`sha256-${createHash('sha256').update(THEME_BOOT).digest('base64')}`).toBe(THEME_BOOT_HASH);
    expect(CSP.match(/'sha256-[^']+'/g)).toEqual([`'${THEME_BOOT_HASH}'`]);
  });
});
