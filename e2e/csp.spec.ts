import { expect, test, type Page } from '@playwright/test';

// The Content-Security-Policy must not block anything the app does: walk the main flows and fail on
// any violation (docs/SECURITY-REVIEW.md, S2).
test.use({ serviceWorkers: 'block' });

async function watch(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('the policy is in the built page and the main flows run without violations', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await watch(page);
  await page.goto('./');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'self'/);

  // Search (worker + data files), log, nutrients and nutrient detail (top-foods file).
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await tab(page, 'Näringsämnen');
  await page.locator('.bar-btn', { hasText: 'Järn' }).click();
  await expect(page.getByRole('heading', { name: 'Rikast i livsmedelsdatabasen' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /‹/ }).click();

  // Body log with chart.
  await tab(page, 'Kropp');
  await page.getByLabel('Vikt (kg)', { exact: true }).fill('80');
  await page.getByRole('button', { name: 'Spara', exact: true }).click();

  // Settings: recipe editor, exports (blob downloads), a lazily loaded language.
  await tab(page, 'Inställningar');
  await page.getByRole('button', { name: /Skapa recept/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /‹/ }).click();
  for (const name of [/Exportera säkerhetskopia/, /Exportera dagbok/]) {
    await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()]);
  }
  await page.getByLabel('Språk').selectOption('de');
  await expect(page.getByRole('button', { name: 'Tagebuch', exact: true })).toBeVisible();
  await page.getByLabel('Sprache').selectOption('sv');

  // Sync: creating a code (WebRTC) and drawing the QR.
  await page.getByRole('button', { name: 'Synka', exact: true }).click();
  await page.getByRole('button', { name: 'Starta här (visa kod)' }).click();
  await expect(page.getByRole('img', { name: /QR-kod/ })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('scan → Open Food Facts lookup and upload run without violations', async ({ page }) => {
  await page.route('**/world.openfoodfacts.org/**', (route) =>
    route.request().url().includes('/cgi/')
      ? route.fulfill({ json: route.request().url().endsWith('product_jqm2.pl') ? { status: 1 } : { status: 'status ok' } })
      : route.fulfill({ status: 404, json: { status: 0 } }),
  );
  await watch(page);
  await page.goto('./');
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await page.getByLabel('Streckkod', { exact: true }).fill('7310865004710');
  await page.getByRole('button', { name: 'Sök', exact: true }).click();
  await page.getByRole('button', { name: 'Lägg till produkten på Open Food Facts' }).click();
  await page.getByLabel('Namn', { exact: true }).fill('Havrekaka');
  await page.getByLabel('Energi (kcal)').fill('450');
  await page.getByLabel('Användarnamn').fill('anna');
  await page.getByLabel('Lösenord').fill('x');
  await page.getByRole('button', { name: 'Skicka och lägg till' }).click();
  await expect(page.getByRole('heading', { name: /Havrekaka/ })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});

test('the static pages carry a no-script policy and render without violations', async ({ page }) => {
  await watch(page);
  for (const url of ['./privacy.html', './about.html']) {
    await page.goto(url);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', /default-src 'none'/);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(await violations(page), url).toEqual([]);
  }
});
