import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

const PRODUCT = {
  status: 1,
  product: {
    code: '7310865004703',
    product_name_sv: 'Grekisk yoghurt 10%',
    brands: 'Arla',
    nutriments: { 'energy-kcal_100g': 120, proteins_100g: 4, carbohydrates_100g: 4, fat_100g: 10, salt_100g: 0.1 },
  },
};
// A product OFF knows, but without nutrition facts.
const NO_DATA = { status: 1, product: { code: '7310865004727', product_name_sv: 'Okänd kaka', nutriments: {} } };

test.beforeEach(async ({ page }) => {
  // Never hit the real Open Food Facts from tests.
  await page.route('**/world.openfoodfacts.org/**', (route) => {
    const url = route.request().url();
    if (url.includes('7310865004703')) return route.fulfill({ json: PRODUCT });
    if (url.includes('7310865004727')) return route.fulfill({ json: NO_DATA });
    return route.fulfill({ status: 404, json: { status: 0 } });
  });
});

const scan = async (page: Page, code: string) => {
  await page.getByLabel('Streckkod', { exact: true }).fill(code);
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
};

test('scanned products link to Open Food Facts to add, complete or fix them', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();

  await scan(page, '7310865004710');
  await expect(page.getByRole('button', { name: 'Lägg till produkten på Open Food Facts' })).toBeVisible(); // in-app (M20b)
  const add = page.getByRole('link', { name: 'Eller gör det på Open Food Facts webbplats' });
  await expect(add).toHaveAttribute('href', 'https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=7310865004710');
  await expect(add).toHaveAttribute('rel', 'noopener noreferrer');
  // Editing the field afterwards doesn't change where the link points.
  await page.getByLabel('Streckkod', { exact: true }).fill('');
  await expect(add).toHaveAttribute('href', /code=7310865004710$/);

  await scan(page, '7310865004727');
  await expect(page.getByRole('button', { name: 'Fyll i näringsvärdena på Open Food Facts' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Eller gör det på Open Food Facts webbplats' })).toHaveAttribute(
    'href',
    'https://world.openfoodfacts.org/product/7310865004727',
  );

  await scan(page, '7310865004703');
  await expect(page.getByRole('link', { name: 'Rätta eller komplettera på Open Food Facts' })).toHaveAttribute(
    'href',
    'https://world.openfoodfacts.org/product/7310865004703',
  );
  await expect(page.getByRole('link', { name: 'Rapportera fel i livsmedelsdata' })).toHaveCount(0);
});

test('built-in foods get a data-error report link; custom foods do not', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await expect(page.getByRole('link', { name: 'Rapportera fel i livsmedelsdata' })).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/Quoterg\/iron-log\/issues\/new\?title=Data%20error%3A%20.*slv%3A\d+/,
  );

  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('Min gröt');
  await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
  await page.getByLabel('Protein (g)', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Spara' }).click();
  await expect(page.getByRole('heading', { name: /Min gröt/ })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Rapportera fel i livsmedelsdata' })).toHaveCount(0);
});

test('add an unknown product to Open Food Facts from the app, then log it', async ({ page }) => {
  // OFF write API, mocked: never touch the real database from tests.
  const sent: Record<string, string>[] = [];
  await page.route('**/world.openfoodfacts.org/cgi/**', async (route) => {
    const req = route.request();
    const url = req.url();
    if (url.endsWith('product_jqm2.pl')) {
      const fields = Object.fromEntries(new URLSearchParams(req.postData() ?? ''));
      const body = req.postData() ?? '';
      sent.push({ ...fields, raw: body });
      const wrong = body.includes('fel-losenord');
      return route.fulfill({ json: wrong ? { status: 0, status_verbose: 'Incorrect user name or password' } : { status: 1 } });
    }
    return route.fulfill({ json: { status: 'status ok' } });
  });

  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await scan(page, '7310865004710');
  await page.getByRole('button', { name: 'Lägg till produkten på Open Food Facts' }).click();

  await page.getByLabel('Namn', { exact: true }).fill('Havrekaka');
  await page.getByLabel('Varumärke').fill('Bageriet');
  await page.getByLabel('Energi (kcal)').fill('450');
  await page.getByLabel('Protein (g)').fill('7');
  await page.getByLabel('Salt (g)').fill('0,8');
  await page.getByLabel('Användarnamn').fill('anna');
  await page.getByLabel('Lösenord').fill('fel-losenord');
  await page.getByRole('button', { name: 'Skicka och lägg till' }).click();
  await expect(page.getByRole('alert')).toContainText('Fel användarnamn eller lösenord');

  await page.getByLabel('Lösenord').fill('ratt-losenord');
  await page.getByRole('button', { name: 'Skicka och lägg till' }).click();
  await expect(page.getByRole('heading', { name: /Havrekaka \(Bageriet\)/ })).toBeVisible();
  const last = sent.at(-1)!.raw;
  for (const part of ['7310865004710', 'Havrekaka', 'Bageriet', '450', 'anna']) expect(last).toContain(part);
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(meal(page, 0).locator('.entry')).toContainText('Havrekaka');
});
