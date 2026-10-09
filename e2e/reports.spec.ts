import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

async function logGrams(page: Page, query: string, result: RegExp, grams: string) {
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result', { hasText: result }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd', { exact: true }).fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.getByRole('button', { name: /Idag|Igår|\d/ }).first()).toBeVisible();
}

test('7-day averages, gaps, top sources and streak', async ({ page }) => {
  await page.goto('./');
  // Yesterday: oats; today: oats + bread.
  await page.getByRole('button', { name: 'Föregående dag' }).click();
  await logGrams(page, 'havregryn', /^Havregryn fullkorn/, '100');
  await page.getByRole('button', { name: 'Nästa dag' }).click();
  await logGrams(page, 'havregryn', /^Havregryn fullkorn/, '100');
  await logGrams(page, 'rågsikt', /^Bröd rågsikt fibrer ca 4%/, '80');

  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
  await expect(page.getByText('Du har loggat 2 dagar i rad.')).toBeVisible();

  // 7 days: average over the 2 logged days (not 7).
  await page.getByRole('button', { name: '7 dagar' }).click();
  await expect(page.getByText(/2 av 7 dagar har registreringar/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Att tänka på' })).toBeVisible();
  await expect(page.locator('.card', { hasText: 'Att tänka på' })).toContainText(/Under 70 % av målet.*Vitamin C/);

  // Tap a nutrient: its top sources over the period.
  await page.locator('.bar-btn', { hasText: 'Fibrer' }).click();
  await expect(page.getByRole('heading', { name: 'Största källor: Fibrer' })).toBeVisible();
  const rows = page.locator('.contrib');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('Havregryn fullkorn'); // 20 g fibre from 200 g oats
});
