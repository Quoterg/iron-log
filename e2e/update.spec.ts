import { expect, test, type Page } from '@playwright/test';

// M39: the app page starts from the cache; a new version is fetched in the background, stored only
// with its whole asset set, and offered as a restart. (Routes see the service worker's fetches:
// playwright.config.ts.)
const isAppPage = (u: URL) => u.pathname === '/';
const bar = (page: Page) => page.getByRole('status').filter({ hasText: 'Det finns en ny version av appen.' });

async function cachedStart(page: Page) {
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  // The page and its whole asset set are cached in the background after the first visit.
  await expect
    .poll(() => page.evaluate(async () => !!(await (await caches.open('iron-log-v2')).match(new URL('./', location.href).href))), { timeout: 20_000 })
    .toBe(true);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
}

test('a new version arrives in the background: the start uses the cache, then offers a restart', async ({ page }) => {
  test.slow();
  await cachedStart(page);
  await expect(bar(page)).toHaveCount(0); // nothing new

  await page.context().route(isAppPage, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace('</body>', '<!-- v2 --></body>') });
  });
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible(); // started from the cache
  await expect.poll(() => page.content()).not.toContain('<!-- v2 -->');
  await expect(bar(page)).toBeVisible();
  await bar(page).getByRole('button', { name: 'Starta om' }).click();
  await expect(page.locator('.meal').first()).toBeVisible();
  await expect.poll(() => page.content()).toContain('<!-- v2 -->');
  await expect(bar(page)).toHaveCount(0); // the same version as the network now
});

test('a new version with new code: stored only with its files, so it starts offline', async ({ page, context }) => {
  test.slow();
  await cachedStart(page);
  // v2 loads its code from a file name this phone has never fetched.
  const html = await (await page.request.get('/')).text();
  const entry = html.match(/assets\/(index-[^"]+\.js)/)![1];
  const js = await (await page.request.get(`/assets/${entry}`)).body();
  const v2 = html.replaceAll(entry, 'index-v2test.js');
  await context.route(isAppPage, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: v2 }));
  await context.route('**/assets/index-v2test.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: js }));
  await page.reload();
  await expect(bar(page)).toBeVisible(); // v2 and its files are in the cache now
  await context.unrouteAll();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible(); // v2, offline: its code came with it
  expect(await page.evaluate(() => [...document.scripts].some((s) => s.src.includes('index-v2test.js')))).toBe(true);
  await context.setOffline(false);
});

test('a Wi-Fi login page never replaces the app', async ({ page, context }) => {
  test.slow();
  await cachedStart(page);
  await context.route(isAppPage, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>Logga in på wifi</body></html>' }));
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(bar(page)).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible(); // still the app
  await context.unrouteAll();
});

test('a screen whose code is gone from the server: the app reloads once instead of a dead screen', async ({ page, context }) => {
  test.slow();
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  await page.reload();
  await page.waitForTimeout(1500);
  // A new deploy replaced the running version's files: the food screen's code isn't cached, and the
  // server no longer has it.
  // (The route first: the background screen loading mustn't fetch it again in between.)
  await context.route('**/assets/FoodDetail-*.js', (route) => route.fulfill({ status: 404, body: '' }));
  await page.evaluate(async () => {
    const c = await caches.open('iron-log-v2');
    for (const r of await c.keys()) if (r.url.includes('/assets/FoodDetail-')) await c.delete(r);
  });
  await page.reload();
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  // One reload (marked for this session), back on the diary — not a screen that never opens.
  // (Read during the reload, the page may be between documents: retried.)
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('il-reloaded')).catch(() => null)).toBe('1');
  await expect(page.locator('.meal').first()).toBeVisible();
  // Only once: the next failure shows "couldn't load" with a retry instead of reloading again.
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await expect(page.getByRole('button', { name: 'Försök igen' })).toBeVisible();
  await context.unrouteAll();
});

test('offline after the first visit: the app still starts', async ({ page, context }) => {
  await cachedStart(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await context.setOffline(false);
});
