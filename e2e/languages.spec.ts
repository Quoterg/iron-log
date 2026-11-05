import { expect, test, type Page } from '@playwright/test';

test('switching to English loads it on demand, translates the app and survives a reload', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  const picker = page.getByLabel('Språk');
  // Swedish and English only (owner, M41c).
  await expect(picker.locator('option')).toHaveText(['Svenska', 'English']);

  await picker.selectOption('en');
  await expect(page.getByRole('button', { name: 'Diary', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // Nutrient names in English; English food names.
  await page.getByRole('button', { name: 'Nutrients', exact: true }).click();
  await page.locator('.group summary', { hasText: 'Minerals' }).click(); // groups fold away (M43)
  await expect(page.getByText('Iron', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Diary', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Diary', exact: true }).click();
  await page.locator('.meal').first().getByRole('button', { name: 'Add' }).click();
  await page.getByPlaceholder(/Search foods/).fill('oats');
  await expect(page.locator('.result').first()).toContainText(/oats/i);
});

async function restore(page: Page, lang: string) {
  page.on('dialog', (d) => d.accept()); // the import's confirm()
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'iron-log-backup',
        version: 1,
        entries: [],
        settings: { lang, profile: { sex: 'female', kcal: 2000 }, targetOverrides: {}, version: 2 },
      }),
    ),
  });
  await reloaded;
}

test('restoring a backup made in English opens the app in English', async ({ page }) => {
  await restore(page, 'en');
  await expect(page.getByRole('button', { name: 'Diary', exact: true })).toBeVisible();
});

test('a backup made in a removed language opens in the nearest one (M41c): German → English, Danish → Swedish', async ({ page }) => {
  await restore(page, 'de');
  await expect(page.getByRole('button', { name: 'Diary', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeVisible();
});

test('a Danish backup opens in Swedish', async ({ page }) => {
  await restore(page, 'da');
  await expect(page.getByRole('button', { name: 'Dagbok', exact: true })).toBeVisible();
});
