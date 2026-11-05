import { expect, test, type Page } from '@playwright/test';

// M34: food cost in the diary — per entry, per meal, per day; opt-in.
test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
async function logFood(page: Page, mealIndex: number, query: string, grams: string) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result').first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd').fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
}
const setCosts = async (page: Page, on: boolean) => {
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Visa uppskattade priser (typpriser)').setChecked(on);
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
};

test('food cost in the diary: off by default; on → meal and day costs, a food’s price on its food screen; an edit updates them', async ({ page }) => {
  test.slow();
  const external: string[] = [];
  page.on('request', (r) => !r.url().startsWith('http://localhost') && external.push(r.url()));
  await page.goto('./');
  await logFood(page, 0, 'mellanmjölk', '200');
  const milk = meal(page, 0).locator('li', { hasText: /Mellanmjölk/ });
  await expect(milk).toBeVisible();
  await expect(page.locator('.day-cost')).toHaveCount(0); // off by default
  await expect(meal(page, 0).locator('.meal-head')).not.toContainText('kr');

  // On: the meal's total in its header and the day's — no cost line per food (M42).
  await setCosts(page, true);
  await expect(meal(page, 0).locator('.meal-head')).toContainText(/kcal · ~\d+(,5)? kr/);
  await expect(page.locator('.day-cost')).toContainText(/^Matkostnad: ~\d+(,5)? kr$/);
  await expect(milk).not.toContainText('kr');

  // A food with no price (wine): the meal and the day say "at least".
  await logFood(page, 0, 'vin rött', '100');
  await expect(meal(page, 0).locator('.meal-head')).toContainText(/minst ~\d/);
  await expect(page.locator('.day-cost')).toContainText('minst');

  // The food screen shows its price and opens the price editor: 30 kr/kg → 200 g = ~6 kr, everywhere.
  await milk.locator('.entry').click();
  await expect(page.locator('.food-price')).toContainText(/Pris: ~\d+(,\d)? kr\/kg \(typpris\)/);
  await page.locator('.food-price').getByRole('button', { name: 'Ändra' }).click();
  const sheet = page.getByRole('dialog', { name: 'Pris' });
  await expect(sheet.getByRole('heading', { name: /Mellanmjölk/ })).toBeVisible();
  await expect(sheet.getByText(/≈ typpris \d+ kr\/kg/)).toBeVisible();
  await sheet.getByLabel('Jämförpris').fill('30');
  await sheet.getByRole('button', { name: 'Spara pris' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.food-price')).toContainText('Pris: ~30 kr/kg (ditt pris)');
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(page.locator('.day-cost')).toContainText('minst ~6 kr');

  // Kept: after a reload the own price still wins; then it can be removed again.
  await page.reload();
  await expect(page.locator('.day-cost')).toContainText('minst ~6 kr');
  await milk.locator('.entry').click();
  await page.locator('.food-price').getByRole('button', { name: 'Ändra' }).click();
  await expect(sheet.getByLabel('Jämförpris')).toHaveValue('30');
  await sheet.getByRole('button', { name: 'Ta bort pris' }).click();
  await expect(page.locator('.food-price')).toContainText('(typpris)');
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(page.locator('.day-cost')).not.toContainText('~6 kr');

  // Off again: nothing shown.
  await setCosts(page, false);
  await expect(page.locator('.day-cost')).toHaveCount(0);
  await expect(meal(page, 0).locator('.meal-head')).not.toContainText('kr');
  expect(external).toEqual([]);
});
