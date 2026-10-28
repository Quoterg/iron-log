import { expect, test, type Page } from '@playwright/test';

// Adaptive energy expenditure: fixed clock and time zone, history imported as a backup.
test.use({ timezoneId: 'Europe/Stockholm' });

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (n: number) => iso(new Date(Date.UTC(2026, 9, 20 + n))); // relative to 2026-10-20
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('adaptive expenditure: off by default, estimate, goal target applied only on request, day complete', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00+02:00'));
  await page.goto('./');

  // 20 days of 2000 kcal (533 g oats, 375 kcal/100 g) and weekly weigh-ins losing 0.5 kg a week.
  const entries = Array.from({ length: 20 }, (_, i) => ({
    id: `d${i}`, date: day(-1 - i), meal: 'breakfast', foodRef: 'slv:702', grams: 533.3, createdAt: 1000 + i,
  }));
  const body = [-27, -20, -13, -6].map((n, k) => ({ date: day(n), weightKg: 80 - 0.5 * k, updatedAt: 1 }));
  await tab(page, 'Inställningar');
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries, body })),
  });
  await reloaded;

  // Off by default: nothing in the diary.
  await page.getByRole('button', { name: 'Föregående dag' }).click();
  await expect(page.locator('.meal').first().locator('.entry')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Dagen är komplett/ })).toHaveCount(0);

  // Turned on: the estimate, ≈ 2000 + 0.5 × 7700 / 7 = 2550 kcal/day.
  await tab(page, 'Inställningar');
  await page.getByLabel('Beräkna min förbrukning från vikt och intag').check();
  await expect(page.getByText(/Uppskattad förbrukning: 2\s550 kcal\/dag/)).toBeVisible();
  // The arithmetic (M41b): intake of the days that count + the weight trend's energy = expenditure.
  await expect(page.getByText(/Du åt i snitt 2\s000 kcal\/dag de 20 dagar som räknas/).first()).toBeVisible();
  await expect(page.getByText(/Vikten ändrades −0,5 kg\/vecka enligt 4 vägningar – det motsvarar \+550 kcal\/dag/).first()).toBeVisible();
  await expect(page.getByText(/Förbrukning: 2\s000 \+ 550 = 2\s550 kcal\/dag/).first()).toBeVisible();
  const energy = page.getByLabel('Energibehov per dag (kcal)');
  const before = await energy.inputValue();

  // A goal suggests a target; nothing changes until the user applies it.
  await page.getByRole('combobox', { name: 'Mål', exact: true }).selectOption('lose');
  // The goal is set in the profile (M35); its paces follow the profile weight (none entered here: all three).
  await expect(page.getByRole('combobox', { name: 'Takt' }).locator('option')).toHaveCount(3);
  await page.getByRole('combobox', { name: 'Takt' }).selectOption('0.25');
  await expect(page.getByText(/Föreslaget energimål: 2\s280 kcal\/dag/)).toBeVisible();
  await expect(energy).toHaveValue(before);
  await page.getByRole('button', { name: 'Använd som mitt energimål' }).click();
  await expect(energy).toHaveValue('2280');
  await expect(page.getByText('Det här är ditt energimål nu.', { exact: false })).toBeVisible();

  // Follow the estimate (M35): gain 0.25 kg/week wants 2550 + 275 = 2830; one step is at most +150.
  await page.getByRole('combobox', { name: 'Mål', exact: true }).selectOption('gain');
  await expect(page.getByText(/Föreslaget energimål: 2\s830 kcal\/dag/)).toBeVisible();
  await page.getByLabel(/Följ uppskattningen automatiskt/).check();
  await expect(energy).toHaveValue('2430');
  // One owner (M41): the profile's formula box is off and locked while the target follows.
  await expect(page.getByText(/följer nu din uppmätta förbrukning/)).toBeVisible();
  await expect(page.getByLabel('Räkna ut energibehovet automatiskt')).toBeDisabled();
  // How and why (M41): the step, what it rests on, and where the next one goes (week 44).
  await expect(page.getByText(/Senaste ändringen av energimålet \(2026-10-20\)/)).toBeVisible();
  await expect(page.getByText(/högst 150 kcal per vecka: 2\s280 → 2\s430 kcal\/dag\. Nästa vecka fortsätter det mot 2\s830/)).toBeVisible();
  await expect(page.getByText(/Nästa steg \(vecka 44\): 2\s430 → 2\s580 kcal\/dag, mot 2\s830/)).toBeVisible();
  await tab(page, 'Dagbok');
  const note = page.getByRole('status').filter({ hasText: 'Ditt energimål ändrades' });
  await expect(note).toContainText('nu 2 430 kcal/dag (+150)');
  await note.getByRole('button', { name: 'Varför?' }).click();
  await expect(note).toContainText(/Förbrukning: 2\s000 \+ 550 = 2\s550 kcal\/dag/);
  await expect(note).toContainText(/Ditt mål: Gå upp i vikt, 0,25 kg\/vecka → \+275 kcal\/dag/);
  await expect(note).toContainText(/Det ger ett energimål på 2\s830 kcal\/dag/);
  // Once a week: a reload the same week changes nothing.
  await page.reload();
  await expect(note).toBeVisible();
  await tab(page, 'Inställningar');
  await expect(energy).toHaveValue('2430');
  // A new goal while following applies at once (M41): gain → lose at 0.25 kg/week = −550 kcal.
  await page.getByRole('combobox', { name: 'Mål', exact: true }).selectOption('lose');
  await expect(energy).toHaveValue('1880');
  await expect(page.getByText(/Du bytte mål från ”Gå upp i vikt, 0,25 kg\/vecka” till ”Gå ner i vikt, 0,25 kg\/vecka”: −550 kcal\/dag direkt, 2\s430 → 1\s880/)).toBeVisible();
  await page.getByLabel(/Följ uppskattningen automatiskt/).uncheck();
  await page.getByRole('button', { name: 'Använd som mitt energimål' }).click();
  await expect(energy).toHaveValue('2280');
  await tab(page, 'Dagbok');
  await expect(note).toContainText('nu 1 880 kcal/dag (−550)');
  await note.getByRole('button', { name: 'Inte nu' }).click();
  await expect(note).toHaveCount(0);
  await page.getByRole('button', { name: 'Föregående dag' }).click();

  // The day-complete mark in the diary (still showing yesterday), kept across a reload.
  await tab(page, 'Dagbok');
  await expect(page.getByRole('button', { name: 'Igår' })).toBeVisible();
  const mark = page.getByRole('button', { name: /Dagen är komplett/ });
  await expect(mark).toHaveAttribute('aria-pressed', 'false');
  await mark.click();
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('button', { name: 'Föregående dag' }).click();
  await expect(mark).toHaveAttribute('aria-pressed', 'true');

  // Off again: gone from the diary, the target stays what the user chose.
  await tab(page, 'Inställningar');
  await page.getByLabel('Beräkna min förbrukning från vikt och intag').uncheck();
  await expect(page.getByText(/Uppskattad förbrukning/)).toHaveCount(0);
  await expect(energy).toHaveValue('2280');
  await tab(page, 'Dagbok');
  await expect(page.getByRole('button', { name: /Dagen är komplett/ })).toHaveCount(0);
});
