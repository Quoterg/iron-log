import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

test.beforeEach(async ({ page }) => {
  // Never hit the real Open Food Facts from tests.
  await page.route('**/world.openfoodfacts.org/**', (route) => route.fulfill({ status: 404, json: { status: 0 } }));
});

test('unknown products and wrong values link to where they can be fixed', async ({ page }) => {
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await page.getByLabel('Streckkod', { exact: true }).fill('7310865004710');
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Lägg till produkten på Open Food Facts' })).toHaveAttribute(
    'href',
    'https://world.openfoodfacts.org/cgi/product.pl?type=search_or_add&action=process&code=7310865004710',
  );

  // Built-in foods: a prefilled GitHub issue.
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await expect(page.getByRole('link', { name: 'Rapportera fel i livsmedelsdata' })).toHaveAttribute(
    'href',
    /^https:\/\/github\.com\/Quoterg\/iron-log\/issues\/new\?title=Data%20error%3A%20.*slv%3A\d+/,
  );
});
