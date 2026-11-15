import { expect, test, type Page } from '@playwright/test';

async function logOats(page: Page, mealIdx: number, grams: string) {
  await page.locator('.meal').nth(mealIdx).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.getByRole('dialog').locator('.result', { hasText: 'Havregryn fullkorn' }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd', { exact: true }).fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('calories remaining (M63): what is left, then how far over, in plain words; protein against its target', async ({ page }) => {
  await page.goto('./');
  // Nothing logged: the whole target is left; protein 0 of 50 g (10 E% of 2 000 kcal, NNR 2023).
  await expect(page.locator('.hero-left')).toHaveText(/^2\s000 kcal kvar$/);
  await expect(page.locator('.macro.m-protein .macro-val')).toHaveText('0 / 50 g');

  // 100 g oats = 375 kcal (Livsmedelsverket).
  await logOats(page, 0, '100');
  await expect(page.locator('.hero-left')).toHaveText(/^1\s625 kcal kvar$/);
  await expect(page.locator('.macro.m-carbs .macro-val')).toHaveText(/^\d+ g$/); // only protein has a target shown

  // Past the target: how far over, not a negative number, and no alarm colour on the bar.
  await logOats(page, 2, '500');
  await expect(page.locator('.hero-left')).toHaveText('250 kcal över målet');
  await expect(page.locator('.summary .hero')).not.toHaveClass(/over/);
});
