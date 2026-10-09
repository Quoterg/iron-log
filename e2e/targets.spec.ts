import { expect, test, type Page } from '@playwright/test';

const nutrientsTab = (page: Page) => page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
const target = (page: Page, nutrient: string) => page.locator('.bar', { has: page.getByText(nutrient, { exact: true }) });

async function setField(page: Page, label: string, value: string) {
  const f = page.getByLabel(label, { exact: true });
  await f.fill(value);
  await f.blur();
}

test('presets and per-nutrient targets change what the nutrients tab measures against', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  await nutrientsTab(page);
  await page.getByRole('button', { name: 'Anpassa mål' }).click();

  // Keto: carbs capped at 5 E% = 25 g of 2000 kcal.
  await page.getByLabel('Förval').selectOption('keto');
  await expect(page.getByLabel('Kolhydrater Max %')).toHaveValue('5');
  // Per-nutrient defaults reflect the preset (25 g carbs), not plain NNR.
  await expect(page.getByLabel('Kolhydrater Max', { exact: true })).toHaveAttribute('placeholder', '25');

  // Own iron target and salt limit.
  await setField(page, 'Järn Mål', '18');
  await setField(page, 'Salt Max', '4');
  // Invalid (min above the max) is rejected.
  await setField(page, 'Natrium Mål', '9000');
  await expect(page.getByLabel('Natrium Mål', { exact: true })).toHaveValue('');

  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(target(page, 'Kolhydrater')).toContainText('/ 25 g');
  await expect(target(page, 'Järn')).toContainText('/ 18 mg');
  await expect(target(page, 'Salt')).toContainText('/ 4 g');

  // Survives reload; reset brings NNR back.
  await page.reload();
  await nutrientsTab(page);
  await expect(target(page, 'Järn')).toContainText('/ 18 mg');
  await page.getByRole('button', { name: 'Anpassa mål' }).click();
  await page.getByRole('button', { name: 'Återställ alla mål' }).click();
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await expect(target(page, 'Järn')).toContainText('/ 15 mg');
  await expect(target(page, 'Kolhydrater')).toContainText('/ 225 g');
});

test('split-out screens are cached for offline use', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now controlled by the service worker
  await expect(page.getByRole('button', { name: 'Idag' })).toBeVisible();
  // Give the idle prefetch a moment to fetch the split chunks through the service worker.
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) {
      const reqs = await (await caches.open(k)).keys();
      if (reqs.some((r) => /Settings-.*\.js$/.test(r.url)) && reqs.some((r) => /TargetEditor-.*\.js$/.test(r.url))) return true;
    }
    return false;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible();
  await page.getByRole('button', { name: 'Anpassa mål' }).click();
  await expect(page.getByLabel('Förval')).toBeVisible();
});
