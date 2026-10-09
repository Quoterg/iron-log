import { expect, test } from '@playwright/test';

test('privacy policy and about page are reachable from Settings and work on a 360 px phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();

  await page.getByRole('link', { name: 'Integritet' }).click();
  await expect(page.getByRole('heading', { name: 'Iron Log – integritet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Iron Log – privacy' })).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.goto('./about.html');
  await expect(page.getByRole('heading', { name: 'Iron Log', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.getByRole('link', { name: 'Öppna Iron Log' }).click();
  await expect(page.getByRole('button', { name: 'Inställningar', exact: true })).toBeVisible();
});
