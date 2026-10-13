import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// M32: what's new appears once after an update (a new version), never on a fresh install.
// Versions come from package.json and the changelog, so a release doesn't need a test edit.
test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const KEY = 'iron-log-seen-version';
const V = JSON.parse(readFileSync('package.json', 'utf8')).version as string;
const RELEASED = [...readFileSync('src/changelog.ts', 'utf8').matchAll(/version: '([\d.]+)'/g)].map((m) => m[1]); // newest first
const PREV = RELEASED[1];
const OLDER = RELEASED[2];

test("what's new: not on a fresh install; once after an update; again from Settings", async ({ page }) => {
  test.slow();
  expect(RELEASED[0]).toBe(V);
  const news = page.getByRole('dialog', { name: 'Nyheter' });
  await page.goto('./');
  await expect(page.locator('.meal').first()).toBeVisible();
  await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(V);
  await expect(news).toHaveCount(0);

  // An update from the previous release: only what's new since then, once.
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, PREV]);
  await page.reload();
  await expect(news.getByRole('heading', { name: `Nytt i ${V}` })).toBeVisible();
  await expect(news.getByRole('heading', { name: `Nytt i ${PREV}` })).toHaveCount(0);
  await news.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(news).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await page.waitForTimeout(500); // the check runs after the diary is shown
  await expect(news).toHaveCount(0);

  // Settings shows the version and opens the news again (latest releases).
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByText(`Iron Log ${V}`)).toBeVisible();
  await page.getByRole('button', { name: 'Nyheter' }).click();
  await expect(news.getByRole('heading', { name: `Nytt i ${PREV}` })).toBeVisible();
  await page.goBack();
  await expect(news).toHaveCount(0);
});

test('users from before the changelog (with data) see everything since the first APK release', async ({ page }) => {
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
  await expect(news.getByRole('heading', { name: `Nytt i ${V}` })).toBeVisible();
  await expect(news.getByRole('heading', { name: `Nytt i ${OLDER}` })).toBeVisible();
  // Back (Android back button) closes it like any sheet.
  await page.goBack();
  await expect(news).toHaveCount(0);
  await expect(page.locator('.meal').first().locator('.entry')).toHaveCount(1);
});
