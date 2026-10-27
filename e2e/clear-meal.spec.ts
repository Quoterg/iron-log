import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('a whole meal can be cleared at once (M41), after a confirmation; other meals stay', async ({ page }) => {
  await page.goto('./');
  const entries = [
    { id: 'b1', date: today(), meal: 'breakfast', foodRef: 'slv:702', grams: 60, createdAt: 1 },
    { id: 'b2', date: today(), meal: 'breakfast', foodRef: 'slv:553', grams: 120, createdAt: 2 },
    { id: 'b3', date: today(), meal: 'breakfast', foodRef: 'slv:565', grams: 75, createdAt: 3 },
    { id: 'l1', date: today(), meal: 'lunch', foodRef: 'slv:702', grams: 80, createdAt: 4 },
  ];
  page.on('dialog', (d) => void d.accept());
  await tab(page, 'Inställningar');
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'h.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;
  await tab(page, 'Dagbok');
  await expect(meal(page, 0).locator('.entry')).toHaveCount(3);

  // Cancelled: nothing removed.
  page.removeAllListeners('dialog');
  page.once('dialog', (d) => {
    expect(d.message()).toBe('Ta bort allt i frukost (3 st)?');
    void d.dismiss();
  });
  await meal(page, 0).getByRole('button', { name: 'Töm måltiden' }).click();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(3);

  // Confirmed: the breakfast is empty, the lunch untouched — also after a reload.
  page.once('dialog', (d) => void d.accept());
  await meal(page, 0).getByRole('button', { name: 'Töm måltiden' }).click();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);
  await expect(meal(page, 1).locator('.entry')).toHaveCount(1);
  await page.reload();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(1);
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);
});
