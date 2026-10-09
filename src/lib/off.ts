// Open Food Facts (ODbL): product lookup by barcode, mapped into our nutrient vector.
// Only the barcode is sent, and only when the user scans or types one.
import { NUTRIENT_INDEX, NUTRIENTS, type Food, type NutrientVector, type Serving } from './nutrients';

export const OFF_API = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'code,product_name,product_name_sv,product_name_en,brands,nutriments,product_quantity,serving_quantity';

/** EAN-8, UPC-A (12), EAN-13 or GTIN-14 with a valid check digit. */
export function isValidBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** OFF nutriment key → our key and the factor from OFF's per-100 g unit (grams) to ours. */
const MAP: [off: string, key: string, factor: number][] = [
  ['proteins', 'protein', 1],
  ['carbohydrates', 'carbs', 1],
  ['fat', 'fat', 1],
  ['fiber', 'fibre', 1],
  ['sugars', 'sugar', 1],
  ['added-sugars', 'addedSugar', 1],
  ['saturated-fat', 'satFat', 1],
  ['monounsaturated-fat', 'monoFat', 1],
  ['polyunsaturated-fat', 'polyFat', 1],
  ['cholesterol', 'cholesterol', 1000],
  ['salt', 'salt', 1],
  ['sodium', 'sodium', 1000],
  ['vitamin-a', 'vitA', 1e6],
  ['beta-carotene', 'betaCarotene', 1e6],
  ['vitamin-d', 'vitD', 1e6],
  ['vitamin-e', 'vitE', 1000],
  ['vitamin-b1', 'thiamin', 1000],
  ['vitamin-b2', 'riboflavin', 1000],
  ['vitamin-pp', 'niacin', 1000],
  ['vitamin-b6', 'vitB6', 1000],
  ['vitamin-b9', 'folate', 1e6],
  ['folates', 'folate', 1e6],
  ['vitamin-b12', 'vitB12', 1e6],
  ['vitamin-c', 'vitC', 1000],
  ['calcium', 'calcium', 1000],
  ['phosphorus', 'phosphorus', 1000],
  ['potassium', 'potassium', 1000],
  ['magnesium', 'magnesium', 1000],
  ['iron', 'iron', 1000],
  ['zinc', 'zinc', 1000],
  ['selenium', 'selenium', 1e6],
  ['iodine', 'iodine', 1e6],
];

export interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_sv?: string;
  product_name_en?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
  product_quantity?: number | string;
  serving_quantity?: number | string;
}

const num = (x: unknown): number | null => {
  const n = typeof x === 'string' ? Number(x) : x;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};

const round = (x: number) => Number(x.toPrecision(4));

/** Map an OFF product to a Food (per 100 g, or per 100 ml treated as 100 g). Null if unusable. */
export function productToFood(code: string, p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  const v: NutrientVector = NUTRIENTS.map(() => null);
  for (const [off, key, factor] of MAP) {
    const x = num(n[`${off}_100g`]);
    if (x != null && v[NUTRIENT_INDEX[key]] == null) v[NUTRIENT_INDEX[key]] = round(x * factor);
  }
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy-kj_100g'] ?? n['energy_100g']) ?? NaN) / 4.184;
  if (Number.isFinite(kcal)) v[NUTRIENT_INDEX.kcal] = Math.round(kcal);
  // Fill sodium/salt from each other (salt = sodium × 2.5).
  const iNa = NUTRIENT_INDEX.sodium, iSalt = NUTRIENT_INDEX.salt;
  if (v[iNa] == null && v[iSalt] != null) v[iNa] = round((v[iSalt]! / 2.5) * 1000);
  if (v[iSalt] == null && v[iNa] != null) v[iSalt] = round((v[iNa]! * 2.5) / 1000);

  const name = (p.product_name_sv || p.product_name || p.product_name_en || '').trim();
  if (!name || v[NUTRIENT_INDEX.kcal] == null) return null;
  const brand = (p.brands ?? '').split(',')[0].trim();
  const full = (s: string) => (brand && !s.toLowerCase().includes(brand.toLowerCase()) ? `${s} (${brand})` : s);

  const units: Serving[] = [];
  const serving = num(p.serving_quantity);
  if (serving && serving < 5000) units.push({ name: 'portion', g: serving });
  const pack = num(p.product_quantity);
  if (pack && pack < 20000) units.push({ name: 'förpackning', g: pack });

  const en = p.product_name_en?.trim();
  const food: Food = { ref: `off:${code}`, sv: full(name), en: en && en !== name ? full(en) : null, per100g: v };
  if (units.length) food.units = units;
  return food;
}

export class OffError extends Error {
  constructor(public kind: 'notFound' | 'network' | 'noData') {
    super(kind);
  }
}

export async function fetchProduct(code: string, timeoutMs = 10_000): Promise<Food> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${OFF_API}${code}.json?fields=${FIELDS}`, { signal: ctrl.signal });
  } catch {
    throw new OffError('network');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) throw new OffError('notFound');
  if (!res.ok) throw new OffError('network');
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) throw new OffError('notFound');
  const food = productToFood(code, body.product);
  if (!food) throw new OffError('noData');
  return food;
}
