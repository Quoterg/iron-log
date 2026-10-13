import { expect, test, type Page } from '@playwright/test';

const settingsTab = (page: Page) => page.getByRole('button', { name: 'Inställningar', exact: true }).click();
const nutrientsTab = (page: Page) => page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
const target = (page: Page, nutrient: string) => page.locator('.bar', { has: page.getByText(nutrient, { exact: true }) });

async function setField(page: Page, label: string, value: string) {
  const f = page.getByLabel(label, { exact: true });
  await f.fill(value);
  await f.blur();
}

test('profiles saved before the formula change are migrated once, with a notice', async ({ page }) => {
  await page.goto('./');
  // Settings as saved by an older version: automatic energy, no activity level (meant NNR 1.6).
  await page.evaluate(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok, err) => ((req.onsuccess = () => ok(req.result)), (req.onerror = err)));
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(
      { lang: 'sv', profile: { sex: 'female', kcal: 2110, kcalAuto: true, age: 30, weightKg: 60, heightCm: 165 }, targetOverrides: {} },
      'settings',
    );
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByText(/Ditt automatiska energimål har ändrats/)).toBeVisible();
  await expect(page.getByLabel('Energibehov per dag (kcal)')).toHaveValue('2046');
  await expect(page.getByLabel('Aktivitetsnivå')).toHaveValue('1.55');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  // The dismissal is written to IndexedDB asynchronously; reload only once it is stored.
  await page.waitForFunction(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const get = db.transaction('kv').objectStore('kv').get('settings');
    const s = await new Promise<{ energyNotice?: boolean }>((ok) => (get.onsuccess = () => ok(get.result)));
    db.close();
    return s?.energyNotice === false;
  });
  await page.reload();
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByLabel('Aktivitetsnivå')).toHaveValue('1.55');
  await expect(page.getByText(/Ditt automatiska energimål har ändrats/)).toHaveCount(0);
});

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
  // Sedentary by default (like tdeecalculator.net): Mifflin BMR 1324.25 × 1.2 = 1589.
  await expect(kcal).toHaveValue('1589');
  await expect(page.getByText(/Mifflin–St Jeor/)).toBeVisible();

  // Body fat % switches to Katch–McArdle: (370 + 21.6 × 60.4 × 0.75) × 1.2 = 1618.
  await setField(page, 'Fettprocent (valfritt)', '25');
  await expect(kcal).toHaveValue('1618');
  await expect(page.getByText(/Katch–McArdle \(fettfri massa\)/)).toBeVisible();
  await page.getByLabel('Aktivitetsnivå').selectOption('1.55');
  await expect(kcal).toHaveValue('2090');
  await setField(page, 'Fettprocent (valfritt)', '');
  await page.getByLabel('Aktivitetsnivå').selectOption('1.2');
  await expect(kcal).toHaveValue('1589');

  // Third trimester: +2.3 MJ, weight is asked as before pregnancy, iron 26 mg.
  await page.getByLabel('Livssituation').selectOption('pregnant3');
  await expect(kcal).toHaveValue('2139'); // + 2.3 MJ ≈ 550 kcal
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

test('goal in the profile (M35): the automatic target is the need ± the pace, at once', async ({ page }) => {
  await page.goto('./');
  await settingsTab(page);
  const kcal = page.getByLabel('Energibehov per dag (kcal)');
  await setField(page, 'Ålder', '30');
  await setField(page, 'Vikt (kg)', '60,4');
  await setField(page, 'Längd (cm)', '165');
  await page.getByLabel('Aktivitetsnivå').selectOption('1.55');
  await page.getByLabel('Räkna ut energibehovet automatiskt').check();
  await expect(kcal).toHaveValue('2053'); // maintain: the need (BMR 1324 × 1.55)

  const goal = page.getByRole('combobox', { name: 'Mål', exact: true });
  await goal.selectOption('lose');
  // 0.75 % of 60.4 kg is 0.45 kg/week: only 0.25 is offered.
  await expect(page.getByRole('combobox', { name: 'Takt' }).locator('option')).toHaveCount(1);
  await expect(kcal).toHaveValue('1780'); // 2053 − 275, to 10
  await expect(page.getByText('Förbrukning ca 2 053 kcal, −275 kcal/dag för 0,25 kg/vecka.')).toBeVisible();
  await goal.selectOption('gain');
  await expect(kcal).toHaveValue('2330');
  // A body change recomputes with the goal; kept after a reload.
  await setField(page, 'Vikt (kg)', '62');
  await expect(kcal).toHaveValue('2350'); // need 2077 + 275, to 10
  await page.reload();
  await settingsTab(page);
  await expect(goal).toHaveValue('gain');
  await expect(kcal).toHaveValue('2350');
});

test('settings from before M35 with a goal: the automatic target follows it once, with a notice', async ({ page }) => {
  await page.goto('./');
  await page.evaluate(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok, err) => ((req.onsuccess = () => ok(req.result)), (req.onerror = err)));
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(
      {
        lang: 'sv', version: 2, goal: 'lose', pace: 0.25, targetOverrides: {},
        profile: { sex: 'female', kcal: 2053, kcalAuto: true, age: 30, weightKg: 60.4, heightCm: 165, pal: 1.55 },
      },
      'settings',
    );
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  await page.reload();
  await settingsTab(page);
  await expect(page.getByText(/Ditt viktmål gäller nu också det automatiska energimålet, som därför är 1\s780 kcal\/dag/)).toBeVisible();
  await expect(page.getByLabel('Energibehov per dag (kcal)')).toHaveValue('1780');
  await page.getByRole('button', { name: 'OK', exact: true }).click();
  await expect(page.getByText(/Ditt viktmål gäller nu också/)).toHaveCount(0);
  await expect(page.getByText(/Ditt automatiska energimål har ändrats/)).toHaveCount(0); // not the activity-level notice
});
