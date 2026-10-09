import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, title: string) => page.locator('section.card', { has: page.getByRole('heading', { name: title, exact: true }) });

test('log exercise and water; optionally add burned energy to the target', async ({ page }) => {
  await page.goto('./');
  // Weight in the profile for the estimate.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const w = page.getByLabel('Vikt (kg)', { exact: true });
  await w.fill('70');
  await w.blur();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();

  // Running 10 km/h for 30 min at 70 kg: (9.8 − 1) × 70 × 0.5 = 308 kcal.
  await card(page, 'Aktivitet').getByRole('button', { name: /Lägg till/ }).click();
  await page.getByLabel('Aktivitet', { exact: true }).selectOption('run10');
  await page.getByRole('button', { name: '30 min', exact: true }).click();
  await expect(page.locator('.preview')).toContainText('308 kcal');
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(card(page, 'Aktivitet')).toContainText(/Löpning, 10 km\/h.*30 min.*308 kcal/);
  await expect(page.locator('.summary')).toContainText('/ 2 000 kcal');

  // Water: +5 dl +2 dl −2 dl = 0,5 l.
  const water = card(page, 'Vatten');
  await water.getByRole('button', { name: '+5 dl' }).click();
  await water.getByRole('button', { name: '+2 dl' }).click();
  await water.getByRole('button', { name: '−2 dl' }).click();
  await expect(water).toContainText('0,5 l');

  // Add burned energy to the target.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel(/Lägg till förbränd energi/).check();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await expect(page.locator('.summary')).toContainText('/ 2 308 kcal');
  await expect(page.locator('.summary')).toContainText('Målet inkluderar 308 kcal från aktivitet.');

  // Persists; removing the activity takes it out of the target.
  await page.reload();
  await expect(water).toContainText('0,5 l');
  await card(page, 'Aktivitet').getByRole('button', { name: /Ta bort/ }).click();
  await expect(page.locator('.summary')).toContainText('/ 2 000 kcal');
});
