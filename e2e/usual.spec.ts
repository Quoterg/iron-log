import { expect, test, type Page } from '@playwright/test';

// "Your usual" depends on the date, time of day and history: fixed clock and time zone.
test.use({ timezoneId: 'Europe/Stockholm' });

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+02:00`); // CEST in October
const meal = (page: Page, i: number) => page.locator('.meal').nth(i);
const usualCard = (page: Page, i: number) => meal(page, i).getByRole('button', { name: /Som vanligt/ });

/** Oats and banana for breakfast at 07:30 on the given days, imported as a backup. */
async function importBreakfasts(page: Page, days: string[]) {
  const entries = days.flatMap((date) =>
    ['slv:702', 'slv:553'].map((foodRef, i) => ({
      id: `${date}-${i}`, date, meal: 'breakfast', foodRef, grams: i ? 120 : 40, createdAt: at(date, '07:30').getTime() + i,
    })),
  );
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;
  await expect(meal(page, 0)).toBeVisible();
}

test('your usual: only when it is the usual, at its time; dismiss, log, switch off', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept()); // the import's confirm()
  // Monday 12 October, 08:00. Three of the last weekdays had the same breakfast: not yet the usual.
  await page.clock.setFixedTime(at('2026-10-12', '08:00'));
  await page.goto('./');
  await importBreakfasts(page, ['2026-10-09', '2026-10-08', '2026-10-07']);
  await expect(meal(page, 0).getByRole('button', { name: /Lägg till/ })).toBeVisible();
  await expect(usualCard(page, 0)).toHaveCount(0);

  // A fourth weekday (a weekend day wouldn't count): now it is.
  await importBreakfasts(page, ['2026-10-11', '2026-10-06']);
  await expect(usualCard(page, 0)).toContainText(/Havregryn.*Banan/);
  await expect(usualCard(page, 1)).toHaveCount(0); // lunch: nothing usual

  // Not at lunchtime.
  await page.clock.setFixedTime(at('2026-10-12', '12:00'));
  await page.reload();
  await expect(meal(page, 0).getByRole('button', { name: /Lägg till/ })).toBeVisible();
  await expect(usualCard(page, 0)).toHaveCount(0);

  // "Not now" hides it for the day, also after a reload.
  await page.clock.setFixedTime(at('2026-10-12', '08:10'));
  await page.reload();
  await meal(page, 0).getByRole('button', { name: 'Inte nu' }).click();
  await expect(usualCard(page, 0)).toHaveCount(0);
  await page.reload();
  await expect(meal(page, 0).getByRole('button', { name: /Lägg till/ })).toBeVisible();
  await expect(usualCard(page, 0)).toHaveCount(0);

  // Tuesday: offered again; one tap logs it (amounts editable afterwards like any entry).
  await page.clock.setFixedTime(at('2026-10-13', '07:45'));
  await page.reload();
  await usualCard(page, 0).click();
  await expect(meal(page, 0).locator('.entry')).toHaveCount(2);
  await expect(meal(page, 0).locator('.entry').first()).toContainText(/Havregryn.*40 g/);
  await expect(usualCard(page, 0)).toHaveCount(0);

  // Switched off in Settings: never shown.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByLabel('Föreslå min vanliga måltid').uncheck();
  await page.clock.setFixedTime(at('2026-10-14', '07:45'));
  await page.reload();
  await expect(meal(page, 0).getByRole('button', { name: /Lägg till/ })).toBeVisible();
  await expect(usualCard(page, 0)).toHaveCount(0);
});

test('home-screen shortcuts: add food for the time of day, add water', async ({ page }) => {
  await page.clock.setFixedTime(at('2026-10-12', '12:15'));
  await page.goto('./?add');
  await expect(page.getByRole('dialog', { name: 'Lunch' })).toBeVisible();
  await expect(page.getByPlaceholder(/Sök livsmedel/)).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  await page.goto('./?water');
  await expect(page.locator('.card', { hasText: 'Vatten' })).toContainText('0,2 l');
  // The query is gone: a reload doesn't add it again.
  await page.reload();
  await expect(page.locator('.card', { hasText: 'Vatten' })).toContainText('0,2 l');
});
