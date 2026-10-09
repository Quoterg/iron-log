import { expect, test, type Page } from '@playwright/test';

// Two devices = two browser contexts with separate storage, connected over a real WebRTC data
// channel. The codes are pasted as text (headless browsers have no camera).
test.use({ serviceWorkers: 'block' });

const card = (page: Page, title: string) => page.locator('section.card', { has: page.getByRole('heading', { name: title, exact: true }) });

const openSync = async (page: Page) => {
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('button', { name: 'Synka', exact: true }).click();
};

const codeText = async (page: Page) => {
  await page.getByText('Visa som text').click();
  const box = page.getByRole('textbox', { name: 'Visa som text' });
  await expect(box).toHaveValue(/^IL1\./);
  return box.inputValue();
};

const paste = async (page: Page, code: string) => {
  await page.getByLabel('Eller klistra in koden').fill(code);
  await page.getByRole('button', { name: 'Använd koden' }).click();
};

test('two devices pair with codes and end up with each other’s data', async ({ browser }) => {
  test.slow();
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await a.goto('./');
  await b.goto('./');

  // Different data on each device.
  await card(a, 'Vatten').getByRole('button', { name: '+5 dl' }).click();
  await expect(card(a, 'Vatten')).toContainText('0,5 l');
  await b.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await b.getByPlaceholder(/Sök livsmedel/).fill('havregryn');
  await b.locator('.result').first().click();
  await b.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(b.locator('.meal .entry')).toHaveCount(1);

  // A shows a code; B answers it; A takes the answer.
  await openSync(a);
  await a.getByRole('button', { name: 'Starta här (visa kod)' }).click();
  const offer = await codeText(a);
  expect(offer.length).toBeLessThan(900); // ~600 today: a QR code a phone camera reads from a screen
  await openSync(b);
  await b.getByRole('button', { name: 'Skanna kod' }).click();
  await paste(b, offer);
  const answer = await codeText(b);
  expect(answer.length).toBeLessThan(900);
  await paste(a, answer);

  for (const p of [a, b]) await expect(p.getByRole('status')).toContainText('Klart!', { timeout: 30_000 });
  await expect(a.getByRole('status')).toContainText('2 ändringar hämtade'); // the entry and its usage record

  // After "OK" (reload), each device shows the other's data.
  for (const p of [a, b]) await p.getByRole('button', { name: 'OK', exact: true }).click();
  await a.getByRole('button', { name: 'Dagbok', exact: true }).click().catch(() => {});
  await expect(a.locator('.meal .entry')).toHaveCount(1);
  await expect(a.locator('.meal .entry')).toContainText(/havregryn/i);
  await b.reload();
  await expect(card(b, 'Vatten')).toContainText('0,5 l');
});

test('a garbled code is refused with a clear message', async ({ page }) => {
  await page.goto('./');
  await openSync(page);
  await page.getByRole('button', { name: 'Skanna kod' }).click();
  await paste(page, 'IL1.this-is-not-a-code');
  await expect(page.getByRole('alert')).toContainText('Koden kunde inte läsas');
});
