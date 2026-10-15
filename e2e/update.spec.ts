import { expect, test } from '@playwright/test';

// M39: pages start from the cache; a new version is fetched in the background and offered as a
// restart. (Routes see the service worker's fetches: playwright.config.ts.)
test('a new version arrives in the background: the start uses the cache, then offers a restart', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  await page.reload(); // the page is now in the cache
  await expect(page.locator('.meal').first()).toBeVisible();
  const bar = page.getByRole('status').filter({ hasText: 'Det finns en ny version av appen.' });
  await expect(bar).toHaveCount(0); // nothing new

  // A new deploy: the page from the network differs from the cached one.
  await page.context().route((u) => u.pathname === '/', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace('</body>', '<!-- v2 --></body>') });
  });
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible(); // started from the cache
  expect(await page.content()).not.toContain('<!-- v2 -->');
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'Starta om' }).click();
  await expect(page.locator('.meal').first()).toBeVisible();
  expect(await page.content()).toContain('<!-- v2 -->');
  await expect(bar).toHaveCount(0); // same version as the network now
});

test('offline after the first visit: the app still starts', async ({ page, context }) => {
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 });
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await context.setOffline(false);
});
