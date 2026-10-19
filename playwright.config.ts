import { defineConfig, devices } from '@playwright/test';

// Routes also see the service worker's own fetches (Chromium): e2e/perf.spec.ts delays the app page
// as a slow connection would. Must be set before the browser starts.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS ??= '1';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    ...devices['Moto G4'],
    browserName: 'chromium',
    baseURL: 'http://localhost:4173/',
    locale: 'sv-SE',
    // Keep a trace of failures (uploaded with the CI "reports" artifact) to debug runner-only flakes.
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'vite preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
  },
});
