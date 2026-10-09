import { expect, test, type Page } from '@playwright/test';

const settingsTab = (page: Page) => page.getByRole('button', { name: 'Inställningar', exact: true }).click();
const nutrientsTab = (page: Page) => page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
const target = (page: Page, nutrient: string) => page.locator('.bar', { has: page.getByText(nutrient, { exact: true }) });

test('profile drives energy and NNR targets (age band, pregnancy)', async ({ page }) => {
  await page.goto('./');
  await settingsTab(page);

  // Automatic energy needs age, weight and height.
  await expect(page.getByLabel('Räkna ut energibehovet automatiskt')).toBeDisabled();
  await page.getByLabel('Ålder').fill('30');
  await page.getByLabel('Ålder').blur();
  await page.getByLabel('Vikt (kg)').fill('60');
  await page.getByLabel('Vikt (kg)').blur();
  await page.getByLabel('Längd (cm)').fill('165');
  await page.getByLabel('Längd (cm)').blur();
  await expect(page.getByText(/Uppskattat energibehov: 2\s?110 kcal/)).toBeVisible();
  await page.getByLabel('Räkna ut energibehovet automatiskt').check();
  await expect(page.getByLabel('Energibehov per dag (kcal)')).toHaveValue('2110');

  // Third trimester: +2.3 MJ and iron 26 mg.
  await page.getByLabel('Livssituation').selectOption('pregnant3');
  await expect(page.getByLabel('Energibehov per dag (kcal)')).toHaveValue('2660');
  await nutrientsTab(page);
  await expect(target(page, 'Järn')).toContainText('/ 26 mg');
  await expect(target(page, 'Folat')).toContainText('/ 600 µg');

  // Age 75, not pregnant: vitamin D 20 µg, iron 7 mg; survives reload.
  await settingsTab(page);
  await page.getByLabel('Livssituation').selectOption('none');
  await page.getByLabel('Ålder').fill('75');
  await page.getByLabel('Ålder').blur();
  await page.reload();
  await nutrientsTab(page);
  await expect(target(page, 'Vitamin D')).toContainText('/ 20 µg');
  await expect(target(page, 'Järn')).toContainText('/ 7 mg');

  // Out-of-range input is rejected.
  await settingsTab(page);
  await page.getByLabel('Ålder').fill('5');
  await page.getByLabel('Ålder').blur();
  await expect(page.getByLabel('Ålder')).toHaveValue('75');
});
