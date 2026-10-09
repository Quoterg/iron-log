import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Accessibility checks, kept as tests so regressions fail CI:
// - axe-core (WCAG 2.1 A/AA rules) on every screen and sheet, in light and dark mode — catches
//   contrast, names, labels, landmarks and ARIA misuse (not a substitute for a screen-reader pass);
// - 200 % text size (WCAG 1.4.4) without horizontal scrolling on a 360 px phone.
// One test per screen: failures name the screen, and no test runs near the timeout on a throttled CPU.

const audit = async (page: Page) => {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const summary = res.violations.map(
    (v) =>
      `${v.id} (${v.impact}, ${v.nodes.length}×): ${v.help}\n` +
      v.nodes
        .slice(0, 3)
        .map((n) => `  ${n.target.join(' ')} — ${n.failureSummary?.replace(/\s+/g, ' ')}`)
        .join('\n'),
  );
  expect(summary, summary.join('\n')).toEqual([]);
};

/** A local calendar date (the app's day), `n` days ago. */
const localDate = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const card = (page: Page, title: string) => page.locator('section.card', { has: page.getByRole('heading', { name: title, exact: true }) });
const dialog = (page: Page) => page.getByRole('dialog');

/** Every screen and sheet: how to open it, and what shows it has rendered. */
const SCREENS: Record<string, (page: Page) => Promise<void>> = {
  'diary (empty, first run)': async (page) => {
    await expect(page.locator('.meal').first()).toBeVisible();
  },
  'food search': async (page) => {
    await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
    await page.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
    await expect(page.locator('.result').first()).toBeVisible();
  },
  'food amount': async (page) => {
    await SCREENS['food search'](page);
    await page.locator('.result').first().click();
    await expect(page.getByLabel('Mängd')).toBeVisible();
  },
  'edit entry': async (page) => {
    await SCREENS['food amount'](page);
    await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
    await page.locator('.meal .entry').first().click();
    await expect(page.getByLabel('Måltid')).toBeVisible();
  },
  'custom food editor': async (page) => {
    await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
    await page.getByPlaceholder(/Sök livsmedel/).fill('Min gröt');
    await page.getByRole('button', { name: /Skapa eget livsmedel/ }).click();
    await expect(page.getByLabel('Namn', { exact: true })).toBeVisible();
  },
  'barcode scan': async (page) => {
    await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
    await page.getByRole('button', { name: /Skanna streckkod/ }).click();
    await expect(page.getByLabel('Streckkod', { exact: true })).toBeVisible();
  },
  'copy day': async (page) => {
    await SCREENS['edit entry'](page);
    await dialog(page).getByRole('button', { name: /‹/ }).click();
    await page.getByRole('button', { name: 'Kopiera hela dagen' }).click();
    await expect(dialog(page)).toBeVisible();
  },
  nutrients: async (page) => {
    await tab(page, 'Näringsämnen');
    await expect(page.getByRole('button', { name: 'Anpassa mål' })).toBeVisible();
  },
  'nutrient detail': async (page) => {
    await SCREENS.nutrients(page);
    await page.locator('.bar-btn', { hasText: 'Järn' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Rikast i livsmedelsdatabasen' })).toBeVisible();
  },
  'targets editor': async (page) => {
    await SCREENS.nutrients(page);
    await page.getByRole('button', { name: 'Anpassa mål' }).click();
    await expect(dialog(page).locator('table.targets').first()).toBeVisible();
  },
  'body log with chart': async (page) => {
    await tab(page, 'Kropp');
    for (const [days, kg] of [[3, '80'], [1, '79,4']] as const) {
      await page.getByLabel('Datum').fill(localDate(days));
      await page.getByLabel('Vikt (kg)', { exact: true }).fill(kg);
      await page.getByRole('button', { name: 'Spara', exact: true }).click();
    }
    await expect(page.locator('main svg').first()).toBeVisible();
  },
  'settings (profile, sources, your data)': async (page) => {
    await tab(page, 'Inställningar');
    await expect(page.getByLabel('Språk')).toBeVisible();
  },
  'activity sheet': async (page) => {
    await card(page, 'Aktivitet').getByRole('button', { name: /Lägg till/ }).click();
    await expect(page.getByLabel('Minuter')).toBeVisible();
  },
  'supplement editor': async (page) => {
    await card(page, 'Kosttillskott').getByRole('button', { name: /Lägg till/ }).click();
    await expect(page.getByLabel('Enhet', { exact: true })).toBeVisible();
  },
  'recipe editor': async (page) => {
    await tab(page, 'Inställningar');
    await page.getByRole('button', { name: /Skapa recept/ }).click();
    await expect(dialog(page)).toBeVisible();
  },
};
const PAGES = { 'privacy page': './privacy.html', 'about page': './about.html' };

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`axe, ${scheme} mode`, () => {
    test.use({ colorScheme: scheme });
    for (const [name, show] of Object.entries(SCREENS)) {
      test(name, async ({ page }) => {
        await page.goto('./');
        await show(page);
        await audit(page);
      });
    }
    for (const [name, url] of Object.entries(PAGES)) {
      test(name, async ({ page }) => {
        await page.goto(url);
        await audit(page);
      });
    }
  });
}

// Layout doesn't depend on the colour scheme: one pass, light mode.
test.describe('200 % text size, 360 px wide: no horizontal scrolling', () => {
  // Compare with the device width: overflow makes mobile browsers zoom out (innerWidth grows too).
  const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - 360);
  const big = (page: Page) => page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  for (const [name, show] of Object.entries(SCREENS)) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto('./');
      await big(page);
      await show(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }
  for (const [name, url] of Object.entries(PAGES)) {
    test(name, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(url);
      await big(page);
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    });
  }
});
