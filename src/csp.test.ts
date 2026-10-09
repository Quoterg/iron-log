import { describe, expect, it } from 'vitest';
import { CSP, CSP_DIRECTIVES } from './csp';

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
});
