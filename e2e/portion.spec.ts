import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

async function openBanana(page: Page, mealIndex: number) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('banan');
  await page.getByRole('dialog').locator('.result', { hasText: /^Banan/ }).first().click();
}

test('portion screen (M67): "Lägg till" without scrolling; the amount logged or corrected last opens next time', async ({ page }) => {
  await page.goto('./');
  await openBanana(page, 0);
  // Never logged: 1 of its first measure. The button is on screen above the "what if" preview.
  await expect(page.getByLabel('Mängd', { exact: true })).toHaveValue('1');
  const add = page.getByRole('button', { name: 'Lägg till', exact: true });
  await expect(add).toBeInViewport();
  const box = await add.boundingBox();
  const preview = await page.locator('.whatif').boundingBox();
  expect(box!.y).toBeLessThan(preview!.y);
  await page.getByRole('button', { name: '2 st', exact: true }).click();
  await add.click();
  await expect(meal(page, 0).locator('.entry', { hasText: 'Banan' })).toContainText('2 st');

  // Next time: 2 st, also shown in the recent list.
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await expect(page.locator('.result', { hasText: 'Banan' }).first()).toContainText(/2 st · \d+ kcal/);
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await openBanana(page, 1);
  await expect(page.getByLabel('Mängd', { exact: true })).toHaveValue('2');
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await page.getByRole('button', { name: /Tillbaka/ }).click();

  // Corrected after logging (3 st): that is what opens next time.
  await meal(page, 0).locator('.entry', { hasText: 'Banan' }).click();
  await page.getByLabel('Mängd', { exact: true }).fill('3');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openBanana(page, 2);
  await expect(page.getByLabel('Mängd', { exact: true })).toHaveValue('3');
});
