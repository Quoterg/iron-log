import { expect, test } from '@playwright/test';

// Runs against the production build (`pnpm build` first) on an emulated Moto G4
// with a 4× CPU slowdown, to keep us honest about old phones.
test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

test('log a food, see totals, survive reload and offline', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Idag' })).toBeVisible();

  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  const first = page.locator('.result').first();
  await expect(first).toContainText(/havregryn/i);
  await first.click();

  await page.getByRole('button', { name: '50 g', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();

  const entry = page.locator('.entry').first();
  await expect(entry).toContainText(/havregryn/i);
  await expect(entry).toContainText('50 g');
  await expect(page.locator('.summary')).not.toContainText('0 / 2');

  await page.getByRole('button', { name: 'Näringsämnen' }).click();
  await expect(page.getByText('Järn')).toBeVisible();

  // Persisted in IndexedDB.
  await page.reload();
  await expect(page.locator('.entry').first()).toContainText(/havregryn/i);

  // Works offline once the service worker has cached the app.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.entry').first()).toContainText(/havregryn/i);
  await page.locator('.meal').nth(1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('ägg');
  await expect(page.locator('.result').first()).toContainText(/ägg/i);
});

test('search stays fast on a throttled CPU', async ({ page }) => {
  await page.goto('./');
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  const input = page.getByPlaceholder(/Sök livsmedel/);
  await input.fill('mjölk'); // first search also waits for the database to load
  await expect(page.locator('.result').first()).toBeVisible();

  const t0 = Date.now();
  await input.fill('kyckling');
  await expect(page.locator('.result').first()).toContainText(/kyckling/i);
  const ms = Date.now() - t0;
  console.log(`search round-trip on 4× throttled CPU: ${ms} ms`);
  expect(ms).toBeLessThan(600);
});
