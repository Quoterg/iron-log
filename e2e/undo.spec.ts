import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

async function logFood(page: Page, mealIndex: number, query: string, name: string, grams: string) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.getByRole('dialog').locator('.result', { hasText: name }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd', { exact: true }).fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('a deleted entry can be brought back (M64), also a quick entry with its food; kept after a reload', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('no browser dialog expected');
  });
  await page.goto('./');
  await logFood(page, 0, 'havregryn', 'Havregryn fullkorn', '60');
  await meal(page, 0).locator('.entry', { hasText: 'Havregryn' }).click();
  await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);
  const toast = page.locator('.toast');
  await expect(toast).toHaveText(/Havregryn fullkorn togs bort/);
  await toast.getByRole('button', { name: 'Ångra' }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Havregryn fullkorn.*60 g/);
  await page.reload();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Havregryn fullkorn.*60 g/);

  // A quick entry's hidden food goes with its last entry (M47): undo brings both back.
  await meal(page, 2).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: '+ Snabblogga kcal' }).click();
  await page.getByLabel('Namn (valfritt)').fill('Pizza ute');
  await page.getByLabel('Energi (kcal)').fill('900');
  await page.getByRole('dialog').getByRole('button', { name: 'Snabblogga kcal' }).click();
  await meal(page, 2).locator('.entry', { hasText: 'Pizza ute' }).click();
  await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
  await expect(meal(page, 2).locator('.entry')).toHaveCount(0);
  await toast.getByRole('button', { name: 'Ångra' }).click();
  await expect(meal(page, 2).locator('.entry', { hasText: 'Pizza ute' })).toContainText('900 kcal');
  await page.reload();
  await expect(meal(page, 2).locator('.entry', { hasText: 'Pizza ute' })).toContainText('900 kcal');

  // The message goes by itself.
  await meal(page, 0).locator('.entry', { hasText: 'Havregryn' }).click();
  await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
  await expect(toast).toBeVisible();
  await expect(toast).toHaveCount(0, { timeout: 12_000 });
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);
});

test('logging a saved meal says what was added, with Undo (M64)', async ({ page }) => {
  await page.goto('./');
  await logFood(page, 0, 'havregryn', 'Havregryn fullkorn', '100');
  await logFood(page, 0, 'ägg', 'Ägg kokt', '50');
  await meal(page, 0).getByRole('button', { name: /^Fler val för/ }).click();
  await meal(page, 0).getByRole('button', { name: 'Spara som måltid' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Min frukost');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();

  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.locator('.result', { hasText: 'Min frukost' }).click();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(2);
  // 100 g oats 375 kcal + 50 g boiled egg ≈ 68 kcal.
  await expect(page.locator('.toast')).toHaveText(/Min frukost tillagd: 2 livsmedel, 4\d\d kcal/);
  await page.locator('.toast').getByRole('button', { name: 'Ångra' }).click();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(0);
  await expect(meal(page, 0).locator('.entry')).toHaveCount(2); // the breakfast it was saved from stays
});
