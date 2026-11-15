import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

async function logOats(page: Page) {
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.getByRole('dialog').locator('.result', { hasText: 'Havregryn fullkorn' }).first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('a calm nutrients tab (M66): today counts what is reached, a past day what is short; terms explained in place', async ({ page }) => {
  await page.goto('./');
  await logOats(page);

  // E% is explained by tapping the macro tiles.
  await expect(page.getByText(/E% \(energiprocent\)/)).toHaveCount(0);
  await page.locator('.summary .macros').click();
  await expect(page.getByText(/E% \(energiprocent\): hur stor del av dagens energi/)).toBeVisible();
  await expect(page.locator('.summary .macros')).toHaveAttribute('aria-expanded', 'true');

  // Today: "n av m nådda", never "under målet".
  await tab(page, 'Näringsämnen');
  const vitamins = page.locator('.group summary', { hasText: 'Vitaminer' });
  await expect(vitamins).toContainText(/\d+ av \d+ nådda/);
  await expect(page.getByText(/under målet/)).toHaveCount(0);
  // Kostmönster says what it is when opened.
  await page.locator('.group summary', { hasText: 'Kostmönster' }).click();
  await expect(page.getByText(/Livsmedel som de nordiska näringsrekommendationerna \(NNR 2023\) anger/)).toBeVisible();

  // The same food on a finished day: how many are short.
  await tab(page, 'Dagbok');
  await page.getByRole('button', { name: 'Föregående dag' }).click();
  await logOats(page);
  await tab(page, 'Näringsämnen');
  await expect(page.locator('.group summary', { hasText: 'Vitaminer' })).toContainText(/\d+ under målet/);
});
