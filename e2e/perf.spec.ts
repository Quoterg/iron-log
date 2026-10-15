import { writeFileSync, mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

// M39 Snabbare: start and search timings on the emulated Moto G4 (CPU ×4). Recorded to
// test-results/perf.json for before/after comparisons; the ceilings are generous and only catch
// large regressions (CI machines vary).
const results: Record<string, number> = {};

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

test.afterAll(() => {
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/perf.json', JSON.stringify(results, null, 2));
  console.log('perf', JSON.stringify(results));
});

/** Milliseconds from navigation start to a mark set by main.tsx. */
const mark = (page: Page, name: string) =>
  page.waitForFunction((n) => performance.getEntriesByName(n)[0]?.startTime, name).then((h) => h.jsonValue() as Promise<number>);

test('start: cold, and warm on a slow connection', async ({ page }) => {
  test.slow();
  await page.goto('./');
  results.coldRender = Math.round(await mark(page, 'il:render'));
  results.coldDay = Math.round(await mark(page, 'il:day'));
  // The service worker is in control from the second load on.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(() => {});
  await page.reload();
  await mark(page, 'il:day');
  results.warmDay = Math.round(await mark(page, 'il:day'));
  // A poor mobile connection (in a shop, on the bus): the app page takes 2 s to arrive. The start
  // shouldn't wait for it. (CDP network throttling doesn't reach the service worker's own fetches;
  // a context route does.)
  await page.context().route((url) => url.pathname === '/' || url.pathname.endsWith('/index.html'), async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.reload();
  results.slowNetDay = Math.round(await mark(page, 'il:day'));
  await page.context().unrouteAll();
  expect(results.coldDay).toBeLessThan(6000);
});

test('first search after start', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await mark(page, 'il:day');
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  const t0 = await page.evaluate(() => performance.now());
  await page.getByPlaceholder(/Sök livsmedel/).fill('mjölk');
  await expect(page.locator('.result').first()).toBeVisible({ timeout: 20_000 });
  results.firstSearch = Math.round((await page.evaluate(() => performance.now())) - t0);
  expect(results.firstSearch).toBeLessThan(10_000);
});
