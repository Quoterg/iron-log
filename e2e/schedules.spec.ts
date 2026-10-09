import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'Kosttillskott', exact: true }) });

test('a supplement scheduled for other weekdays stays off today’s checklist; time of day is shown', async ({ page }) => {
  await page.goto('./');
  // Today's short weekday name as the editor shows it (Swedish UI).
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE', { weekday: 'short' }));

  await card(page).getByRole('button', { name: '+ Lägg till', exact: true }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Järntablett');
  await page.getByRole('button', { name: today, exact: true }).click(); // today off
  await expect(page.getByRole('button', { name: today, exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Tid på dagen').selectOption('evening');
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(card(page)).not.toContainText('Järntablett');

  // Back on for today: shown, with its time.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: /Järntablett/ }).click();
  await page.getByRole('button', { name: today, exact: true }).click();
  await page.getByRole('button', { name: 'Spara' }).click();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await expect(card(page)).toContainText('Järntablett');
  await expect(card(page)).toContainText('Kväll');

  // The day selection survives switching to "as needed" and back.
  await card(page).getByRole('button', { name: /Järntablett/ }).click();
  await page.getByRole('button', { name: today, exact: true }).click(); // today off again
  await page.getByLabel('Antal per dag', { exact: true }).fill('0');
  await page.getByLabel('Antal per dag', { exact: true }).fill('1');
  await expect(page.getByRole('button', { name: today, exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: today, exact: true }).click(); // and back on
  await page.getByRole('button', { name: 'Spara' }).click();

  // No days at all is refused.
  await card(page).getByRole('button', { name: /Järntablett/ }).click();
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const name = await page.evaluate((i) => new Date(2024, 0, 1 + i).toLocaleDateString('sv-SE', { weekday: 'short' }), d);
    await page.getByRole('button', { name, exact: true }).click();
  }
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(page.getByText('Välj minst en dag.')).toBeVisible();
});
