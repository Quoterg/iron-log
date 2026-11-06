import { expect, test, type Page } from '@playwright/test';

const card = (page: Page) => page.locator('section.card', { has: page.getByRole('heading', { name: 'Kosttillskott', exact: true }) });

test('a supplement scheduled for other weekdays stays off today’s checklist; time of day is shown', async ({ page }) => {
  await page.goto('./');
  // Today's short weekday name as the editor shows it (Swedish UI).
  const today = await page.evaluate(() => new Date().toLocaleDateString('sv-SE', { weekday: 'short' }));

  await page.getByRole('button', { name: '+ Kosttillskott' }).click(); // a card once one exists (M42)
  await page.getByLabel('Namn', { exact: true }).fill('Järntablett');
  await page.getByRole('button', { name: today, exact: true }).click(); // today off
  await expect(page.getByRole('button', { name: today, exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.getByLabel('Tid på dagen').selectOption('evening');
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(card(page)).not.toContainText('Järntablett');

  // Back on for today: shown, with its time.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.locator('.settings-menu .entry', { hasText: 'Mina livsmedel, recept & måltider' }).click();
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

test('a winter supplement (M51) rests in summer and is on the checklist October–March', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-06-15T09:00:00'));
  await page.goto('./');
  await page.getByRole('button', { name: '+ Kosttillskott' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('D-vitamin');
  await page.getByLabel('Vinterhalvåret (okt–mar)').check();
  await page.getByRole('button', { name: 'Spara' }).click();
  // June: not on the checklist, and the card says why.
  await expect(card(page)).not.toContainText('D-vitamin');
  await expect(card(page)).toContainText('1 vintertillskott tillbaka i oktober.');

  // November: on the checklist again, nothing deleted.
  await page.clock.setFixedTime(new Date('2026-11-16T09:00:00'));
  await page.reload();
  await expect(card(page)).toContainText('D-vitamin');
  await expect(card(page)).not.toContainText('tillbaka i oktober');
  await card(page).getByRole('button', { name: /D-vitamin/ }).click();
  await expect(page.getByLabel('Vinterhalvåret (okt–mar)')).toBeChecked();
});
