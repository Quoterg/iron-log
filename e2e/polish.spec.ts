import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const search = (page: Page) => page.getByPlaceholder(/Sök livsmedel/);

async function logFood(page: Page, query: string, name: string) {
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await search(page).fill(query);
  await page.getByRole('dialog').locator('.result', { hasText: name }).first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('polish (M68): singular counts, results per 100 g, a useful no-match line, quick add starts at energy', async ({ page, context }) => {
  await page.goto('./');
  await logFood(page, 'havregryn', 'Havregryn fullkorn');
  await logFood(page, 'ägg', 'Ägg kokt');
  await meal(page, 0).getByRole('button', { name: /^Fler val för/ }).click();
  await meal(page, 0).getByRole('button', { name: 'Spara som måltid' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Min frukost');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();

  // "1 måltid", not "1 måltider".
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.locator('.settings-menu .entry', { hasText: 'Mina livsmedel, recept & måltider' })).toContainText('0 livsmedel · 0 recept · 1 måltid');
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();

  // "Välj delar" lines up with the saved meal's name, not the screen edge.
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  const name = await page.locator('.result', { hasText: 'Min frukost' }).locator('.entry-name').boundingBox();
  const parts = await page.getByRole('button', { name: 'Välj delar' }).boundingBox();
  const text = await page.getByRole('button', { name: 'Välj delar' }).evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    return r.getBoundingClientRect().x;
  });
  expect(parts!.x).toBeGreaterThanOrEqual(0);
  expect(Math.abs(text - name!.x)).toBeLessThan(2);

  // Results say their values are per 100 g.
  await search(page).fill('kvarg');
  await expect(page.getByRole('heading', { name: 'Per 100 g' })).toBeVisible();

  // No match: something to try. Offline: the search still works, the barcode lookup is what needs a connection.
  await search(page).fill('xyzzy');
  await expect(page.getByText('Inga träffar')).toBeVisible();
  await expect(page.getByText(/Prova ett annat ord/)).toBeVisible();
  await context.setOffline(true);
  await search(page).fill('xyzzq');
  await expect(page.getByText(/att slå upp en streckkod kräver uppkoppling/)).toBeVisible();
  await context.setOffline(false);

  // Quick add: the keyboard opens at energy; the macro fields stay in line.
  await search(page).fill('');
  await page.getByRole('button', { name: '+ Snabblogga kcal' }).click();
  await expect(page.getByLabel('Energi (kcal)')).toBeFocused();
  const ys = await Promise.all(['Protein (g)', 'Kolhydrater (g)', 'Fett (g)'].map(async (l) => (await page.getByLabel(l).boundingBox())!.y));
  expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
});
