import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Automated accessibility audit (axe-core, WCAG 2.1 A/AA rules) of the main screens, in light
// and dark mode. Catches contrast, names, labels, landmarks and ARIA misuse — not a substitute
// for a screen-reader pass, but keeps regressions out.
const audit = async (page: Page) => {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = res.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length}× ${v.nodes[0]?.target.join(' ')} — ${v.help}`);
  expect(summary, summary.join('\n')).toEqual([]);
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme });

    test('diary, search, food, nutrients, body, settings pass axe', async ({ page }) => {
      await page.goto('./');
      await expect(page.locator('.meal').first()).toBeVisible();
      await audit(page);

      await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
      await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
      await expect(page.locator('.result').first()).toBeVisible();
      await audit(page);

      await page.locator('.result').first().click();
      await expect(page.getByLabel('Mängd')).toBeVisible();
      await audit(page);
      await page.getByRole('button', { name: 'Lägg till', exact: true }).click();

      await page.getByRole('button', { name: 'Näringsämnen', exact: true }).click();
      await audit(page);

      // Nutrient detail (target, sources, richest foods).
      await page.locator('.bar-btn', { hasText: 'Järn' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
      await page.getByRole('dialog').getByRole('button', { name: /‹/ }).click();

      // Body log with two measurements (chart drawn).
      await page.getByRole('button', { name: 'Kropp', exact: true }).click();
      for (const [days, kg] of [[3, '80'], [1, '79,4']] as const) {
        const d = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
        await page.getByLabel('Datum').fill(d);
        await page.getByLabel('Vikt (kg)', { exact: true }).fill(kg);
        await page.getByRole('button', { name: 'Spara', exact: true }).click();
      }
      await expect(page.locator('svg').first()).toBeVisible();
      await audit(page);

      await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
      await audit(page);
    });

    test('static pages (privacy, about) pass axe', async ({ page }) => {
      await page.goto('./privacy.html');
      await audit(page);
      await page.goto('./about.html');
      await audit(page);
    });

    test('sheets: activity, supplement and recipe editors pass axe', async ({ page }) => {
      await page.goto('./');
      const card = (title: string) => page.locator('section.card', { has: page.getByRole('heading', { name: title, exact: true }) });
      await card('Aktivitet').getByRole('button', { name: /Lägg till/ }).click();
      await expect(page.getByLabel('Minuter')).toBeVisible();
      await audit(page);
      await page.getByRole('dialog').getByRole('button', { name: /‹/ }).click();

      await card('Kosttillskott').getByRole('button', { name: /Lägg till/ }).click();
      await expect(page.getByLabel('Enhet', { exact: true })).toBeVisible();
      await audit(page);
      await page.getByRole('dialog').getByRole('button', { name: /‹/ }).click();

      await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
      await page.getByRole('button', { name: /Skapa recept/ }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
    });
  });
}

// WCAG 1.4.4: text resized to 200 % must not need horizontal scrolling on a 360 px phone.
test('200 % text size: no horizontal overflow on the main screens', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('./');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  // Compare with the device width: overflow makes mobile browsers zoom out (innerWidth grows too).
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - 360);
  await expect(page.locator('.meal').first()).toBeVisible();
  expect(await overflow(), 'Dagbok').toBeLessThanOrEqual(0);
  for (const tab of ['Näringsämnen', 'Kropp', 'Inställningar']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    expect(await overflow(), tab).toBeLessThanOrEqual(0);
  }
});
