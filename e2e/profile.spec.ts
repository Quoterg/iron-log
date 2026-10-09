import { expect, test, type Page } from '@playwright/test';

const settingsTab = (page: Page) => page.getByRole('button', { name: 'Inställningar', exact: true }).click();
const nutrientsTab = (page: Page) => page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
const target = (page: Page, nutrient: string) => page.locator('.bar', { has: page.getByText(nutrient, { exact: true }) });

async function setField(page: Page, label: string, value: string) {
  const f = page.getByLabel(label, { exact: true });
  await f.fill(value);
  await f.blur();
}

test('profile drives energy and NNR targets (age band, pregnancy)', async ({ page }) => {
  await page.goto('./');
  await settingsTab(page);
  const kcal = page.getByLabel('Energibehov per dag (kcal)');
  const auto = page.getByLabel('Räkna ut energibehovet automatiskt');

  // Automatic energy needs age, weight and height; weight takes a decimal comma.
  await expect(auto).toBeDisabled();
  await setField(page, 'Ålder', '30');
  await setField(page, 'Vikt (kg)', '60,4');
  await setField(page, 'Längd (cm)', '165');
  await expect(page.getByLabel('Vikt (kg)', { exact: true })).toHaveValue('60,4');
  await auto.check();
  await expect(kcal).toHaveValue('2120'); // 1325 kcal BMR × 1.6

  // Third trimester: +2.3 MJ, weight is asked as before pregnancy, iron 26 mg.
  await page.getByLabel('Livssituation').selectOption('pregnant3');
  await expect(kcal).toHaveValue('2670');
  await expect(page.getByLabel('Vikt före graviditeten (kg)')).toBeVisible();
  await nutrientsTab(page);
  await expect(target(page, 'Järn')).toContainText('/ 26 mg');
  await expect(target(page, 'Folat')).toContainText('/ 600 µg');

  // Age 75, not pregnant: vitamin D 20 µg, iron 7 mg; persists across reload.
  await settingsTab(page);
  await page.getByLabel('Livssituation').selectOption('none');
  await setField(page, 'Ålder', '75');
  await nutrientsTab(page);
  await expect(target(page, 'Vitamin D')).toContainText('/ 20 µg'); // saved before reloading
  await page.reload();
  await nutrientsTab(page);
  await expect(target(page, 'Vitamin D')).toContainText('/ 20 µg');
  await expect(target(page, 'Järn')).toContainText('/ 7 mg');

  // Invalid input is rejected: too young, non-integer age, clearing data turns auto energy off.
  await settingsTab(page);
  await setField(page, 'Ålder', '5');
  await expect(page.getByLabel('Ålder', { exact: true })).toHaveValue('75');
  await setField(page, 'Ålder', '40,5');
  await expect(page.getByLabel('Ålder', { exact: true })).toHaveValue('75');
  await setField(page, 'Längd (cm)', '');
  await expect(auto).not.toBeChecked();
  await expect(page.getByText(/Fyll i ålder, vikt och längd/)).toBeVisible();
});
