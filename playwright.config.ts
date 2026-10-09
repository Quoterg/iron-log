import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    ...devices['Moto G4'],
    browserName: 'chromium',
    baseURL: 'http://localhost:4173/',
    locale: 'sv-SE',
  },
  webServer: {
    command: 'vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
