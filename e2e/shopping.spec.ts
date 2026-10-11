import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
async function logFood(page: Page, mealIndex: number, query: string, grams: string) {
  await meal(page, mealIndex).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.locator('.result').first().click();
  await page.getByLabel('Mått', { exact: true }).selectOption('g');
  await page.getByLabel('Mängd').fill(grams);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
}

test('shopping list: saved meals, planned days and own items; sections, ticking, sharing', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  // The phone's share sheet, captured.
  await page.addInitScript(() => {
    (navigator as unknown as { share: (d: { text: string }) => Promise<void> }).share = async (d) => {
      (window as unknown as { shared: string }).shared = d.text;
    };
  });
  await page.goto('./');
  await logFood(page, 0, 'havregryn', '60');
  await logFood(page, 0, 'mjölk', '200');
  await meal(page, 0).getByRole('button', { name: 'Spara som måltid' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Gröt');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  // Plan tomorrow: copy breakfast ahead (the app then shows tomorrow).
  await meal(page, 0).getByRole('button', { name: 'Kopiera måltid' }).click();
  await page.getByRole('button', { name: 'Kopiera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Imorgon' })).toBeVisible();

  await page.getByRole('button', { name: 'Inköpslista' }).click();
  const sheet = page.getByRole('dialog', { name: 'Inköpslista' });
  await expect(sheet.getByText(/Listan är tom/)).toBeVisible();

  // The saved meal twice: amounts add up (2 × 60 g oats = 120 → 150 g; 2 × 2 dl milk = 4 dl).
  await sheet.getByRole('button', { name: 'Lägg till: Gröt' }).click();
  await expect(sheet.getByText('Tillagt i listan.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Lägg till: Gröt' }).click();
  await expect(sheet.getByRole('heading', { name: 'Bröd, gryn & pasta' })).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Mejeri & ägg' })).toBeVisible();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText('150 g');
  await expect(sheet.locator('.shop-item', { hasText: /Mjölk/ })).toContainText('4 dl');

  // Planned days: tomorrow's breakfast adds to the same lines.
  await sheet.getByRole('button', { name: '+ 2 livsmedel' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText('200 g');

  // An own item lands under "Övrigt".
  await sheet.getByLabel('Egen vara').fill('Tandkräm');
  await sheet.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(sheet.getByRole('heading', { name: 'Övrigt' })).toBeVisible();

  // Tick one off; sharing leaves ticked items out.
  await sheet.locator('.shop-item', { hasText: /Mjölk/ }).getByRole('checkbox').check();
  await sheet.getByRole('button', { name: 'Dela listan' }).click();
  const shared = await page.evaluate(() => (window as unknown as { shared: string }).shared);
  expect(shared).toContain('Inköpslista');
  expect(shared).toMatch(/Bröd, gryn & pasta\n- Havregryn.*200 g/);
  expect(shared).toContain('- Tandkräm');
  expect(shared).not.toContain('Mjölk');

  // Kept on the device: reload, still there; then remove the ticked ones.
  await page.reload();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(2); // the diary has settled (buttons below move)
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  await expect(sheet.locator('.shop-item.done', { hasText: /Mjölk/ })).toBeVisible();
  await sheet.getByRole('button', { name: 'Ta bort avbockade' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Mjölk/ })).toHaveCount(0);
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toBeVisible();
});
