import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('skipping the first start gives labelled standard targets, no invented sex (M65)', async ({ page }) => {
  await page.goto('./');
  await page.locator('.welcome').getByRole('button', { name: 'Inte nu' }).click();

  // Settings says there is no profile instead of "Kvinna".
  await tab(page, 'Inställningar');
  const profile = page.locator('.settings-menu .entry', { hasText: 'Profil & mål' });
  await expect(profile).toContainText('Ingen profil – standardmål');
  await expect(profile).not.toContainText('Kvinna');
  await expect(page.locator('.settings-menu .entry', { hasText: 'Energimål' })).toContainText(/2\s000 kcal\/dag · standard/);
  await profile.click();
  await expect(page.getByLabel('Kön')).toHaveValue('');
  await expect(page.getByText(/Du har inte angett någon profil/)).toBeVisible();
  // No menstruation or pregnancy questions without a sex.
  await expect(page.getByLabel('Livssituation')).toHaveCount(0);
  await expect(page.getByText('Har menstruation')).toHaveCount(0);

  // Näringsämnen labels the targets as standard, with one quiet way to the profile.
  await tab(page, 'Näringsämnen');
  await expect(page.getByText(/Standardmål för vuxna enligt NNR 2023/)).toBeVisible();
  await page.getByRole('button', { name: 'Ange profil' }).click();
  await expect(page.getByLabel('Kön')).toBeVisible();

  // Choosing a sex makes them personal; the note goes.
  await page.getByLabel('Kön').selectOption('male');
  await tab(page, 'Näringsämnen');
  await expect(page.getByText(/Målen bygger på de nordiska/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ange profil' })).toHaveCount(0);
  await tab(page, 'Inställningar');
  await expect(page.locator('.settings-menu .entry', { hasText: 'Profil & mål' })).toContainText('Man');
});
