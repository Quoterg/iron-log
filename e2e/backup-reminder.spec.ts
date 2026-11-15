import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const entriesFor = (days: number) =>
  Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 1 - i);
    return { id: `e${i}`, date: iso(d), meal: 'lunch', foodRef: 'slv:702', grams: 60, createdAt: i + 1 };
  });

/**
 * `days` logged days ending yesterday, written straight to storage as if logged here (a restore
 * counts as a backup since review #104, so it can't be used to build them up), then reloaded.
 */
async function logDays(page: Page, days: number) {
  await page.evaluate(async (list) => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const tx = db.transaction('entries', 'readwrite');
    for (const e of list) tx.objectStore('entries').put(e);
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  }, entriesFor(days));
  await page.reload();
}

/** Change stored settings directly (a month can't pass in a test). */
async function patchSettings(page: Page, drop: string[]) {
  await page.evaluate(async (keys) => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const get = db.transaction('kv').objectStore('kv').get('settings');
    const s = await new Promise<Record<string, unknown>>((ok) => (get.onsuccess = () => ok(get.result)));
    for (const k of keys) delete s[k];
    await new Promise((ok) => (db.transaction('kv', 'readwrite').objectStore('kv').put(s, 'settings').onsuccess = ok));
    db.close();
  }, drop);
}

const card = (page: Page) => page.locator('.backup-note');
const dataPage = async (page: Page) => {
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
};
const offSwitch = (page: Page) => page.getByLabel('Påminn om säkerhetskopia efter ungefär en månads loggning');

async function start(page: Page) {
  await page.goto('./');
  // The diary shows one message at a time; the first-start card comes first.
  await page.locator('.welcome').getByRole('button', { name: 'Inte nu' }).click();
}

test('no reminder before about a month of logging', async ({ page }) => {
  await start(page);
  await logDays(page, 20);
  await page.waitForTimeout(4000); // checked a few seconds after start
  await expect(card(page)).toHaveCount(0);
});

test('a quiet backup reminder (M69): one tap saves, then it waits; "Inte nu" waits', async ({ page }) => {
  test.slow();
  await start(page);
  await logDays(page, 30);
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

  // "Inte nu" (the saved date cleared to reach the count again): gone, and still gone after a reload.
  await patchSettings(page, ['backupAt']);
  await page.reload();
  await expect(card(page)).toBeVisible({ timeout: 10_000 });
  await card(page).getByRole('button', { name: 'Inte nu' }).click();
  await expect(card(page)).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(card(page)).toHaveCount(0);
});

test('switching it off takes a showing card away at once (review #104)', async ({ page }) => {
  await start(page);
  await logDays(page, 30);
  await expect(card(page)).toBeVisible({ timeout: 10_000 });
  await dataPage(page);
  await expect(offSwitch(page)).toBeChecked();
  await offSwitch(page).uncheck();
  await tab(page, 'Dagbok');
  await expect(card(page)).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(4000);
  await expect(card(page)).toHaveCount(0);
});

test('restoring a backup counts as one, and keeps this device’s off switch (review #104)', async ({ page }) => {
  test.slow();
  await start(page);
  await logDays(page, 30);
  await expect(card(page)).toBeVisible({ timeout: 10_000 });
  const restore = async (settings?: object) => {
    await dataPage(page);
    page.once('dialog', (d) => void d.accept());
    const reloaded = page.waitForEvent('load', { timeout: 15_000 });
    await page.getByLabel('Importera säkerhetskopia').setInputFiles({
      name: 'h.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries: entriesFor(40), ...(settings ? { settings } : {}) })),
    });
    await reloaded;
  };
  // A backup without settings: right after restoring, no "no backup" card.
  await restore();
  await page.waitForTimeout(4000);
  await expect(card(page)).toHaveCount(0);

  // A backup with settings (made with the reminder on) doesn't switch this device's "off" back on.
  await dataPage(page);
  await offSwitch(page).uncheck();
  await restore({ lang: 'sv', profile: { sex: 'female', kcal: 2000 }, targetOverrides: {} });
  await dataPage(page);
  await expect(offSwitch(page)).not.toBeChecked();
});
