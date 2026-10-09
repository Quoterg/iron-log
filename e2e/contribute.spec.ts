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
  const add = page.getByRole('link', { name: 'Lägg till produkten på Open Food Facts' });
  await expect(add).toHaveAttribute('href', 'https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=7310865004710');
  await expect(add).toHaveAttribute('rel', 'noopener noreferrer');
  // Editing the field afterwards doesn't change where the link points.
  await page.getByLabel('Streckkod', { exact: true }).fill('');
  await expect(add).toHaveAttribute('href', /code=7310865004710$/);

  await scan(page, '7310865004727');
  await expect(page.getByRole('link', { name: 'Fyll i näringsvärdena på Open Food Facts' })).toHaveAttribute(
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
