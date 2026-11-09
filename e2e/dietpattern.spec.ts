import { expect, test } from '@playwright/test';

test('Kostmönster: the wholegrain goal sits in its own folded row (M52a)', async ({ page }) => {
  await page.goto('./');
  await page.locator('.meal').nth(1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result', { hasText: /^Havregryn fullkorn/ }).first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();

  await page.locator('.group summary', { hasText: 'Kolhydrater' }).click();
  await expect(page.locator('.group', { hasText: 'Kolhydrater' }).locator('.bar-btn', { hasText: 'Fullkorn' })).toHaveCount(0);
  await page.locator('.group summary', { hasText: 'Kostmönster' }).click();
  const row = page.locator('.group', { hasText: 'Kostmönster' }).locator('.bar-btn', { hasText: 'Fullkorn' });
  await expect(row).toBeVisible();
  // The logged oats report wholegrain: a real amount, not the unknown marker "–".
  await expect(row).not.toContainText('–');
  await expect(row).toContainText(/\d/);
});
