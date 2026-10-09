import { expect, test, type Page } from '@playwright/test';

const bodyTab = (page: Page) => page.getByRole('button', { name: 'Kropp', exact: true }).click();

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function logWeight(page: Page, date: string, kg: string, waist?: string) {
  await page.getByLabel('Datum').fill(date);
  await page.getByLabel('Vikt (kg)', { exact: true }).fill(kg);
  if (waist) await page.getByLabel('Midjemått (cm)').fill(waist);
  await page.getByRole('button', { name: 'Spara', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Sparat');
}

test('log weight over days, see the trend chart, table and keyboard readout; profile follows', async ({ page }) => {
  await page.goto('./');
  await bodyTab(page);
  await expect(page.getByText(/Inga mått ännu/)).toBeVisible();

  await logWeight(page, daysAgo(6), '81');
  await logWeight(page, daysAgo(3), '80,4', '92');
  await logWeight(page, daysAgo(0), '79,6');

  const weight = page.locator('figure.chart', { hasText: 'Vikt' });
  await expect(weight.locator('circle.point')).toHaveCount(3);
  await expect(weight.locator('path.trend')).toHaveCount(1);
  // Only one waist measurement → its own chart with one point; no body-fat chart.
  await expect(page.locator('figure.chart', { hasText: 'Midjemått' }).locator('circle.point')).toHaveCount(1);
  await expect(page.locator('figure.chart', { hasText: 'Fettprocent' })).toHaveCount(0);

  // Keyboard: focus the chart, arrows move the readout. Trend of the last day = (81 + 80.4 + 79.6) / 3.
  await weight.locator('svg').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(weight.locator('.chart-tip')).toContainText('79,6 kg');
  await expect(weight.locator('.chart-tip')).toContainText('Trend 7 dagar 80,3 kg');

  // Table view lists every measurement.
  await weight.getByText('Visa som tabell').click();
  await expect(weight.locator('table.data tbody tr')).toHaveCount(3);

  // The newest weight updated the profile.
  await page.getByRole('button', { name: 'Inställningar', exact: true }).click();
  await expect(page.getByLabel('Vikt (kg)', { exact: true })).toHaveValue('79,6');
});

test('body tab fits a 360 px phone', async ({ page }) => {
  await page.goto('./');
  await bodyTab(page);
  await logWeight(page, daysAgo(1), '70');
  await logWeight(page, daysAgo(0), '70,5');
  const { scroll, width } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
  expect(scroll).toBeLessThanOrEqual(width);
});
