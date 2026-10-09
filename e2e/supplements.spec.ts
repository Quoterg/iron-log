import { expect, test, type Page } from '@playwright/test';

/** Entries are written to IndexedDB asynchronously: reload only once the store has `n` of them. */
const storedEntries = (page: Page, n: number) =>
  page.waitForFunction(async (n) => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const count = db.transaction('entries').objectStore('entries').count();
    const c = await new Promise<number>((ok) => (count.onsuccess = () => ok(count.result)));
    db.close();
    return c === n;
  }, n);

const card = (page: Page, title: string) => page.locator('section.card', { has: page.getByRole('heading', { name: title, exact: true }) });

test('create a daily supplement, tick it off, and see it in the nutrient totals', async ({ page }) => {
  await page.goto('./');
  const supps = card(page, 'Kosttillskott');
  await supps.getByRole('button', { name: '+ Lägg till', exact: true }).click();

  // Amounts per unit, as on the label.
  await page.getByLabel('Namn', { exact: true }).fill('D-vitamin');
  await expect(page.getByLabel('Enhet', { exact: true })).toHaveValue('tablett');
  await page.getByLabel('Antal per dag', { exact: true }).fill('2');
  await page.getByLabel('Vitamin D (µg)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Spara' }).click();

  await expect(supps).toContainText('D-vitamin');
  await expect(supps).toContainText('2 tablett/dag');

  // One tap logs the daily dose; it is shown in the card, not under a meal.
  const check = supps.getByRole('checkbox', { name: 'Tagen: D-vitamin' });
  await check.check();
  await expect(check).toBeChecked();
  await expect(supps.getByRole('button', { name: '2 tablett', exact: true })).toBeVisible();
  await expect(page.locator('.meal .entry')).toHaveCount(0);

  // 2 tablets × 10 µg = 20 µg vitamin D.
  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
  const vitD = page.locator('.bar').filter({ has: page.getByText('Vitamin D', { exact: true }) });
  await expect(vitD).toContainText('20 / 10 µg');

  // Persisted; unticking removes the dose again.
  await storedEntries(page, 1);
  await page.reload();
  await expect(check).toBeChecked();
  await check.uncheck();
  await expect(check).not.toBeChecked();
  await storedEntries(page, 0);
  await page.reload();
  await expect(check).not.toBeChecked();

  // The name opens the supplement editor (per-unit values), also once taken.
  await check.check();
  await supps.getByRole('button', { name: /D-vitamin/ }).click();
  await expect(page.getByRole('heading', { name: 'Ändra kosttillskott' })).toBeVisible();
  await expect(page.getByLabel('Vitamin D (µg)', { exact: true })).toHaveValue('10');
  await page.getByRole('dialog').getByRole('button', { name: /‹/ }).click();

  // An as-needed supplement (0 per day) gets "+1" instead of a checkbox.
  await supps.getByRole('button', { name: '+ Lägg till', exact: true }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Magnesium');
  await page.getByLabel('Antal per dag', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Spara' }).click();
  await supps.getByRole('button', { name: '+1 tablett Magnesium' }).click();
  await supps.getByRole('button', { name: '+1 tablett Magnesium' }).click();
  await expect(supps.getByRole('listitem').filter({ hasText: 'Magnesium' }).getByRole('button', { name: '2 tablett', exact: true })).toBeVisible();
  await expect(supps.getByRole('checkbox', { name: 'Tagen: Magnesium' })).toHaveCount(0);

  // Found in search with its badge.
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('D-vitamin');
  await expect(page.locator('.badge', { hasText: 'Tillskott' })).toBeVisible();
});
