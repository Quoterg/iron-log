import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

/**
 * Content-Security-Policy (docs/SECURITY-REVIEW.md, S2). GitHub Pages can't send headers, so it's
 * a meta tag (frame-ancestors can't be set that way) — added to production builds only, because
 * the dev server injects inline styles. Network: this site and Open Food Facts (lookups, uploads);
 * WebAssembly for the barcode-scanner fallback. Device-to-device sync (WebRTC) isn't governed by CSP.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self' https://world.openfoodfacts.org",
  "img-src 'self' data: blob:",
  "style-src 'self'",
  "font-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export default defineConfig({
  // Relative base: the same build works at a domain root or under /repo/ on GitHub Pages.
  base: './',
  plugins: [
    preact(),
    {
      name: 'iron-log-csp',
      apply: 'build',
      transformIndexHtml: (html) =>
        html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
    },
  ],
  build: {
    target: 'es2019', // Chrome 80+ / Safari 14+ — covers old Android phones.
    cssTarget: 'chrome80',
    modulePreload: { polyfill: false },
  },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
