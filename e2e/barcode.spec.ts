import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

const PRODUCT = {
  status: 1,
  product: {
    code: '7310865004703',
    product_name_sv: 'Grekisk yoghurt 10%',
    brands: 'Arla',
    serving_quantity: 150,
    nutriments: { 'energy-kcal_100g': 120, proteins_100g: 4, carbohydrates_100g: 4, fat_100g: 10, salt_100g: 0.1 },
  },
};

test.beforeEach(async ({ page }) => {
  // Never hit the real Open Food Facts from tests.
  await page.route('**/world.openfoodfacts.org/**', (route) => {
    const url = route.request().url();
    const body = url.includes('7310865004703') ? PRODUCT : { status: 0, status_verbose: 'product not found' };
    return route.fulfill({ status: url.includes('7310865004703') ? 200 : 404, json: body });
  });
});

test('look up a product by barcode, log it, and find it in search later', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();

  // Headless browser: no camera → manual entry.
  await expect(page.getByRole('status')).toContainText(/Kameran är inte tillgänglig|Rikta kameran|Startar/);
  await page.getByLabel('Streckkod', { exact: true }).fill('7310865004702'); // wrong check digit
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ogiltig streckkod');

  await page.getByLabel('Streckkod', { exact: true }).fill('7310865004703');
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Grekisk yoghurt 10% \(Arla\)/ })).toBeVisible();
  await expect(page.getByLabel('Mått', { exact: true })).toHaveValue('portion');
  await expect(page.getByText(/Open Food Facts \(ODbL\), streckkod 7310865004703/)).toBeVisible();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Grekisk yoghurt.*1 portion.*180 kcal/);

  // Cached locally: searchable, marked, and available after reload without the network.
  await page.unroute('**/world.openfoodfacts.org/**');
  await page.route('**/world.openfoodfacts.org/**', (route) => route.abort());
  await expect(page.getByRole('button', { name: 'Idag' })).toBeVisible();
  await page.reload();
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('grekisk');
  const hit = page.locator('.result', { hasText: 'Grekisk yoghurt 10%' });
  await expect(hit).toContainText('Streckkod');
  await page.goBack();
  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await page.getByLabel('Streckkod', { exact: true }).fill('7310865004703');
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Grekisk yoghurt/ })).toBeVisible();
});

test('unknown products offer to create a custom food', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await page.getByLabel('Streckkod', { exact: true }).fill('96385074');
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('finns inte i Open Food Facts');
  await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
  await expect(page.getByLabel('Namn', { exact: true })).toBeVisible();
});

test('find scanned products again (M36): by the package words or barcode digits, or in the scanned list', async ({ page }) => {
  await page.unroute('**/world.openfoodfacts.org/**');
  await page.route('**/world.openfoodfacts.org/**', (route) =>
    route.fulfill({
      json: {
        status: 1,
        product: {
          ...PRODUCT.product,
          product_name_sv: 'Pro+ Vanilj 0,2%',
          brands: 'Lindahls',
          generic_name_sv: 'Proteinkvarg med vaniljsmak',
          categories: 'Mejeriprodukter, Färskost, Kvarg',
        },
      },
    }),
  );
  await page.goto('./');
  // An older scan, saved before M36 (no search words): still findable by its barcode.
  await page.evaluate(async () => {
    const req = indexedDB.open('iron-log');
    const db: IDBDatabase = await new Promise((ok, err) => ((req.onsuccess = () => ok(req.result)), (req.onerror = err)));
    const tx = db.transaction('offFoods', 'readwrite');
    tx.objectStore('offFoods').put({ ref: 'off:7350042716514', sv: 'Hjärtekrossare Mint Original', en: null, per100g: [390], fetchedAt: 1 });
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  await page.reload();
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await page.getByLabel('Streckkod', { exact: true }).fill('7310865004703');
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText(/Pro\+ Vanilj/);

  await meal(page, 1).getByRole('button', { name: /Lägg till/ }).click();
  const search = page.getByPlaceholder(/Sök livsmedel/);
  for (const q of ['proteinkvarg', 'lindahls', '4703']) {
    await search.fill(q);
    await expect(page.locator('.result', { hasText: 'Pro+ Vanilj' }), q).toBeVisible();
  }
  await search.fill('6514');
  await expect(page.locator('.result', { hasText: 'Hjärtekrossare' })).toBeVisible();

  // Before typing: every scanned product, most recently used first.
  await search.fill('');
  const toggle = page.getByRole('button', { name: /Skannade varor \(2\)/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  const scanned = page.locator('.results').last().locator('.result');
  await expect(scanned).toHaveCount(2);
  await expect(scanned.first()).toContainText('Pro+ Vanilj');
  await scanned.nth(1).click();
  await expect(page.getByRole('heading', { name: /Hjärtekrossare/ })).toBeVisible();
});
