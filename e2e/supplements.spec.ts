import { expect, test, type Page } from '@playwright/test';

const card = (page: Page, title: string) => page.locator('section.card', { has: page.getByRole('heading', { name: title, exact: true }) });

test('create a daily supplement, tick it off, and see it in the nutrient totals', async ({ page }) => {
  await page.goto('./');
  const supps = card(page, 'Kosttillskott');
  await supps.getByRole('button', { name: '+ Lägg till', exact: true }).click();

  // Amounts per unit, as on the label.
  await page.getByLabel('Namn', { exact: true }).fill('D-vitamin');
  await expect(page.getByLabel('Enhet', { exact: true })).toHaveValue('tablett');
  await page.getByLabel('Antal per dag', { exact: true }).fill('2');
  await page.getByLabel('Vitamin D (µg)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Spara' }).click();

  await expect(supps).toContainText('D-vitamin');
  await expect(supps).toContainText('2 tablett/dag');

  // One tap logs the daily dose; it is shown in the card, not under a meal.
  const check = supps.getByRole('checkbox', { name: 'Tagen: D-vitamin' });
  await check.check();
  await expect(check).toBeChecked();
  await expect(supps.locator('.entry')).toContainText('2 tablett');
  await expect(page.locator('.meal .entry')).toHaveCount(0);

  // 2 tablets × 10 µg = 20 µg vitamin D.
  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
  const vitD = page.locator('.bar').filter({ has: page.getByText('Vitamin D', { exact: true }) });
  await expect(vitD).toContainText(/^Vitamin D20 /);

  // Persisted; unticking removes the dose again.
  await page.reload();
  await expect(check).toBeChecked();
  await check.uncheck();
  await expect(check).not.toBeChecked();
  await page.reload();
  await expect(check).not.toBeChecked();

  // Found in search with its badge.
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('D-vitamin');
  await expect(page.locator('.badge', { hasText: 'Tillskott' })).toBeVisible();
});
