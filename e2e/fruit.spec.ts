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

  // On, with its sources named and the origin chosen in Settings (Sverige + Europa by default).
  await tab(page, 'Inställningar');
  await page.getByLabel(/Föreslå frukt i säsong/).check();
  await expect(page.getByText(/Säsonger från SCB:s importstatistik/)).toBeVisible();
  const reach = page.getByRole('group', { name: 'Varifrån' });
  await expect(reach.getByRole('button', { name: 'Sverige + Europa' })).toHaveAttribute('aria-pressed', 'true');
  // The whole world: some fruit is in season every month, and vitamin C sources always.
  await reach.getByRole('button', { name: 'Hela världen' }).click();
  await expect(reach.getByRole('button', { name: 'Hela världen' })).toHaveAttribute('aria-pressed', 'true');
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  const card = page.locator('section.fruit');
  await expect(card.getByRole('heading', { name: 'Frukt i säsong' })).toBeVisible();

  // Last on the page, below the nutrients and "Anpassa mål".
  const below = async () => (await card.boundingBox())!.y > (await page.getByRole('button', { name: 'Anpassa mål' }).boundingBox())!.y;
  expect(await below()).toBe(true);

  // The shopping list first, then what it covers of each goal, in the goal chips themselves.
  await expect(card.getByText(/^Att handla för en vecka i \w+:$/)).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('.result').first()).toContainText(/\d+ (st|dl) · \d+ g · /);
  const goals = card.locator('.chips.goals button');
  const vitC = goals.filter({ hasText: /^Vitamin C/ });
  await expect(vitC).toHaveText('Vitamin C 100 %');
  await expect(vitC).toHaveAttribute('aria-pressed', 'true');
  expect(await goals.count()).toBeGreaterThan(1); // all goals on by default: a broad week

  // Leave out all but vitamin C: still a list; the others show without a share.
  const names = (await goals.allTextContents()).map((t) => t.replace(/ \d+ %$/, '')); // the shares change as goals go
  for (const name of names) if (name !== 'Vitamin C') await goals.filter({ hasText: new RegExp(`^${name.replace(/[()]/g, '\\$&')}( \\d+ %)?$`) }).click();
  await expect(goals.filter({ hasText: / %$/ })).toHaveCount(1);
  // No goal: asks for one.
  await vitC.click();
  await expect(card.getByText('Välj minst ett mål.')).toBeVisible();
  await vitC.click();

  // What fruit is a source of, the rest in season and the sources: under "Mer".
  await expect(card.getByText(/^Frukt är en källa till:/)).toBeHidden();
  await card.getByText('Mer', { exact: true }).click();
  await expect(card.getByText(/^Frukt är en källa till:.*Vitamin C/)).toBeVisible();
  await expect(card.getByText(/Säsonger från SCB:s importstatistik/)).toBeVisible();

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

test('food without vitamin data (scanned products): still a shopping list, with a note that the gaps are uncertain', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  // Most of the energy from a product with only energy and macros (like many scanned ones), a little oats.
  const per100g: (number | null)[] = Array(54).fill(null);
  per100g[0] = 400; // kcal, then protein, carbs, fat (nutrients.json order)
  per100g[1] = 10;
  per100g[2] = 60;
  per100g[3] = 15;
  const customFoods = [{ ref: 'custom:scanned', sv: 'Skannad produkt', en: null, per100g, createdAt: 1, updatedAt: 1 }];
  const entries = Array.from({ length: 7 }, (_, i) => [
    { id: `s${i}`, date: iso(-i), meal: 'lunch', foodRef: 'custom:scanned', grams: 300, createdAt: 1000 + i },
    { id: `o${i}`, date: iso(-i), meal: 'breakfast', foodRef: 'slv:702', grams: 60, createdAt: 2000 + i },
  ]).flat();
  await tab(page, 'Inställningar');
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries, customFoods })),
  });
  await reloaded;
  await tab(page, 'Inställningar');
  await page.getByLabel(/Föreslå frukt i säsong/).check();
  await page.getByRole('group', { name: 'Varifrån' }).getByRole('button', { name: 'Hela världen' }).click();
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  const card = page.locator('section.fruit');
  // Before M40d: "Du får tillräckligt …", because these vitamins were treated as unknown.
  await expect(card.getByText(/^Att handla för en vecka i \w+:$/)).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('.chips.goals button').filter({ hasText: /^Vitamin C \d+ %$/ })).toBeVisible();
  await expect(card.getByText(/^Osäkert för .*Vitamin C/)).toBeVisible();
  await expect(card.getByText(/Du får tillräckligt/)).toHaveCount(0);
});
