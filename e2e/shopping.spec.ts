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

  // Planned days (shown because something is planned; after "last 7 days"): adds to the same lines.
  await sheet.getByRole('button', { name: '+ 2 livsmedel' }).nth(1).click();
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

test('restock from the last 7 days; shelf prices give an estimated total and the biggest items first', async ({ page }) => {
  test.slow();
  await page.goto('./');
  await logFood(page, 0, 'havregryn', '60');
  await logFood(page, 0, 'mjölk', '500');
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  const sheet = page.getByRole('dialog', { name: 'Inköpslista' });
  // Looks back: what was eaten this week (2 foods). Nothing is planned ahead, so no such button.
  await expect(sheet.getByRole('heading', { name: 'Det du åt de senaste 7 dagarna' })).toBeVisible();
  await sheet.getByRole('button', { name: '+ 2 livsmedel' }).click();
  await expect(sheet.getByRole('button', { name: '+ 2 livsmedel' })).toHaveCount(1);
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText('60 g');

  // Shelf prices: oats 21,33 kr/kg, milk 15 kr/l → ~1 kr and ~7 kr for the amounts on the list.
  const openPrice = async (name: RegExp) => {
    const line = sheet.locator('.shop-line', { hasText: name });
    await line.getByRole('button', { name: 'Pris', exact: true }).click();
    return line;
  };
  let line = await openPrice(/Havregryn/);
  await line.getByLabel('Jämförpris').fill('21,33');
  await line.getByRole('button', { name: 'Spara pris' }).click();
  await expect(sheet.locator('.shop-total')).toContainText('Uppskattat totalt: ~1 kr');
  await expect(sheet.locator('.shop-total')).toContainText('1 utan pris');
  line = await openPrice(/Mjölk/);
  await line.getByLabel('Jämförpris').fill('15');
  await line.getByLabel('Mått').selectOption('l');
  await line.getByRole('button', { name: 'Spara pris' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Mjölk/ })).toContainText('~7 kr');
  await expect(sheet.locator('.shop-total')).not.toContainText('utan pris');

  // An own item with its price; the biggest items come first in that view.
  await sheet.getByLabel('Egen vara').fill('Tandkräm');
  await sheet.getByRole('button', { name: 'Lägg till', exact: true }).click();
  line = await openPrice(/Tandkräm/);
  await line.getByLabel('Pris (kr)').fill('25');
  await line.getByRole('button', { name: 'Spara pris' }).click();
  await expect(sheet.locator('.shop-total')).toContainText('~34 kr');
  await sheet.getByRole('button', { name: 'Största posterna' }).click();
  await expect(sheet.locator('.shop-item').first()).toContainText(/Tandkräm.*25 kr · 74 %/);
  await expect(sheet.locator('.shop-item').nth(1)).toContainText('Mjölk');

  // Prices are remembered per food (and synced/backed up like the list).
  await page.reload();
  await expect(page.locator('.meal').first().locator('.entry')).toHaveCount(2);
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText('~1 kr');

  // The editor shows what is stored (kr/kg), and a mistyped price can be removed.
  line = await openPrice(/Havregryn/);
  await expect(line.getByLabel('Jämförpris')).toHaveValue('21,33');
  await line.getByRole('button', { name: 'Ta bort pris' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).not.toContainText('kr');
  await expect(sheet.locator('.shop-total')).toContainText('1 utan pris');
});

