import { expect, test, type Page } from '@playwright/test';

const settingsTab = (page: Page) => page.getByRole('button', { name: 'Inställningar', exact: true }).click();
const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

async function addIngredient(page: Page, query: string, result: RegExp, unit: string, amount: string) {
  await page.getByRole('button', { name: /Lägg till ingrediens/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result', { hasText: result }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption(unit);
  await page.getByLabel('Mängd', { exact: true }).fill(amount);
  await page.getByRole('button', { name: 'Lägg till i receptet' }).click();
}

test('create a recipe, edit an ingredient, set cooked weight, and log a portion', async ({ page }) => {
  await page.goto('./');
  await settingsTab(page);
  await page.getByRole('button', { name: '+ Skapa recept' }).click();
  await page.getByLabel('Namn').fill('Gröt');
  const servings = page.getByLabel('Antal portioner');
  await servings.fill('2');
  await servings.blur();

  // 100 g oats (375 kcal/100 g) + 4 dl milk (4 × 103 g, 60 kcal/100 g) = 622 kcal, 512 g.
  await addIngredient(page, 'havregryn', /^Havregryn fullkorn/, 'g', '100');
  await addIngredient(page, 'mjölk', /^Mjölk fett 3%/, 'dl', '4');
  const rows = page.locator('.ingredient');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('4 dl');
  await expect(page.locator('.preview')).toContainText('311 kcal · 256 g');

  // Edit the milk to 3 dl → (375 + 185.4) / 2 = 280 kcal per portion.
  await rows.nth(1).locator('.entry').click();
  await expect(page.getByLabel('Mängd', { exact: true })).toHaveValue('4');
  await page.getByLabel('Mängd', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Lägg till i receptet' }).click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('3 dl');
  await expect(page.locator('.preview')).toContainText('280 kcal');

  // Cooked weight 400 g: same energy per portion, now 200 g each.
  const cooked = page.getByLabel(/Vikt efter tillagning/);
  await cooked.fill('400');
  await cooked.blur();
  await expect(page.locator('.preview')).toContainText('280 kcal · 200 g');

  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Gröt/ })).toContainText('280 kcal / portion');

  // Log one portion from the diary search.
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('gröt');
  await page.locator('.result', { hasText: 'Recept' }).first().click();
  await expect(page.getByLabel('Mått', { exact: true })).toHaveValue('portion');
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Gröt.*1 portion.*280 kcal/);

  // The recipe can be opened for editing from the logged entry.
  await meal(page, 0).locator('.entry').click();
  await page.getByRole('button', { name: 'Redigera recept' }).click();
  await expect(page.getByLabel('Namn')).toHaveValue('Gröt');
  await expect(page.locator('.ingredient')).toHaveCount(2);
});

test('a cancelled new recipe is discarded', async ({ page }) => {
  await page.goto('./');
  await settingsTab(page);
  await page.getByRole('button', { name: '+ Skapa recept' }).click();
  await page.getByLabel('Namn').fill('Halvfärdig');
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await page.getByRole('button', { name: '+ Skapa recept' }).click();
  await expect(page.getByLabel('Namn')).toHaveValue('');
  // Saving needs a name and an ingredient.
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByText('Ange ett namn.')).toBeVisible();
  await expect(page.getByText('Lägg till minst en ingrediens.')).toBeVisible();
});
