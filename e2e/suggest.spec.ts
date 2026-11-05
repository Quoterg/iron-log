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

test('suggestions are off by default; when on, foods for shortfalls and a swap; "what if" on the food screen', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  // A week of white bread (slv:202) and oats (slv:702): short on many nutrients, bread logged often.
  const entries = Array.from({ length: 7 }, (_, i) => [
    { id: `b${i}`, date: iso(-i), meal: 'breakfast', foodRef: 'slv:202', grams: 80, createdAt: 1000 + i },
    { id: `o${i}`, date: iso(-i), meal: 'lunch', foodRef: 'slv:702', grams: 60, createdAt: 2000 + i },
  ]).flat();
  const usage = [
    { foodRef: 'slv:202', count: 7, lastUsed: 3000, lastGrams: 80 },
    { foodRef: 'slv:702', count: 7, lastUsed: 3000, lastGrams: 60 },
  ];
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries, usage })),
  });
  await reloaded;

  // Off by default: the 7-day view has the usual insights, no suggestions.
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Att tänka på' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Vad du kan äta' })).toHaveCount(0);

  // On: foods for the shortfalls and a swap for the white bread.
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Funktioner' }).click();
  await page.getByLabel(/Föreslå livsmedel och byten/).check();
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  // One advice card at the bottom (M43); with only suggestions on, no tabs.
  await expect(page.locator('.advice').getByRole('heading', { name: 'Vad du kan äta' })).toBeVisible();
  await expect(page.locator('.advice .chip')).toHaveCount(0);
  const card = page.locator('.suggest');
  await expect(card.getByText(/ger \d+ % av det som saknas/).first()).toBeVisible({ timeout: 15_000 });
  await expect(card.getByRole('heading', { name: 'Byten att prova' })).toBeVisible();
  await expect(card.getByRole('button', { name: /Bröd fullkorn råg.*i stället för.*Bröd vitt/ })).toContainText(/\+\d+(,\d+)? g fibrer/);

  // "What if" on the food screen (on by default), and off again in Settings.
  await card.getByRole('button', { name: /i stället för/ }).click();
  const whatIf = page.getByRole('region', { name: 'Om du lägger till' });
  await expect(whatIf).toContainText('Energi');
  await expect(whatIf).toContainText('→');
  await page.getByRole('button', { name: /Tillbaka/ }).click();
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Funktioner' }).click();
  await page.getByLabel(/Visa ”Vad händer om”/).uncheck();
  await tab(page, 'Dagbok');
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.locator('.result', { hasText: /Havregryn/ }).first().click();
  await expect(page.getByRole('button', { name: 'Lägg till', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Om du lägger till' })).toHaveCount(0);
});

test('one advice card (M43): food suggestions and fruit as two tabs; a suggestion can be hidden for good', async ({ page }) => {
  test.slow();
  page.on('dialog', (d) => d.accept());
  await page.goto('./');
  const entries = Array.from({ length: 7 }, (_, i) => [
    { id: `b${i}`, date: iso(-i), meal: 'breakfast', foodRef: 'slv:202', grams: 80, createdAt: 1000 + i },
    { id: `o${i}`, date: iso(-i), meal: 'lunch', foodRef: 'slv:702', grams: 60, createdAt: 2000 + i },
  ]).flat();
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  const reloaded = page.waitForEvent('load', { timeout: 15_000 });
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'history.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ format: 'iron-log-backup', version: 1, entries })),
  });
  await reloaded;
  await tab(page, 'Inställningar');
  await page.locator('.settings-menu .entry', { hasText: 'Funktioner' }).click();
  await page.getByLabel(/Föreslå livsmedel och byten/).check();
  await page.getByLabel(/Föreslå frukt i säsong/).check();
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();

  const advice = page.locator('.advice');
  const tabs = advice.getByRole('group', { name: 'Vad du kan äta' });
  await expect(tabs.getByRole('button', { name: 'Livsmedel' })).toHaveAttribute('aria-pressed', 'true');
  const first = advice.locator('.suggest-gap li').first();
  await expect(first).toBeVisible({ timeout: 15_000 });
  const name = (await first.locator('.entry-name').innerText()).split('\n')[0];
  await first.getByRole('button', { name: /^Föreslå inte .* igen$/ }).click();
  await expect(advice.locator('.suggest-gap .entry-name', { hasText: name })).toHaveCount(0);
  // Kept across a reload.
  await page.reload();
  await tab(page, 'Näringsämnen');
  await page.getByRole('button', { name: '7 dagar', exact: true }).click();
  await expect(advice.locator('.suggest-gap li').first()).toBeVisible({ timeout: 15_000 });
  await expect(advice.locator('.suggest-gap .entry-name', { hasText: name })).toHaveCount(0);

  await tabs.getByRole('button', { name: 'Frukt i säsong' }).click();
  await expect(advice.locator('.fruit')).toBeVisible();
  await expect(advice.locator('.suggest-gap')).toHaveCount(0);
});
