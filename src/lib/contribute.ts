// Links for giving data back: Open Food Facts (add or fix a product on its website — no account
// details pass through this app) and data-error reports as prefilled GitHub issues.

const OFF = 'https://world.openfoodfacts.org';
const REPO = 'https://github.com/Quoterg/iron-log';

/** OFF's product page (log in there to edit nutrition facts or add photos). */
export const offProductUrl = (code: string) => `${OFF}/product/${encodeURIComponent(code)}`;

/** OFF's "add a product" form, prefilled with the barcode. */
export const offAddUrl = (code: string) =>
  `${OFF}/cgi/product.pl?type=search_or_add&action=process&code=${encodeURIComponent(code)}`;

/** Built-in databases (the ref prefix) → the name shown in reports. Only these get a report link. */
const DATABASES: Record<string, string> = { slv: 'Livsmedelsverket', usda: 'USDA FoodData Central' };

/** The database a ref comes from, or null for the user's own foods, recipes and scanned products. */
export const databaseOf = (ref: string): string | null => DATABASES[ref.slice(0, ref.indexOf(':'))] ?? null;

/**
 * A prefilled GitHub issue for a wrong value in a built-in food. The body is fixed text plus the
 * food's names — keep it that way: GitHub rejects URLs longer than about 8 KB.
 */
export function reportUrl(ref: string, sv: string, en: string | null): string {
  const name = en && en !== sv ? `${sv} / ${en}` : sv;
  const title = `Data error: ${name} (${ref})`;
  const body = [
    `Food: ${name}`,
    `Ref: ${ref}`,
    `Source: ${databaseOf(ref) ?? ref.slice(0, ref.indexOf(':'))}`,
    '',
    'What is wrong (nutrient, value shown):',
    '',
    'Correct value and where it comes from (label, link):',
    '',
  ].join('\n');
  return `${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
