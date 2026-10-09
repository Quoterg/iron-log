import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

test('log in household measures and define your own', async ({ page }) => {
  await page.goto('./');

  // Eggs default to pieces: 2 st ≈ 110 g.
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('ägg kokt');
  await page.locator('.result', { hasText: /^Ägg kokt/ }).first().click();
  await expect(page.getByLabel('Mått', { exact: true })).toHaveValue('st');
  await page.getByRole('button', { name: '2 st', exact: true }).click();
  await expect(page.locator('.preview')).toContainText('≈ 110 g');
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Ägg kokt.*2 st/);

  // A custom measure on oats: "min skål" = 80 g.
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result', { hasText: /Havregryn/ }).first().click();
  await page.getByRole('button', { name: '+ Eget mått' }).click();
  await page.getByLabel('Namn på måttet').fill('min skål');
  await page.getByLabel('Vikt (g)').fill('80');
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(page.getByLabel('Mått', { exact: true })).toHaveValue('min skål');
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry').nth(1)).toContainText(/Havregryn.*1 min skål/);

  // Next time, the same measure is suggested; and it survives a reload.
  // (Wait until the sheets have closed: reloading mid history-navigation aborts the reload.)
  await expect(page.getByRole('button', { name: 'Idag' })).toBeVisible();
  await page.reload();
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.locator('.result', { hasText: /Havregryn/ }).first().click();
  await expect(page.getByLabel('Mått', { exact: true })).toHaveValue('min skål');
  await expect(page.getByLabel('Mängd')).toHaveValue('1');
});

test('swapping the food of an entry keeps the grams and drops the measure', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('ägg kokt');
  await page.locator('.result', { hasText: /^Ägg kokt/ }).first().click();
  await page.getByRole('button', { name: '2 st', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();

  await meal(page, 0).locator('.entry').click();
  await page.getByRole('button', { name: 'Byt livsmedel' }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('banan');
  await page.locator('.result', { hasText: /^Banan\d/ }).first().click();
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Banan.*110 g/);
});
