import { expect, test } from '@playwright/test';

// M29: Auto follows the phone; Dag/Natt are kept on the device and applied before first paint.
const theme = (page: import('@playwright/test').Page) => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test('Auto follows the phone; a chosen theme sticks across reloads, before first paint', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  expect(await theme(page)).toBe('night');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => theme(page)).toBe('day'); // Auto follows a change while open

  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  const group = page.getByRole('group', { name: 'Utseende' });
  await group.getByRole('button', { name: 'Natt' }).click();
  await expect(group.getByRole('button', { name: 'Natt' })).toHaveAttribute('aria-pressed', 'true');
  expect(await theme(page)).toBe('night');

  // Set by the inline boot script while the page is parsed (before the app's own scripts run):
  // checked when parsing ends, ahead of the deferred app module.
  await page.addInitScript(() => {
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive') (window as unknown as { early: string | null }).early = document.documentElement.getAttribute('data-theme');
    }, { once: true });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { early: string | null }).early)).toBe('night');
  expect(await theme(page)).toBe('night');
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute('content', '#050912');

  // Back to Auto: the phone's setting again.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.getByRole('group', { name: 'Utseende' }).getByRole('button', { name: 'Auto' }).click();
  expect(await theme(page)).toBe('day');
});
