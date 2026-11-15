import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const bar = (page: Page, name: string) => page.locator('.bar', { has: page.getByText(name, { exact: true }) });

async function logFood(page: Page, query: string, result: RegExp, grams: string) {
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result', { hasText: result }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd').fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
}

test('food-based goals (M52): fruit & vegetables from whole foods and dishes, wholegrain, against their targets', async ({ page }) => {
  await page.goto('./');
  // A banana (100 % counts) and a pizza with mushrooms, onion and tomato (23 % counts): 120 + 46 g.
  await logFood(page, 'banan', /^Banan\d/, '120');
  await logFood(page, 'pizza skinka champinjoner', /^Pizza m. skinka champinjoner lök sardeller/, '200');
  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
  // Both food-based goals in "Kostmönster" (M52a); wholegrain's target scales with energy (2000 kcal: 75 g).
  await page.locator('.group summary', { hasText: 'Kostmönster' }).click();
  await expect(bar(page, 'Frukt, grönsaker & bär')).toContainText('166 / 500 g');
  await expect(bar(page, 'Fullkorn')).toContainText('/ 75 g');

  // What counts is explained on its own screen, with the foods that gave it.
  await bar(page, 'Frukt, grönsaker & bär').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/minst 500 g om dagen/)).toBeVisible();
  await expect(dialog.locator('.contrib').first()).toContainText('Banan');
});
