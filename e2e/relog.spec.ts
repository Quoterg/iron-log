import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const searchBox = (page: Page) => page.getByPlaceholder(/Sök livsmedel/);

async function logFood(page: Page, mealIndex: number, query: string, grams: string) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await searchBox(page).fill(query);
  await page.locator('.result').first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd').fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
}

test('recent foods, last amount, favourites and copying a meal', async ({ page }) => {
  await page.goto('./');

  // "ris" ranks cooked rice first.
  await meal(page, 2).getByRole('button', { name: /Lägg till/ }).click();
  await searchBox(page).fill('ris');
  await expect(page.locator('.result').first()).toContainText(/kokt/);
  await page.goBack();

  await logFood(page, 0, 'havregryn', '60');

  // Before typing, the search shows the food under "Senaste", and reuses the last amount.
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await expect(page.getByRole('heading', { name: 'Senaste' })).toBeVisible();
  await page.locator('.result', { hasText: /Havregryn/ }).click();
  await expect(page.getByLabel('Mängd')).toHaveValue('60');

  // Mark as favourite → listed under "Favoriter".
  await page.getByRole('button', { name: /Favorit/ }).click();
  await expect(page.getByRole('button', { name: '★ Favorit' })).toBeVisible();
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(page.getByRole('heading', { name: 'Favoriter' })).toBeVisible();
  await expect(page.locator('.result').first()).toContainText(/Havregryn/);
  await page.goBack();

  // Copy breakfast to tomorrow's lunch; the app then shows tomorrow.
  await meal(page, 0).getByRole('button', { name: 'Kopiera måltid' }).click();
  await page.getByLabel('Till måltid').selectOption('lunch');
  await page.getByRole('button', { name: 'Kopiera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Imorgon' })).toBeVisible();
  await expect(meal(page, 1).locator('.entry')).toContainText(/Havregryn.*60 g/);
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);
});
