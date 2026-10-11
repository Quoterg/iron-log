import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const searchBox = (page: Page) => page.getByPlaceholder(/Sök livsmedel/);

async function logFood(page: Page, mealIndex: number, query: string, grams: string) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await searchBox(page).fill(query);
  await page.locator('.result').first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd').fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
}

test('saved meals, same as yesterday and portion memory', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  await logFood(page, 0, 'havregryn', '60');
  await logFood(page, 0, 'mjölk', '200');
  await expect(meal(page, 0).locator('.entry')).toHaveCount(2);

  // Save breakfast as a meal: the name is suggested from its foods.
  await meal(page, 0).getByRole('button', { name: 'Spara som måltid' }).click();
  const name = page.getByLabel('Namn', { exact: true });
  await expect(name).toHaveValue(/Havregryn/);
  await name.fill('Min frukost');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();

  // Tomorrow: breakfast is empty, and yesterday's is one tap away.
  await page.getByRole('button', { name: 'Nästa dag' }).click();
  await expect(page.getByRole('button', { name: 'Imorgon' })).toBeVisible();
  await meal(page, 0).getByRole('button', { name: /Samma som igår/ }).click();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(2);
  await expect(meal(page, 0).getByRole('button', { name: /Samma som igår/ })).toHaveCount(0);

  // The saved meal comes first in the add sheet; one tap logs it into lunch.
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await expect(page.getByRole('heading', { name: 'Sparade måltider' })).toBeVisible();
  await page.locator('.result', { hasText: 'Min frukost' }).click();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(2);
  await expect(meal(page, 1).locator('.entry').first()).toContainText(/Havregryn.*60 g/);

  // Portion memory: the usual amount, with multiples of it.
  await meal(page, 2).getByRole('button', { name: /Lägg till/ }).click();
  await page.locator('.result', { hasText: /Havregryn/ }).first().click();
  await expect(page.getByLabel('Mängd')).toHaveValue('60');
  await page.getByRole('button', { name: '2× = 120 g' }).click();
  await expect(page.getByLabel('Mängd')).toHaveValue('120');
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await page.getByRole('button', { name: /Tillbaka/ }).click();

  // Settings lists it; it can be removed (what was logged stays).
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: /Min frukost/ }).click();
  await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
  await expect(page.getByText('Inga sparade måltider ännu.', { exact: false })).toBeVisible();

  // Survives a reload, like everything else (the app opens on today; the lunch is tomorrow's).
  await page.reload();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await page.getByRole('button', { name: 'Nästa dag' }).click();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(2);
});
