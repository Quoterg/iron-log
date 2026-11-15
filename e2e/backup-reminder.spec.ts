import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** `days` logged days ending yesterday, imported as a backup (which never counts as one saved here). */
async function importDays(page: Page, days: number) {
  const entries = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 1 - i);
    return { id: `e${i}`, date: iso(d), meal: 'lunch', foodRef: 'slv:702', grams: 60, createdAt: i + 1 };
  });
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  page.once('dialog', (d) => void d.accept());
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'h.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;
}

const card = (page: Page) => page.locator('.backup-note');

test('no reminder before about a month of logging', async ({ page }) => {
  await page.goto('./');
  await page.locator('.welcome').getByRole('button', { name: 'Inte nu' }).click();
  await importDays(page, 20);
  await tab(page, 'Dagbok');
  await page.waitForTimeout(4000); // checked a few seconds after start
  await expect(card(page)).toHaveCount(0);
});

test('a quiet backup reminder (M69): one tap saves, then it waits; "Inte nu" waits; it can be switched off', async ({ page }) => {
  test.slow();
  await page.goto('./');
  // The diary shows one message at a time; the first-start card comes first.
  await page.locator('.welcome').getByRole('button', { name: 'Inte nu' }).click();
  await importDays(page, 30);
  await tab(page, 'Dagbok');
  // Never on the first paint; shown once the idle check has run.
  await expect(card(page)).toContainText('Dina data finns bara på den här enheten', { timeout: 10_000 });
  await expect(card(page)).toContainText('utan säkerhetskopia');

  // One tap saves the backup file; the card goes and stays gone.
  const download = page.waitForEvent('download');
  await card(page).getByRole('button', { name: 'Spara säkerhetskopia' }).click();
  expect((await download).suggestedFilename()).toMatch(/^iron-log-\d{4}-\d{2}-\d{2}\.json$/);
  await expect(card(page)).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(card(page)).toHaveCount(0);

  // Switched off in Settings: stays off even with the count reached (the saved date is cleared here
  // to reach it again; a month can't pass in a test).
  await page.evaluate(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const store = db.transaction('kv', 'readwrite').objectStore('kv');
    const s = await new Promise<Record<string, unknown>>((ok) => (store.get('settings').onsuccess = (e) => ok((e.target as IDBRequest).result)));
    delete s.backupAt;
    await new Promise((ok) => (db.transaction('kv', 'readwrite').objectStore('kv').put(s, 'settings').onsuccess = ok));
    db.close();
  });
  await page.reload();
  await expect(card(page)).toBeVisible({ timeout: 10_000 });
  // "Inte nu": gone, and still gone after a reload.
  await card(page).getByRole('button', { name: 'Inte nu' }).click();
  await expect(card(page)).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(card(page)).toHaveCount(0);

  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  const off = page.getByLabel('Påminn om säkerhetskopia efter ungefär en månads loggning');
  await expect(off).toBeChecked();
  await off.uncheck();
  await expect(off).not.toBeChecked();
});