test('offer links for the biggest items open the chosen stores; nothing is fetched', async ({ page }) => {
  test.slow();
  const external: string[] = [];
  page.on('request', (r) => !r.url().startsWith('http://localhost') && external.push(r.url()));
  await page.goto('./');
  await logFood(page, 0, 'havregryn', '60');
  await logFood(page, 0, 'mjölk', '500');
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  const sheet = page.getByRole('dialog', { name: 'Inköpslista' });
  await sheet.getByRole('button', { name: '+ 2 livsmedel' }).click();
  const milk = sheet.locator('.shop-line', { hasText: /Mjölk/ });
  await milk.getByRole('button', { name: 'Pris', exact: true }).click();
  await milk.getByLabel('Jämförpris').fill('15');
  await milk.getByRole('button', { name: 'Spara pris' }).click();

  // Only in "Största posterna", only for priced lines: links to the default stores.
  await expect(sheet.locator('.offer-links')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Största posterna' }).click();
  const links = milk.locator('.offer-links a');
  await expect(links).toHaveText(['Willys', 'ICA', 'Coop', 'Lidl']);
  await expect(milk.getByRole('link', { name: 'Willys' })).toHaveAttribute('href', 'https://www.willys.se/sok?q=Mj%C3%B6lk');
  await expect(milk.getByRole('link', { name: 'ICA' })).toHaveAttribute('href', 'https://www.ica.se/erbjudanden/');
  await expect(milk.getByRole('link', { name: 'Willys' })).toHaveAttribute('target', '_blank');
  await expect(sheet.locator('.shop-line', { hasText: /Havregryn/ }).locator('.offer-links')).toHaveCount(0);

  // My stores: Hemköp on, ICA off — kept after a reload (a synced setting).
  await sheet.getByRole('button', { name: 'Hemköp' }).click();
  await sheet.getByRole('button', { name: 'ICA', exact: true }).click();
  await expect(links).toHaveText(['Willys', 'Coop', 'Lidl', 'Hemköp']);
  await page.reload();
  await expect(page.locator('.meal').first().locator('.entry')).toHaveCount(2);
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  await sheet.getByRole('button', { name: 'Största posterna' }).click();
  await expect(sheet.locator('.shop-line', { hasText: /Mjölk/ }).locator('.offer-links a')).toHaveText(['Willys', 'Coop', 'Lidl', 'Hemköp']);
  expect(external).toEqual([]); // the app itself never contacted a store
});

test('food cost (M33): off by default; on, typical prices (≈) fill lines without an own price', async ({ page }) => {
  test.slow();
  const external: string[] = [];
  page.on('request', (r) => !r.url().startsWith('http://localhost') && external.push(r.url()));
  await page.goto('./');
  await logFood(page, 0, 'havregryn', '60');
  await logFood(page, 0, 'mjölk', '500');
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  const sheet = page.getByRole('dialog', { name: 'Inköpslista' });
  await sheet.getByRole('button', { name: '+ 2 livsmedel' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText('60 g');
  await expect(sheet.locator('.shop-item', { hasText: /≈/ })).toHaveCount(0); // off by default
  await page.goBack();

  // Settings → Matkostnad.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Visa uppskattade priser (typpriser)').check();
  await expect(page.getByText(/Typpriser: jämförpriser från willys\.se/)).toBeVisible();
  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await page.getByRole('button', { name: 'Inköpslista' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText(/≈\d/);
  await expect(sheet.locator('.shop-item', { hasText: /Mjölk/ })).toContainText(/≈\d/);
  await expect(sheet.locator('.shop-total')).toContainText(/varav ≈\d+ kr typpriser/);

  // An own price wins over the typical one; the editor shows the typical price as a hint.
  const oats = sheet.locator('.shop-line', { hasText: /Havregryn/ });
  await oats.getByRole('button', { name: 'Pris', exact: true }).click();
  await expect(oats.getByText(/≈ typpris \d+ kr\/kg/)).toBeVisible();
  await oats.getByLabel('Jämförpris').fill('30');
  await oats.getByRole('button', { name: 'Spara pris' }).click();
  await expect(sheet.locator('.shop-item', { hasText: /Havregryn/ })).toContainText('~2 kr');
  await expect(sheet.locator('.shop-item', { hasText: /Mjölk/ })).toContainText(/≈\d/);
  expect(external).toEqual([]); // the table comes with the app
});
