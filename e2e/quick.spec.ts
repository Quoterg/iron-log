import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('quick add (M47): energy and macros without a food; editable, never in search or recent', async ({ page }) => {
  await page.goto('./');
  await meal(page, 2).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: '+ Snabblogga kcal' }).click();
  const sheet = page.getByRole('dialog', { name: 'Snabblogga' });
  // Energy is needed; macros are optional.
  await sheet.getByRole('button', { name: 'Snabblogga kcal' }).click();
  await expect(sheet.getByText('Ange energin, 1–10 000 kcal.')).toBeVisible();
  await sheet.getByLabel('Namn (valfritt)').fill('Pizza ute');
  await sheet.getByLabel('Energi (kcal)').fill('900');
  await sheet.getByLabel('Protein (g)').fill('35,5');
  await sheet.getByRole('button', { name: 'Snabblogga kcal' }).click();

  // Back in the diary, in the meal it was opened from.
  const entry = meal(page, 2).locator('.entry', { hasText: 'Pizza ute' });
  await expect(entry).toContainText('1 portion');
  await expect(entry).toContainText('900 kcal');
  await expect(page.locator('.summary')).toContainText('900');
  // 35.5 g protein = 142 kcal of 900: 16 E%, not 100 % (the rest of the energy is of unknown kind).
  await expect(page.locator('.macro.m-protein')).toContainText('36 g');
  await expect(page.locator('.macro.m-protein')).toContainText('16 E%');

  // Half a portion: half the energy.
  await entry.click();
  await page.getByLabel('Mängd', { exact: true }).fill('0,5');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(entry).toContainText('450 kcal');

  // Not a food to search for, nor a recent one; kept across a reload.
  await page.reload();
  await expect(meal(page, 2).locator('.entry', { hasText: 'Pizza ute' })).toContainText('450 kcal');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await expect(page.getByRole('heading', { name: 'Senast' })).toHaveCount(0);
  await page.getByPlaceholder(/Sök livsmedel/).fill('pizza');
  await expect(page.locator('.result').first()).toBeVisible();
  await expect(page.locator('.result', { hasText: 'Pizza ute' })).toHaveCount(0);
});

test('a day can be marked complete or incomplete for the adaptive estimate (M47); one at a time', async ({ page }) => {
  await page.goto('./');
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Energimål' }).click();
  await page.getByLabel('Beräkna min förbrukning från vikt och intag').check();
  await tab(page, 'Dagbok');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: '+ Snabblogga kcal' }).click();
  await page.getByLabel('Energi (kcal)').fill('400');
  await page.getByRole('dialog').getByRole('button', { name: 'Snabblogga kcal' }).click();

  const marks = page.getByRole('group', { name: 'Hur dagen räknas i förbrukningen' });
  const complete = marks.getByRole('button', { name: /Dagen är komplett/ });
  const incomplete = marks.getByRole('button', { name: /Ofullständig dag/ });
  await incomplete.click();
  await expect(incomplete).toHaveAttribute('aria-pressed', 'true');
  await expect(complete).toHaveAttribute('aria-pressed', 'false');
  await complete.click();
  await expect(complete).toHaveAttribute('aria-pressed', 'true');
  await expect(incomplete).toHaveAttribute('aria-pressed', 'false');
  await incomplete.click();
  await page.waitForFunction(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
    const all = db.transaction('days').objectStore('days').getAll();
    const list = await new Promise<{ skip?: boolean }[]>((ok) => (all.onsuccess = () => ok(all.result)));
    db.close();
    return list.length === 1 && list[0].skip === true;
  });
  await page.reload();
  await expect(incomplete).toHaveAttribute('aria-pressed', 'true');
  // Tapping the chosen mark again: automatic.
  await incomplete.click();
  await expect(incomplete).toHaveAttribute('aria-pressed', 'false');
  await expect(complete).toHaveAttribute('aria-pressed', 'false');
});

test('a quick entry\'s food goes with its last entry (M47 review)', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: '+ Snabblogga kcal' }).click();
  await page.getByLabel('Energi (kcal)').fill('300');
  await page.getByRole('dialog').getByRole('button', { name: 'Snabblogga kcal' }).click();
  const quickFoods = () =>
    page.evaluate(async () => {
      const req = indexedDB.open('iron-log');
      const db: IDBDatabase = await new Promise((ok) => (req.onsuccess = () => ok(req.result)));
      const all = db.transaction('customFoods').objectStore('customFoods').getAll();
      const list = await new Promise<{ quick?: boolean }[]>((ok) => (all.onsuccess = () => ok(all.result)));
      db.close();
      return list.filter((f) => f.quick).length;
    });
  await expect.poll(quickFoods, { timeout: 15_000 }).toBe(1);
  await meal(page, 0).locator('.entry').click();
  await page.getByRole('button', { name: 'Ta bort', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(0);
  await expect.poll(quickFoods, { timeout: 15_000 }).toBe(0);
});
