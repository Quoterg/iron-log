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
  for (const m of ['il:start', 'il:settings', 'il:lang', 'il:library']) results[`cold_${m.slice(3)}`] = Math.round(await mark(page, m));
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

test('Näringsämnen right after start (a lazy screen)', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await mark(page, 'il:day');
  const t0 = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 dagar' })).toBeVisible({ timeout: 10_000 });
  results.nutrientsTab = Math.round((await page.evaluate(() => performance.now())) - t0);
  expect(results.nutrientsTab).toBeLessThan(5000);
});

test('warm start with a logged day (names need the food data)', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE'));
  // Five everyday foods today: oats, milk, banana, chicken, rice.
  const entries = ['slv:702', 'slv:150', 'slv:625', 'slv:1325', 'slv:2515'].map((foodRef, i) => ({
    id: `e${i}`, date: today, meal: i < 3 ? 'breakfast' : 'dinner', foodRef, grams: 100, createdAt: 1000 + i,
  }));
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const loaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await loaded;
  await expect(page.locator('.meal .entry')).toHaveCount(5);
  await page.waitForTimeout(1500);
  await page.reload();
  results.loggedDay = Math.round(await mark(page, 'il:day'));
  // Until every entry shows its name (not "…").
  await expect(page.locator('.meal .entry-name', { hasText: '…' })).toHaveCount(0);
  results.loggedNamed = Math.round(await page.evaluate(() => performance.now()));
});

test('search right after start (before the background warm-up)', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(() => {});
  await page.reload(); // a normal (cached) start
  await mark(page, 'il:render');
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  const t0 = await page.evaluate(() => performance.now());
  await page.getByPlaceholder(/Sök livsmedel/).fill('mjölk');
  await expect(page.locator('.result').first()).toBeVisible({ timeout: 20_000 });
  results.searchAtStart = Math.round((await page.evaluate(() => performance.now())) - t0);
});
