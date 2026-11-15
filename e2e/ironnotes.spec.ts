import { expect, test, type Page } from '@playwright/test';

const iso = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const backup = {
  app: 'iron-notes',
  version: 1,
  exported: '2026-11-10T10:00:00Z',
  metrics: [
    { id: 'w', name: 'Body weight', kind: 'weight', order: 0 },
    { id: 'f', name: 'Body fat', kind: 'percent', order: 1 },
    { id: 'm', name: 'Waist', kind: 'length', order: 2 },
  ],
  body: [
    { id: '1', metricId: 'w', date: iso(-3), value: 82.4, at: 1 },
    { id: '2', metricId: 'w', date: iso(-1), value: 81.6, at: 2 },
    { id: '3', metricId: 'f', date: iso(-1), value: 19.5, at: 2 },
    { id: '4', metricId: 'm', date: iso(-1), value: 91, at: 2 },
  ],
  settings: { diet: 'cut' },
};

async function importFile(page: Page) {
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await page.locator('.settings-menu .entry', { hasText: 'Utseende, data & om' }).click();
  await page.getByLabel('Importera säkerhetskopia').setInputFiles({
    name: 'iron-notes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)),
  });
}

test('an Iron Notes backup brings body measurements and, if wanted, its diet phase as the goal (M53)', async ({ page }) => {
  const asked: string[] = [];
  page.on('dialog', (d) => (asked.push(d.message()), d.accept()));
  await page.goto('./');
  await importFile(page);
  await expect(page.getByRole('status')).toHaveText('Importerat från Iron Notes.');
  expect(asked[0]).toContain('2 vägningar, 1 fettprocent och 1 midjemått');
  expect(asked[1]).toContain('”Gå ner i vikt”');

  // The newest weight is in the profile, the goal changed, and the Body tab has the measurements.
  await page.getByRole('button', { name: /^‹ / }).click();
  await expect(page.locator('.settings-menu .entry', { hasText: 'Profil & mål' })).toContainText('81,6 kg');
  await expect(page.locator('.settings-menu .entry', { hasText: 'Profil & mål' })).toContainText('Gå ner i vikt');
  await page.getByRole('button', { name: 'Kropp', exact: true }).click();
  await page.getByRole('button', { name: 'Visa som tabell' }).first().click();
  await expect(page.locator('main table').first()).toContainText('81,6');
  await expect(page.locator('main')).toContainText('Midjemått'); // a chart for each measure

  // The same file again: nothing new, nothing asked.
  await importFile(page);
  await expect(page.getByRole('status')).toHaveText('Inget nytt att importera från Iron Notes.');
  expect(asked).toHaveLength(2);
});
