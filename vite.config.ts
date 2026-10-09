import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base: the same build works at a domain root or under /repo/ on GitHub Pages.
  base: './',
  plugins: [preact()],
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
