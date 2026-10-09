import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

test('export a backup, delete everything, import it back; export CSV', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');

  // Some data: a database food and a custom food.
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
  await page.getByLabel('Namn').fill('Min smoothie');
  await page.getByLabel('Energi (kcal)', { exact: true }).fill('70');
  await page.getByRole('button', { name: 'Spara' }).click();

  // Export JSON.
  const [backup] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Exportera säkerhetskopia/ }).click(),
  ]);
  const backupPath = await backup.path();
  const json = JSON.parse(await readFile(backupPath, 'utf8'));
  expect(json.format).toBe('iron-log-backup');
  expect(json.entries).toHaveLength(1);

  // Export CSV: Swedish header, one row.
  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Exportera dagbok/ }).click(),
  ]);
  const csvText = await readFile(await csv.path(), 'utf8');
  expect(csvText).toMatch(/^﻿Datum;Måltid;Livsmedel;Mängd \(g\);Energi \(kcal\)/);
  expect(csvText.trim().split('\r\n')).toHaveLength(2);

  // Delete all → empty diary and no custom foods.
  await page.getByRole('button', { name: 'Radera all data' }).click();
  await page.waitForLoadState('load');
  await expect(page.getByText(/Inget registrerat ännu/)).toBeVisible();

  // Import → everything is back.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByText(/inga egna livsmedel/)).toBeVisible();
  await page.getByLabel('Importera säkerhetskopia').setInputFiles(backupPath);
  await page.waitForLoadState('load');
  await expect(meal(page, 0).locator('.entry')).toContainText(/Havregryn/);
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByRole('button', { name: /Min smoothie/ })).toBeVisible();
});

test('a broken backup file is rejected without importing anything', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'evil.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries: [{ id: 1 }] })),
  });
  await expect(page.getByRole('status')).toContainText(/inte en giltig säkerhetskopia/);
});
