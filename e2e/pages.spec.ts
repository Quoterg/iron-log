import { expect, test } from '@playwright/test';

test('privacy policy and about page are reachable from Settings and work on a 360 px phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();

  await page.getByRole('link', { name: 'Integritet' }).click();
  await expect(page.getByRole('heading', { name: 'Iron Log – integritet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kameran' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Iron Log – privacy' })).toBeAttached();
  // Its own page, not the app shell.
  await expect(page.locator('#app')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.goto('./about.html');
  await expect(page.getByRole('heading', { name: 'Iron Log', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('link', { name: 'Öppna Iron Log' }).click();
  await expect(page.getByRole('button', { name: 'Inställningar', exact: true })).toBeVisible();
});

test('English UI links to the English sections', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Språk').selectOption('en');
  await expect(page.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'privacy.html#en');
  await expect(page.getByRole('link', { name: 'About Iron Log' })).toHaveAttribute('href', 'about.html#en');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Iron Log – privacy' })).toBeInViewport();
});

test('the pages open offline on first use (precached by the service worker)', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto('./privacy.html');
  await expect(page.getByRole('heading', { name: 'Iron Log – integritet' })).toBeVisible();
  await page.goto('./about.html');
  await expect(page.getByRole('heading', { name: 'Iron Log', level: 1 })).toBeVisible();
});
