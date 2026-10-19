import { expect, test, type Page } from '@playwright/test';

// M38: food cost in the summaries (Näringsämnen 7/30 days, weekly check-in), with Matkostnad on.
test.use({ timezoneId: 'Europe/Stockholm' });

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const day = (n: number) => iso(new Date(Date.UTC(2026, 9, 20 + n))); // relative to Tue 2026-10-20
const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('food cost per day, week and 30 days in the summaries; the check-in compares with the week before', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.clock.setFixedTime(new Date('2026-10-20T12:00:00+02:00'));
  await page.goto('./');
  // Mellanmjölk (slv:150) every day: 500 g in the week of 5–11 Oct, 1000 g in the week of 12–18 Oct.
  const entries = Array.from({ length: 14 }, (_, i) => ({
    id: `m${i}`, date: day(-15 + i), meal: 'breakfast', foodRef: 'slv:150', grams: i < 7 ? 500 : 1000, createdAt: 1000 + i,
  }));
  await tab(page, 'Inställningar');
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;

  // Off: no cost in the summary.
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar' }).click();
  await expect(page.getByText(/Genomsnitt per loggad dag/)).toBeVisible();
  await expect(page.locator('.period-cost')).toHaveCount(0);

  // On: per day and week (7 days), and per 30 days as well (30 days).
  await tab(page, 'Inställningar');
  await page.getByLabel('Visa uppskattade priser (typpriser)').check();
  await page.getByLabel('Visa en kort avstämning av förra veckan i dagboken').check();
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar' }).click();
  await expect(page.locator('.period-cost')).toHaveText(/^Matkostnad i snitt: ~\d+(,5)? kr\/dag · ~\d+ kr\/vecka$/);
  await page.getByRole('button', { name: '30 dagar' }).click();
  await expect(page.locator('.period-cost')).toHaveText(/^Matkostnad i snitt: ~\d+(,5)? kr\/dag · ~\d+ kr\/vecka · ~[\d\s]+ kr\/månad$/);

  // The weekly check-in: last week's cost, twice the milk of the week before → +100 % per day.
  await tab(page, 'Dagbok');
  await page.getByRole('button', { name: 'Visa', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: /Veckans avstämning/ });
  await expect(sheet.getByText(/^Maten kostade ~\d+ kr förra veckan \(~\d+(,5)? kr\/dag\)\. \+100 % per dag mot veckan innan\.$/)).toBeVisible();
});
