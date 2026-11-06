import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

async function openIron(page: Page) {
  await tab(page, 'Näringsämnen');
  await page.locator('.group summary', { hasText: 'Mineraler' }).click();
  await page.locator('.bar-btn', { hasText: 'Järn' }).click();
}

test('richest foods per 100 g, per 100 kcal and, with food costs on, per 10 kr (M49)', async ({ page }) => {
  await page.goto('./');
  await openIron(page);
  const dialog = page.getByRole('dialog');
  const measures = dialog.getByRole('group', { name: 'Rikast i livsmedelsdatabasen' });
  const rows = dialog.locator('ul.entries').last().locator('.entry');
  await expect(measures.getByRole('button', { name: 'Per 100 g' })).toHaveAttribute('aria-pressed', 'true');
  await expect(rows.first()).toBeVisible();
  const per100g = await rows.allInnerTexts();
  // Without food costs there is no price to rank by.
  await expect(measures.getByRole('button', { name: 'Per 10 kr' })).toHaveCount(0);

  await measures.getByRole('button', { name: 'Per 100 kcal' }).click();
  await expect(dialog.getByText('Vardagsmat: mest av näringsämnet för energin.')).toBeVisible();
  await expect(rows.first()).toBeVisible();
  const perKcal = await rows.allInnerTexts();
  expect(perKcal).not.toEqual(per100g);

  // Food costs on: per 10 kr appears, from typical prices.
  await page.goBack();
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Funktioner' }).click();
  await page.getByLabel('Visa uppskattade priser (typpriser)').check();
  await openIron(page);
  await measures.getByRole('button', { name: 'Per 10 kr' }).click();
  await expect(dialog.getByText(/Mest för pengarna/)).toBeVisible();
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await expect(rows.first()).toContainText('mg');
});
