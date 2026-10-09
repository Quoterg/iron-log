// Adding a product to Open Food Facts from the app (M20b): the label's nutrition per 100 g and
// photos of the front and the nutrition table, with the user's own OFF account. The login is used
// for this upload only and kept in memory (never stored, backed up or synced). Everything sent is
// published openly on Open Food Facts (ODbL / CC BY-SA). Loaded only on the upload screen.
import { productToFood, type OffProduct } from './off';
import type { Food } from './nutrients';

export const OFF_WRITE = 'https://world.openfoodfacts.org/cgi/';

/** The EU nutrition label, per 100 g: our key → OFF nutriment name. */
export const LABEL: [key: string, off: string][] = [
  ['kcal', 'energy-kcal'],
  ['fat', 'fat'],
  ['satFat', 'saturated-fat'],
  ['carbs', 'carbohydrates'],
  ['sugar', 'sugars'],
  ['fibre', 'fiber'],
  ['protein', 'proteins'],
  ['salt', 'salt'],
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

/** The login of this app session — memory only, gone when the app closes. */
export const offSession: { login?: OffLogin } = {};

export class OffWriteError extends Error {
  constructor(public kind: 'login' | 'rejected' | 'network') {
    super(kind);
  }
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
  for (const [key, off] of LABEL) {
    const v = p.values[key];
    if (v != null && Number.isFinite(v)) f.set(`nutriment_${off}`, String(v));
  }
  f.set('comment', 'Added with Iron Log (https://github.com/Quoterg/iron-log)');
  return f;
}

async function post(url: string, body: FormData): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', body });
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

/** Shrink a photo before upload (old phones, slow networks): longest side ≤ 1600 px, JPEG. */
export async function shrink(file: Blob, max = 1600): Promise<Blob> {
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    if (k === 1 && file.type === 'image/jpeg') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * k);
    canvas.height = Math.round(img.height * k);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('toBlob'))), 'image/jpeg', 0.85));
  } catch {
    return file; // the server can resize too
  }
}

/**
 * Send the product, then the photos. Returns the product as a food (built from what was entered,
 * so it can be logged right away, without waiting for OFF to serve it).
 */
export async function uploadProduct(
  p: OffUpload,
  login: OffLogin,
  photos: { front?: Blob; nutrition?: Blob } = {},
  base = OFF_WRITE,
): Promise<Food> {
  const r = await post(`${base}product_jqm2.pl`, productForm(p, login));
  if (r.status !== 1) {
    const why = String(r.status_verbose ?? '');
    throw new OffWriteError(/user|password|login|log in/i.test(why) ? 'login' : 'rejected');
  }
  for (const [field, blob] of Object.entries(photos)) {
    if (!blob) continue;
    const f = new FormData();
    const imagefield = `${field}_${p.lang}`;
    f.set('code', p.code);
    f.set('user_id', login.user);
    f.set('password', login.password);
    f.set('imagefield', imagefield);
    f.set(`imgupload_${imagefield}`, await shrink(blob), `${field}.jpg`);
    const ir = await post(`${base}product_image_upload.pl`, f);
    // A rejected photo doesn't undo the product; the user can add photos on the OFF site.
    if (ir.status !== 'status ok') console.warn('OFF photo not accepted', field, ir.error ?? ir.status);
  }
  const product: OffProduct = {
    code: p.code,
    product_name: p.name.trim(),
    brands: p.brand?.trim(),
    nutriments: Object.fromEntries(LABEL.filter(([k]) => p.values[k] != null).map(([k, off]) => [`${off}_100g`, p.values[k]])),
  };
  const food = productToFood(p.code, product);
  if (!food) throw new OffWriteError('rejected');
  return food;
}
