import { expect, test, type Page } from '@playwright/test';

// CSP checks that need a (fake) camera or the real service worker — see csp.spec.ts for the rest.

// A fake camera for the whole file (launch options can't be set per group).
test.use({
  launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
  permissions: ['camera'],
});

async function watch(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
}
const violations = (page: Page) => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

test.describe('barcode scanner fallback (zxing WebAssembly) under the CSP', () => {
  test('a fake camera starts and the WebAssembly detector loads without violations', async ({ page }) => {
    await watch(page);
    // Force the fallback: no built-in BarcodeDetector.
    await page.addInitScript(() => delete (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector);
    await page.goto('./');
    await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
    await page.getByRole('button', { name: /Skanna streckkod/ }).click();
    // "Rikta kameran…" appears only once the camera runs and the detector has been created.
    await expect(page.getByRole('status')).toContainText('Rikta kameran mot streckkoden', { timeout: 20_000 });
    expect(await violations(page)).toEqual([]);
  });
});

test('pages served by the service worker (also offline) keep the policy without violations', async ({ page, context }) => {
  await watch(page);
  await page.goto('./');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); // now served through the service worker
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await expect(page.locator('.result').first()).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
