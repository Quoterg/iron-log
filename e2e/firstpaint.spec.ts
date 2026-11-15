import { expect, test, type Page } from '@playwright/test';

const meal = (page: Page, i: number) => page.locator('.meal').nth(i);

async function logFood(page: Page, query: string, name: string) {
  await meal(page, 0).getByRole('button', { name: /Lägg till/ }).click();
  await page.getByPlaceholder(/Sök livsmedel/).fill(query);
  await page.getByRole('dialog').locator('.result', { hasText: name }).first().click();
  await page.getByRole('button', { name: 'Lägg till', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('the first paint of a logged day already has its totals and names (review #97)', async ({ page }) => {
  await page.goto('./');
  await logFood(page, 'havregryn', 'Havregryn fullkorn');
  await logFood(page, 'ägg', 'Ägg kokt');
  const final = (await page.locator('.hero-num').innerText()).replace(/\s/g, '');

  // Record what the very first painted diary shows, before anything can fill in later.
  await page.addInitScript(() => {
    const w = window as unknown as { firstHero?: string; firstNames?: string[] };
    // Checked every frame from the start: the first frame that has the diary is the first paint.
    const look = () => {
      const hero = document.querySelector('.hero-num');
      if (!hero) return void requestAnimationFrame(look);
      w.firstHero = hero.textContent ?? '';
      w.firstNames = [...document.querySelectorAll('.entry .entry-name')].map((e) => e.textContent ?? '');
    };
    requestAnimationFrame(look);
  });
  await page.reload();
  await expect(page.locator('.hero-num')).toBeVisible();
  const first = await page.evaluate(() => {
    const w = window as unknown as { firstHero?: string; firstNames?: string[] };
    return { firstHero: w.firstHero, firstNames: w.firstNames };
  });
  expect(first.firstHero!.replace(/\s/g, '')).toBe(final);
  expect(first.firstNames).toEqual(['Havregryn fullkorn', 'Ägg kokt']);
});
