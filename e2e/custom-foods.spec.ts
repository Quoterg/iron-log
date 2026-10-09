import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

test('create a custom food, log it, edit the entry and the food, then delete the food', async ({ page }) => {
  await page.goto('./');

  // Create from search, with the query as the name; kcal left empty → estimated from macros.
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('Mitt proteinpulver');
  await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
  await expect(page.getByLabel('Namn')).toHaveValue('Mitt proteinpulver');
  await page.getByLabel('Protein (g)', { exact: true }).fill('75');
  await page.getByLabel('Kolhydrater (g)', { exact: true }).fill('8');
  await page.getByLabel('Fett (g)', { exact: true }).fill('6');
  await page.getByRole('button', { name: 'Spara' }).click();

  // Continues to the amount: 75*4 + 8*4 + 6*9 = 386 kcal/100 g → 30 g = 116 kcal.
  await expect(page.getByRole('heading', { name: /Mitt proteinpulver/ })).toBeVisible();
  await page.getByLabel('Mängd').fill('30');
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  const entry = meal(page, 0).locator('.entry').first();
  await expect(entry).toContainText('Mitt proteinpulver');
  await expect(entry).toContainText('116 kcal');

  // Move the entry to lunch.
  await entry.click();
  await page.getByLabel('Måltid').selectOption('lunch');
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(meal(page, 1).locator('.entry')).toContainText('Mitt proteinpulver');
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);

  // Edit the food itself: 400 kcal/100 g → the logged 30 g shows 120 kcal.
  await meal(page, 1).locator('.entry').click();
  await page.getByRole('button', { name: 'Redigera livsmedel' }).click();
  await page.getByLabel('Energi (kcal)', { exact: true }).fill('400');
  await page.getByRole('button', { name: 'Spara' }).click();
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(meal(page, 1).locator('.entry')).toContainText('120 kcal');

  // Custom foods are searchable and marked.
  await meal(page, 2).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('proteinpulver');
  await expect(page.locator('.result').first()).toContainText('Mitt proteinpulver');
  await expect(page.locator('.result').first()).toContainText('Eget');

  // The phone's back button closes the sheet instead of leaving the app.
  await page.goBack();
  await expect(page.getByPlaceholder(/Sök livsmedel/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Idag' })).toBeVisible();

  // Delete from Settings → gone from search, but the diary entry still shows it.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Mitt proteinpulver/ }).click();
  await page.getByRole('button', { name: 'Ta bort' }).click();
  await expect(page.getByText(/inga egna livsmedel/)).toBeVisible();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await expect(meal(page, 1).locator('.entry')).toContainText('Mitt proteinpulver');
  await page.reload();
  await expect(meal(page, 1).locator('.entry')).toContainText('Mitt proteinpulver');
  await meal(page, 2).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('mitt proteinpulver');
  await expect(page.getByText('Inga träffar')).toBeVisible();
});

test('going back from a food keeps the search; unknown nutrients show as –', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  const search = page.getByPlaceholder(/Sök livsmedel/);
  await search.fill('banan');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(search).toHaveValue('banan');
  await expect(page.locator('.result').first()).toContainText(/banan/i);

  // A custom food with only macros: micronutrients are unknown, not 0.
  await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
  await page.getByLabel('Namn').fill('Bara makron');
  await page.getByLabel('Protein (g)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(page.locator('.bar', { hasText: 'Järn' })).toContainText('– mg');
});

test('food detail shows all nutrients for the chosen amount and the data source', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: '50 g', exact: true }).click();
  await expect(page.getByText(/Näringsvärden för vald mängd \(50 g\)/)).toBeVisible();
  await expect(page.getByText('Järn')).toBeVisible();
  await expect(page.getByText(/Livsmedelsverkets livsmedelsdatabas/)).toBeVisible();
});
