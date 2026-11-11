import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('first start (M45): a few questions give the energy target, then optional features; shown once', async ({ page }) => {
  await page.goto('./');
  const card = page.locator('.welcome');
  await expect(card).toContainText('Välkommen!');
  await card.getByRole('button', { name: 'Kom igång' }).click();

  const sheet = page.getByRole('dialog', { name: 'Kom igång' });
  // Only what the targets need: no body fat here.
  await expect(sheet.getByLabel('Fettprocent (valfritt)')).toHaveCount(0);
  await sheet.getByLabel('Kön').selectOption('male');
  for (const [label, v] of [['Ålder', '30'], ['Vikt (kg)', '70'], ['Längd (cm)', '180']] as const) {
    await sheet.getByLabel(label, { exact: true }).fill(v);
    await sheet.getByLabel(label, { exact: true }).blur();
  }
  await sheet.getByLabel('Aktivitetsnivå').selectOption('1.55');
  await sheet.getByRole('button', { name: 'Nästa' }).click();
  // Mifflin–St Jeor: 10 × 70 + 6.25 × 180 − 5 × 30 + 5 = 1680, × 1.55 = 2604.
  await expect(sheet.getByText(/Ditt energimål: 2\s604 kcal\/dag, räknat från din profil/)).toBeVisible();
  await sheet.getByLabel(/Föreslå livsmedel och byten/).check();
  await sheet.getByRole('button', { name: 'Klar' }).click();

  await expect(card).toHaveCount(0);
  await expect(page.locator('.summary')).toContainText('/ 2 604 kcal');
  // The sheet closes with history.back() after the write: reloading before that can abort the reload.
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.summary')).toContainText('/ 2 604 kcal');
  await expect(card).toHaveCount(0);
  await tab(page, 'Inställningar');
  await expect(page.locator('.settings-menu .entry', { hasText: 'Energimål' })).toContainText('Räkna från profilen');
  await expect(page.locator('.settings-menu .entry', { hasText: 'Funktioner' })).toContainText('3 av 6 på');
});

test('the first-start card can be put away for good; empty Näringsämnen says what to do', async ({ page }) => {
  await page.goto('./');
  await page.locator('.welcome').getByRole('button', { name: 'Inte nu' }).click();
  await expect(page.locator('.welcome')).toHaveCount(0);
  await page.waitForFunction(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const get = db.transaction('kv').objectStore('kv').get('settings');
    const s = await new Promise<{ welcomed?: boolean }>((ok) => (get.onsuccess = () => ok(get.result)));
    db.close();
    return s?.welcomed === true;
  });
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await expect(page.locator('.welcome')).toHaveCount(0);

  // Nothing logged: one line, the targets without "under målet".
  await tab(page, 'Näringsämnen');
  await expect(page.getByText(/Inget loggat i dag än/)).toBeVisible();
  await expect(page.getByText(/under målet/)).toHaveCount(0);
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  await expect(page.getByText(/Inget loggat under perioden/)).toBeVisible();
  await expect(page.getByText(/0 av 7 dagar/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Till dagboken' }).click();
  await expect(page.locator('.meal').first()).toBeVisible();

  // Once something is logged, the usual page.
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await tab(page, 'Näringsämnen');
  await expect(page.getByText(/Inget loggat i dag än/)).toHaveCount(0);
  await expect(page.getByText(/under målet/).first()).toBeVisible();
});
