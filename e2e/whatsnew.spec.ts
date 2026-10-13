import { expect, test } from '@playwright/test';

// M32: what's new appears once after an update (a new version), never on a fresh install.
test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const KEY = 'iron-log-seen-version';

test("what's new: not on a fresh install; once after an update; again from Settings", async ({ page }) => {
  test.slow();
  const news = page.getByRole('dialog', { name: 'Nyheter' });
  await page.goto('./');
  await expect(page.locator('.meal').first()).toBeVisible();
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('1.3.0');
  await expect(news).toHaveCount(0);

  // An update from 1.2.0: only what's new since then, once.
  await page.evaluate((k) => localStorage.setItem(k, '1.2.0'), KEY);
  await page.reload();
  await expect(news.getByRole('heading', { name: 'Nytt i 1.3.0' })).toBeVisible();
  await expect(news.getByRole('heading', { name: 'Nytt i 1.2.0' })).toHaveCount(0);
  await expect(news).toContainText('senaste 7 dagarna');
  await news.getByRole('button', { name: 'Okej' }).click();
  await expect(news).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await page.waitForTimeout(500); // the check runs after the diary is shown
  await expect(news).toHaveCount(0);

  // Settings shows the version and opens the news again (latest releases).
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByText('Iron Log 1.3.0')).toBeVisible();
  await page.getByRole('button', { name: 'Nyheter' }).click();
  await expect(news.getByRole('heading', { name: 'Nytt i 1.2.0' })).toBeVisible();
  await page.goBack();
  await expect(news).toHaveCount(0);
});

test("users from before the changelog (with data) see everything since the first APK release", async ({ page }) => {
  test.slow();
  await page.goto('./');
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.locator('.meal').first().locator('.entry')).toHaveCount(1);
  await page.evaluate((k) => localStorage.removeItem(k), KEY);
  await page.reload();
  const news = page.getByRole('dialog', { name: 'Nyheter' });
  await expect(news.getByRole('heading', { name: 'Nytt i 1.3.0' })).toBeVisible();
  await expect(news.getByRole('heading', { name: 'Nytt i 1.2.0' })).toBeVisible();
  // Back (Android back button) closes it like any sheet.
  await page.goBack();
  await expect(news).toHaveCount(0);
  await expect(page.locator('.meal').first().locator('.entry')).toHaveCount(1);
});
