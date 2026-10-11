import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';
import { CSP } from './src/csp';

export default defineConfig({
  // Relative base: the same build works at a domain root or under /repo/ on GitHub Pages.
  base: './',
  plugins: [
    preact(),
    {
      // Production builds only: the dev server injects inline styles. Injected as a head tag (not a
      // string replace), so a reformatted index.html can't silently ship without the policy.
      name: 'iron-log-csp',
      apply: 'build',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      ],
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
