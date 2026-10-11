import { expect, test, type Page } from '@playwright/test';

// Weekly check-in (M26): fixed clock (Wednesday 14 Oct 2026, week 42) and history for week 41.
test.use({ timezoneId: 'Europe/Stockholm' });

test.beforeEach(async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
});

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();
const teaser = (page: Page) => page.getByRole('button', { name: 'Visa', exact: true });

test('off by default; once a week on the diary; the sheet sums up the week; seen stays seen', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.clock.setFixedTime(new Date('2026-10-14T09:00:00+02:00'));
  await page.goto('./');
  // Five days of week 41 (5–11 Oct) at ~2000 kcal (533 g oats), weigh-ins in weeks 40 and 41.
  const entries = ['05', '06', '07', '08', '09'].map((d, i) => ({
    id: `w${i}`, date: `2026-10-${d}`, meal: 'breakfast', foodRef: 'slv:702', grams: 533.3, createdAt: 1000 + i,
  }));
  const body = [['2026-09-30', 80.4], ['2026-10-02', 80.2], ['2026-10-06', 79.9], ['2026-10-10', 79.7]].map(([date, kg]) => ({ date, weightKg: kg, updatedAt: 1 }));
  await tab(page, 'Inställningar');
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'h.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries, body })),
  });
  await reloaded;
  await expect(page.locator('.meal').first()).toBeVisible();
  await expect(page.getByText('Veckans avstämning är klar')).toHaveCount(0); // off by default

  await tab(page, 'Inställningar');
  await page.getByLabel('Visa en kort avstämning av förra veckan i dagboken').check();
  await tab(page, 'Dagbok');
  await expect(page.getByText('Veckans avstämning är klar')).toBeVisible();
  await teaser(page).click();

  const sheet = page.getByRole('dialog', { name: 'Veckans avstämning' });
  await expect(sheet.getByText(/Vecka 41 · 5 okt\.?–11 okt/)).toBeVisible();
  await expect(sheet.getByText('5 av 7 dagar loggade')).toBeVisible();
  await expect(sheet.getByText(/Energi i snitt 2\s000 kcal per loggad dag/)).toBeVisible();
  await expect(sheet.getByText('Vikt: −0,5 kg jämfört med veckan innan')).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Det här gick bra' })).toBeVisible();
  await expect(sheet.getByText('Energin låg nära ditt mål.')).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Ett förslag' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Klar' }).click();

  // Seen: gone from the diary, also after a reload.
  await expect(page.getByText('Veckans avstämning är klar')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.meal').first()).toBeVisible();
  await expect(page.getByText('Veckans avstämning är klar')).toHaveCount(0);
});
