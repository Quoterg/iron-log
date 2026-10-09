import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect, test } from '@playwright/test';

// End-to-end camera scan: Chromium's fake camera plays a JPEG of a real EAN-13 barcode.
// Linux Chromium has no native BarcodeDetector, so this exercises the self-hosted WASM fallback.

const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((c) => [...c].map((b) => (b === '0' ? '1' : '0')).join(''));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

function ean13Svg(code: string): string {
  const d = code.split('').map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PARITY[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  const w = 4;
  const bars = [...bits].map((b, i) => (b === '1' ? `<rect x="${(i + 12) * w}" y="20" width="${w}" height="200"/>` : '')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(bits.length + 24) * w}" height="240"><rect width="100%" height="100%" fill="#fff"/>${bars}</svg>`;
}

const CODE = '7310865004703';
const FIXTURE = 'test-results/fake-camera.mjpeg';

test('scanning a barcode with the camera opens the product', async () => {
  // Render the barcode to a JPEG used as the fake camera feed.
  const painter = await chromium.launch();
  const p = await painter.newPage({ viewport: { width: 640, height: 480 } });
  await p.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:100vh">${ean13Svg(CODE)}</body>`);
  const jpeg = await p.screenshot({ type: 'jpeg', quality: 95 });
  await painter.close();
  await mkdir('test-results', { recursive: true });
  await writeFile(FIXTURE, jpeg);

  const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${FIXTURE}`],
  });
  const ctx = await browser.newContext({ baseURL: 'http://localhost:4173/', locale: 'sv-SE', permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.route('**/world.openfoodfacts.org/**', (route) =>
    route.fulfill({
      json: { status: 1, product: { product_name: 'Testyoghurt', nutriments: { 'energy-kcal_100g': 60 } } },
    }),
  );
  const wasm: string[] = [];
  page.on('request', (r) => r.url().endsWith('.wasm') && wasm.push(r.url()));

  await page.goto('./');
  await page.locator('.meal').first().getByRole('button', { name: /Lägg till/ }).click();
  await page.getByRole('button', { name: /Skanna streckkod/ }).click();
  await expect(page.getByRole('heading', { name: 'Testyoghurt' })).toBeVisible({ timeout: 20_000 });
  // The decoder came from our own origin, not a CDN.
  expect(wasm.length).toBeGreaterThan(0);
  expect(wasm.every((u) => u.startsWith('http://localhost:4173/'))).toBe(true);
  await browser.close();
});
