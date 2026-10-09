import { expect, test, type Page } from '@playwright/test';

const settingsTab = (page: Page) => page.getByRole('button', { name: /^(Inställningar|Settings)$/ }).click();
const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

test('Swedish default searches Livsmedelsverket; USDA can be added and stays resolvable', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('chicken breast');
  await expect(page.locator('.result', { hasText: 'USDA' })).toHaveCount(0);
  await page.goBack();

  // Turn USDA on: English-named foods appear with a badge.
  await settingsTab(page);
  await page.getByLabel(/USDA \(USA/).check();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('bananas raw');
  const hit = page.locator('.result', { hasText: 'Bananas, raw' }).first();
  await expect(hit).toContainText('USDA');
  await expect(hit).toContainText('89 kcal');
  await hit.click();
  await expect(page.getByText(/USDA FoodData Central/)).toBeVisible();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByRole('button', { name: '100 g', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Bananas, raw.*89 kcal/);

  // Turn USDA off again: the logged food still shows after a reload (loaded on demand).
  await settingsTab(page);
  await page.getByLabel(/USDA \(USA/).uncheck();
  await page.getByLabel(/Livsmedelsverket/).blur();
  await page.waitForFunction(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const get = db.transaction('kv').objectStore('kv').get('settings');
    const s = await new Promise<{ sources?: string[] }>((ok) => (get.onsuccess = () => ok(get.result)));
    db.close();
    return s?.sources?.join() === 'slv';
  });
  await page.reload();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Bananas, raw.*89 kcal/);
});

test('English users search both databases by default', async ({ page }) => {
  await page.goto('./');
  await settingsTab(page);
  await page.getByLabel('Språk').selectOption('en');
  await page.getByRole('button', { name: 'Diary', exact: true }).click();
  await meal(page, 0).getByRole('button', { name: /Add/ }).click();
  await page.getByPlaceholder(/Search foods/).fill('oats');
  await expect(page.locator('.result', { hasText: 'USDA' }).first()).toBeVisible();
});
