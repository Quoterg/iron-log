import { expect, test, type Page } from '@playwright/test';

// Small, old phones: no screen may be wider than the viewport (otherwise the browser zooms the
// whole page out and controls overlap). Moto G4 = 360 px CSS width.
async function expectNoHorizontalOverflow(page: Page, where: string) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, `${where}: page is ${scroll}px wide in a ${width}px viewport`).toBeLessThanOrEqual(width);
}

test('no screen overflows a 360 px phone', async ({ page }) => {
  await page.goto('./');
  await expectNoHorizontalOverflow(page, 'diary');

  await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
  await expectNoHorizontalOverflow(page, 'nutrients');

  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Livssituation').selectOption('lactating');
  await expectNoHorizontalOverflow(page, 'settings');

  await page.getByRole('button', { name: 'Anpassa mål' }).click();
  await page.getByLabel('Förval').selectOption('custom');
  await expectNoHorizontalOverflow(page, 'target editor');
  await page.goBack();

  await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
  await page.getByRole('button', { name: 'Visa alla näringsämnen' }).click();
  await expectNoHorizontalOverflow(page, 'custom food editor');
  await page.goBack();

  await page.getByRole('button', { name: 'Dagbok', exact: true }).click();
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await page.locator('.result').first().click();
  await page.getByRole('button', { name: '+ Eget mått' }).click();
  await expectNoHorizontalOverflow(page, 'food detail');
});
