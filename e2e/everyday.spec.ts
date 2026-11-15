import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
};

async function profilePage(page: Page) {
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Profil & mål' }).click();
}

test('a number typed and then a select changed right away is kept (M71, walkthrough s17)', async ({ page }) => {
  await page.goto('./');
  await profilePage(page);
  await page.getByLabel('Kön').selectOption('male');
  const height = page.getByLabel('Längd (cm)');
  // Typed without leaving the field, then another control changed.
  await height.click();
  await page.keyboard.type('177');
  await page.getByLabel('Aktivitetsnivå').selectOption({ index: 2 });
  await expect(height).toHaveValue('177');
  await page.getByLabel('Vikt (kg)').click();
  await page.keyboard.type('82');
  await page.getByRole('combobox', { name: 'Mål', exact: true }).selectOption('lose');
  await expect(page.getByLabel('Vikt (kg)')).toHaveValue('82');
  await page.reload();
  await profilePage(page);
  await expect(page.getByLabel('Längd (cm)')).toHaveValue('177');
  await expect(page.getByLabel('Vikt (kg)')).toHaveValue('82');
});

test('a target nobody typed follows the profile once it is filled; a typed one stays (M71)', async ({ page }) => {
  await page.goto('./');
  await profilePage(page);
  await page.getByLabel('Kön').selectOption('male'); // the default for men: 2 500 kcal, not typed
  for (const [label, v] of [['Ålder', '40'], ['Vikt (kg)', '80'], ['Längd (cm)', '180']] as const) {
    await page.getByLabel(label, { exact: true }).fill(v);
    await page.getByLabel(label, { exact: true }).blur();
  }
  const link = page.getByRole('button', { name: /^Energimål:/ });
  // Mifflin–St Jeor: 10 × 80 + 6.25 × 180 − 5 × 40 + 5 = 1730, × 1.2 = 2076.
  await expect(link).toContainText('2 076 kcal');
  await expect(link).toContainText('Räkna från profilen');

  // Typed by the user: it stays when the profile changes.
  await link.click();
  await page.getByLabel(/Skriv själv/).check();
  const kcal = page.getByLabel('Energimål per dag (kcal)');
  await kcal.fill('2300');
  await kcal.blur();
  await page.getByRole('button', { name: /^‹ / }).click();
  await page.getByLabel('Vikt (kg)', { exact: true }).fill('85');
  await page.getByLabel('Vikt (kg)', { exact: true }).blur();
  await expect(link).toContainText('2 300 kcal');
});

test('after restoring a backup, recent foods come from its diary (M71)', async ({ page }) => {
  await page.goto('./');
  await page.locator('.welcome').getByRole('button', { name: 'Inte nu' }).click();
  const entries = [
    { id: 'a', date: daysAgo(3), meal: 'lunch', foodRef: 'slv:702', grams: 60, createdAt: Date.now() - 3 * 864e5 },
    { id: 'b', date: daysAgo(2), meal: 'lunch', foodRef: 'slv:553', grams: 120, unit: 'st', qty: 2, createdAt: Date.now() - 2 * 864e5 },
  ];
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  page.once('dialog', (d) => void d.accept());
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'h.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;
  await tab(page, 'Dagbok');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await expect(page.getByRole('heading', { name: 'Senaste' })).toBeVisible();
  const recent = page.locator('.results').last();
  await expect(recent).toContainText('Havregryn fullkorn');
  await expect(recent.locator('.result', { hasText: 'Banan' })).toContainText('2 st'); // slv:553, as logged
});

test('one rounding rule: the energy hero in whole kcal (M71); the clear question clears the tab bar', async ({ page }) => {
  await page.goto('./');
  for (let i = 0; i < 2; i++) {
    await meal(page, 3).getByRole('button', { name: /Lägg till/ }).click();
    await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
    await page.getByRole('dialog').locator('.result', { hasText: 'Havregryn fullkorn' }).first().click();
    await page.getByLabel('Mått', { exact: true }).selectOption('g');
    await page.getByLabel('Mängd', { exact: true }).fill('10,5'); // 39,4 kcal each
    await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(page.locator('.hero-num')).toHaveText(/^79\s*\/\s*2\s000 kcal$/);

  // The last meal's clear question opens near the bottom: it is scrolled above the floating tab bar.
  await meal(page, 3).getByRole('button', { name: /^Fler val för/ }).click();
  await meal(page, 3).getByRole('button', { name: 'Töm måltiden' }).click();
  const ask = meal(page, 3).getByRole('group', { name: 'Töm måltiden' });
  await expect(ask).toBeInViewport();
  const askBox = (await ask.boundingBox())!;
  const tabsBox = (await page.locator('nav.tabs').boundingBox())!;
  expect(askBox.y + askBox.height).toBeLessThanOrEqual(tabsBox.y);
});
