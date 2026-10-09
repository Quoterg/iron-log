// Links for giving data back: Open Food Facts (add or fix a product on its website — no account
// details pass through this app) and data-error reports as prefilled GitHub issues.

const OFF = 'https://world.openfoodfacts.org';
const REPO = 'https://github.com/Quoterg/iron-log';

/** OFF's product page (log in there to edit nutrition facts or add photos). */
export const offProductUrl = (code: string) => `${OFF}/product/${encodeURIComponent(code)}`;

/** OFF's "add a product" form, prefilled with the barcode. */
export const offAddUrl = (code: string) =>
  `${OFF}/cgi/product.pl?type=search_or_add&action=process&code=${encodeURIComponent(code)}`;

/** A prefilled GitHub issue for a wrong value in a built-in food. */
export function reportUrl(ref: string, name: string, source: string): string {
  const title = `Data error: ${name} (${ref})`;
  const body = [
    `Food: ${name}`,
    `Ref: ${ref}`,
    `Source: ${source}`,
    '',
    'What is wrong (nutrient, value shown):',
    '',
    'Correct value and where it comes from (label, link):',
    '',
  ].join('\n');
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
