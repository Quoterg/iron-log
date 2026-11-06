import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

async function addIngredient(page: Page, query: string, result: RegExp, unit: string, amount: string) {
  await page.getByRole('button', { name: /Lägg till ingrediens/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result', { hasText: result }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption(unit);
  await page.getByLabel('Mängd', { exact: true }).fill(amount);
  await page.getByRole('button', { name: 'Lägg till i receptet' }).click();
}

async function logFood(page: Page, mealIndex: number, query: string, grams: string) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result').first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd').fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
}

test('a logged recipe splits into its ingredients for this meal only (M50); the recipe stays', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  // 100 g oats + 4 dl milk, weighed 400 g cooked, 2 portions: 311 kcal per 200 g portion.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.locator('.settings-menu .entry', { hasText: 'Mina livsmedel, recept & måltider' }).click();
  await page.getByRole('button', { name: '+ Skapa recept' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Gröt');
  await page.getByLabel('Antal portioner').fill('2');
  await addIngredient(page, 'havregryn', /^Havregryn fullkorn/, 'g', '100');
  await addIngredient(page, 'mjölk', /^Mjölk fett 3%/, 'dl', '4');
  const cooked = page.getByLabel(/Vikt efter tillagning/);
  await cooked.fill('400');
  await cooked.blur();
  await page.getByRole('button', { name: 'Spara', exact: true }).click();

  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('gröt');
  await page.locator('.result', { hasText: 'Recept' }).first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Gröt.*311 kcal/);

  await meal(page, 0).locator('.entry').click();
  await page.getByRole('button', { name: 'Dela upp i ingredienser' }).click();
  // Half of the dish: 50 g oats and 2 dl milk, the same energy.
  const rows = meal(page, 0).locator('.entry');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: /Havregryn/ })).toContainText('50 g');
  await expect(rows.filter({ hasText: /Mjölk/ })).toContainText('2 dl');
  await expect(meal(page, 0).locator('.meal-title')).toContainText('311 kcal');
  // Kept after a reload; the recipe is unchanged (still two ingredients, still in search).
  await page.reload();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(2);
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('gröt');
  await expect(page.locator('.result', { hasText: 'Recept' }).first()).toContainText('Gröt');
});

test('part of a saved meal can be logged (M50): all ticked, untick what isn\'t eaten', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  await logFood(page, 0, 'havregryn', '60');
  await logFood(page, 0, 'mjölk', '200');
  await meal(page, 0).getByRole('button', { name: /^Fler val för/ }).click();
  await meal(page, 0).getByRole('button', { name: 'Spara som måltid' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Min frukost');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();

  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: 'Välj delar' }).click();
  const add = page.getByRole('button', { name: 'Lägg till 2 av 2' });
  await expect(add).toBeVisible();
  await page.getByRole('checkbox', { name: /Mjölk/ }).uncheck();
  await page.getByRole('button', { name: 'Lägg till 1 av 2' }).click();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(1);
  await expect(meal(page, 1).locator('.entry')).toContainText(/Havregryn.*60 g/);
});
