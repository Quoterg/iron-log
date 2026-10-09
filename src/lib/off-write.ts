// Adding a product to Open Food Facts from the app (M20b): the label's nutrition per 100 g and
// photos of the front and the nutrition table, with the user's own OFF account. The password is
// used for this upload only and never kept (only the username is remembered, in memory, for the
// app session). Everything sent is published openly on Open Food Facts (ODbL / CC BY-SA).
// Loaded only on the upload screen.
import { isValidBarcode, productToFood, type OffProduct } from './off';
import type { Food } from './nutrients';

export const OFF_WRITE = 'https://world.openfoodfacts.org/cgi/';

/** The EU nutrition label, per 100 g: our key → OFF nutriment name and unit. */
export const LABEL: [key: string, off: string, unit: string][] = [
  ['kcal', 'energy-kcal', 'kcal'],
  ['fat', 'fat', 'g'],
  ['satFat', 'saturated-fat', 'g'],
  ['carbs', 'carbohydrates', 'g'],
  ['sugar', 'sugars', 'g'],
  ['fibre', 'fiber', 'g'],
  ['protein', 'proteins', 'g'],
  ['salt', 'salt', 'g'],
];

export interface OffUpload {
  code: string;
  name: string;
  brand?: string;
  /** Language the name is in (the UI language). */
  lang: string;
  /** Per 100 g, by our nutrient key (LABEL); missing = not on the label. */
  values: Record<string, number | undefined>;
}

export interface OffLogin {
  user: string;
  password: string;
}

/** What this app session remembers: the username only (memory; gone when the app closes). */
export const offSession: { user?: string } = {};

export class OffWriteError extends Error {
  constructor(public kind: 'login' | 'rejected' | 'network') {
    super(kind);
  }
}

/** Why a label can't be right (published data should be plausible), or null if it looks fine. */
export function implausible(v: Record<string, number | undefined>): 'macros' | 'parts' | 'sum' | 'kcal' | null {
  const g = (k: string) => v[k] ?? 0;
  if (['fat', 'satFat', 'carbs', 'sugar', 'fibre', 'protein', 'salt'].some((k) => g(k) > 100)) return 'macros';
  if (g('sugar') > g('carbs') + 0.05 || g('satFat') > g('fat') + 0.05) return 'parts';
  if (g('fat') + g('carbs') + g('protein') + g('fibre') + g('salt') > 105) return 'sum';
  if (g('kcal') > 900) return 'kcal';
  return null;
}

/** Form fields for OFF's product write API (product_jqm2.pl). */
export function productForm(p: OffUpload, login: OffLogin): FormData {
  const f = new FormData();
  f.set('code', p.code);
  f.set('user_id', login.user);
  f.set('password', login.password);
  f.set('lang', p.lang);
  f.set(`product_name_${p.lang}`, p.name.trim());
  if (p.brand?.trim()) f.set('brands', p.brand.trim());
  f.set('nutrition_data_per', '100g');
  for (const [key, off, unit] of LABEL) {
    const v = p.values[key];
    if (v == null || !Number.isFinite(v)) continue;
    f.set(`nutriment_${off}`, String(v));
    f.set(`nutriment_${off}_unit`, unit);
  }
  f.set('comment', 'Added with Iron Log (https://github.com/Quoterg/iron-log)');
  return f;
}

async function post(url: string, body: FormData, signal: AbortSignal): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body, signal });
  } catch {
    throw new OffWriteError('network');
  }
  if (res.status === 401 || res.status === 403) throw new OffWriteError('login');
  if (!res.ok) throw new OffWriteError('rejected');
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    throw new OffWriteError('rejected');
  }
}

/** Give up after `ms`, or when `outer` aborts (the sheet closed). */
function deadline(ms: number, outer?: AbortSignal): AbortSignal {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), ms);
  outer?.addEventListener('abort', () => c.abort(), { once: true });
  c.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return c.signal;
}

/**
 * Shrink a photo for upload (old phones, slow networks): decoded straight at ≤ 1600 px wide, so a
 * 12 MP photo never sits in memory at full size; JPEG. Call it when the photo is chosen.
 */
export async function shrink(file: Blob, width = 1600): Promise<Blob> {
  let img: ImageBitmap | undefined;
  try {
    img = await createImageBitmap(file, { resizeWidth: width, resizeQuality: 'medium' });
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('toBlob'))), 'image/jpeg', 0.85));
  } catch {
    return file; // the server can resize too
  } finally {
    img?.close();
  }
}

export interface UploadResult {
  /** The product as a food, built from what was entered (logged right away). */
  food: Food;
  /** Photos that didn't arrive (the product itself is saved; add them on the OFF site). */
  photosFailed: string[];
}

/** Send the product, then its photos (in parallel). A failed photo never undoes the product. */
export async function uploadProduct(
  p: OffUpload,
  login: OffLogin,
  photos: { front?: Blob; nutrition?: Blob } = {},
  opts: { base?: string; signal?: AbortSignal } = {},
): Promise<UploadResult> {
  const base = opts.base ?? OFF_WRITE;
  if (!isValidBarcode(p.code) || !p.name.trim() || p.values.kcal == null || implausible(p.values)) throw new OffWriteError('rejected');
  const r = await post(`${base}product_jqm2.pl`, productForm(p, login), deadline(30_000, opts.signal));
  if (r.status !== 1) {
    const why = String(r.status_verbose ?? '');
    throw new OffWriteError(/user|password|login|log in/i.test(why) ? 'login' : 'rejected');
  }
  const sent = await Promise.allSettled(
    Object.entries(photos)
      .filter((e): e is [string, Blob] => !!e[1])
      .map(async ([field, blob]) => {
        const imagefield = `${field}_${p.lang}`;
        const f = new FormData();
        f.set('code', p.code);
        f.set('user_id', login.user);
        f.set('password', login.password);
        f.set('imagefield', imagefield);
        f.set(`imgupload_${imagefield}`, blob, `${field}.jpg`);
        const ir = await post(`${base}product_image_upload.pl`, f, deadline(60_000, opts.signal));
        if (ir.status !== 'status ok') throw new Error('not accepted');
        return field;
      }),
  );
  const fields = Object.keys(photos).filter((k) => photos[k as keyof typeof photos]);
  const photosFailed = fields.filter((_, i) => sent[i].status === 'rejected');

  const product: OffProduct = {
    code: p.code,
    product_name: p.name.trim(),
    brands: p.brand?.trim(),
    nutriments: Object.fromEntries(LABEL.filter(([k]) => p.values[k] != null).map(([k, off]) => [`${off}_100g`, p.values[k]])),
  };
  const food = productToFood(p.code, product);
  if (!food) throw new OffWriteError('rejected');
  return { food, photosFailed };
}
