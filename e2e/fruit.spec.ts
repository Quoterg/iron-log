import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const iso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test('fruit in season is off by default; when on, a week of fruit for the chosen gaps, from where the user allows', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  // A week of white bread (slv:202) and oats (slv:702): no vitamin C, little folate and potassium.
  const entries = Array.from({ length: 7 }, (_, i) => [
    { id: `b${i}`, date: iso(-i), meal: 'breakfast', foodRef: 'slv:202', grams: 80, createdAt: 1000 + i },
    { id: `o${i}`, date: iso(-i), meal: 'lunch', foodRef: 'slv:702', grams: 60, createdAt: 2000 + i },
  ]).flat();
  await tab(page, 'Inställningar');
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;

  // Off by default.
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Att tänka på' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Frukt i säsong' })).toHaveCount(0);

  // On, with its sources named in Settings.
  await tab(page, 'Inställningar');
  await page.getByLabel(/Föreslå frukt i säsong/).check();
  await expect(page.getByText(/Säsonger från SCB:s importstatistik/)).toBeVisible();
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  const card = page.locator('section.fruit');
  await expect(card.getByRole('heading', { name: 'Frukt i säsong' })).toBeVisible();

  // The whole world: some fruit is in season every month. vitamin C is among the first goals.
  const reach = card.getByRole('group', { name: 'Varifrån' });
  await expect(reach.getByRole('button', { name: 'Sverige + Europa' })).toHaveAttribute('aria-pressed', 'true');
  await reach.getByRole('button', { name: 'Hela världen' }).click();
  await expect(reach.getByRole('button', { name: 'Hela världen' })).toHaveAttribute('aria-pressed', 'true');
  const vitC = card.getByRole('button', { name: 'Vitamin C', exact: true });
  await expect(vitC).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });
  await expect(card.getByText(/^En vecka i \w+:$/)).toBeVisible();
  await expect(card.locator('.result').first()).toContainText(/\d+ (st|dl) · \d+ g · /);
  await expect(card.getByText(/^Vitamin C: 100 % av det som saknas$/)).toBeVisible();

  // Only vitamin C as the goal: still a plan, and its other lines go.
  const goals = card.getByRole('button', { pressed: true }).filter({ hasNotText: /Hela världen/ });
  for (const b of await goals.all()) if ((await b.textContent()) !== 'Vitamin C') await b.click();
  await expect(card.getByText(/av det som saknas$/)).toHaveCount(1);
  // No goal: asks for one.
  await vitC.click();
  await expect(card.getByText('Välj minst ett mål.')).toBeVisible();
  await vitC.click();

  // The choice of origin is remembered.
  await tab(page, 'Dagbok');
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  await expect(page.locator('section.fruit').getByRole('button', { name: 'Hela världen' })).toHaveAttribute('aria-pressed', 'true');

  // A food in the plan opens its food screen.
  await page.locator('section.fruit .result').first().click();
  await expect(page.getByRole('button', { name: 'Lägg till', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Tillbaka/ }).click();

  // Accessible in light and dark mode.
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const res = await new AxeBuilder({ page }).include('section.fruit').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => `${v.id}: ${v.help}`), scheme).toEqual([]);
  }
});
