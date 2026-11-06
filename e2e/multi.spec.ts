import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

test('pick several (M48): recent foods and a search result at their usual amounts, logged at once; an entry moves to another meal', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  // White bread (slv:202) usually 80 g, oats (slv:702) usually 60 g.
  const usage = [
    { foodRef: 'slv:202', count: 5, lastUsed: 3000, lastGrams: 80 },
    { foodRef: 'slv:702', count: 5, lastUsed: 2000, lastGrams: 60 },
  ];
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'usage.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries: [], usage })),
  });
  await reloaded;

  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: 'Välj flera' }).click();
  const recent = page.locator('.results').last();
  await recent.locator('.result', { hasText: /^Bröd vitt/ }).first().click();
  await recent.locator('.result', { hasText: /^Havregryn/ }).first().click();
  const bar = page.locator('.multi-bar');
  await expect(bar).toContainText('Lägg till 2');
  // A search result, picked and unpicked: the selection survives typing.
  await page.getByPlaceholder(/Sök livsmedel/).fill('banan');
  const banana = page.locator('.result', { hasText: /Banan/ }).first(); // picked rows start with ✓
  await banana.click();
  await expect(banana).toHaveAttribute('aria-pressed', 'true');
  await expect(bar).toContainText('Lägg till 3');
  await banana.click();
  await expect(bar).toContainText('Lägg till 2');
  await bar.getByRole('button').click();

  const lunch = meal(page, 1).locator('.entry');
  await expect(lunch).toHaveCount(2);
  await expect(lunch.filter({ hasText: /Bröd vitt/ })).toContainText('80 g');
  await expect(lunch.filter({ hasText: /Havregryn/ })).toContainText('60 g');

  // Moving an entry: its meal (and date) on its own screen.
  await lunch.filter({ hasText: /Havregryn/ }).click();
  await page.getByLabel('Måltid').selectOption('dinner');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(meal(page, 1).locator('.entry')).toHaveCount(1);
  await expect(meal(page, 2).locator('.entry', { hasText: /Havregryn/ })).toContainText('60 g');
});
