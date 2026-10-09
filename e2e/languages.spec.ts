import { expect, test } from '@playwright/test';

test('switching language loads it on demand, translates the app and survives a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const picker = page.getByLabel('Språk');
  await expect(picker.locator('option')).toHaveText(['Svenska', 'English', 'Dansk', 'Deutsch', 'Suomi', 'Soomaali']);

  await picker.selectOption('de');
  await expect(page.getByRole('button', { name: 'Tagebuch', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');

  // Nutrient names and decimal comma in German; English food names (foods have sv/en names only).
  await page.getByRole('button', { name: 'Nährstoffe', exact: true }).click();
  await expect(page.getByText('Eisen', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Tagebuch', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tagebuch', exact: true }).click();
  await page.locator('.meal').first().getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByPlaceholder(/Lebensmittel suchen/).fill('oats');
  await expect(page.locator('.result').first()).toContainText(/oats/i);
});

test('Somali, the newest language, shows its own strings', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Språk').selectOption('so');
  await expect(page.getByRole('button', { name: 'Dejinta', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buugga maalinlaha', exact: true })).toBeVisible();
});

test('restoring a backup made in another language opens the app in that language', async ({ page }) => {
  page.on('dialog', (d) => d.accept()); // the import's confirm()
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'iron-log-backup',
        version: 1,
        entries: [],
        settings: { lang: 'de', profile: { sex: 'female', kcal: 2000 }, targetOverrides: {}, version: 2 },
      }),
    ),
  });
  await reloaded;
  await expect(page.getByRole('button', { name: 'Tagebuch', exact: true })).toBeVisible();
});
