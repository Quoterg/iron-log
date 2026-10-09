import { afterEach, describe, expect, it, vi } from 'vitest';
import { NUTRIENT_INDEX } from './nutrients';
import { implausible, OffWriteError, productForm, uploadProduct, type OffUpload } from './off-write';

const product: OffUpload = {
  code: '7310865004710',
  name: 'Havrekaka',
  brand: 'Bageriet',
  lang: 'sv',
  values: { kcal: 450, fat: 20, carbs: 60, protein: 7, salt: 0.8, sugar: undefined },
};
const login = { user: 'anna', password: 'hemligt' };
const photo = () => new Blob(['x'], { type: 'image/jpeg' });
const opts = { base: 'https://off.test/cgi/' };

describe('Open Food Facts upload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the label per 100 g with explicit units, the login and an app comment', () => {
    const f = productForm(product, login);
    expect(f.get('code')).toBe('7310865004710');
    expect([f.get('user_id'), f.get('password')]).toEqual(['anna', 'hemligt']);
    expect(f.get('product_name_sv')).toBe('Havrekaka');
    expect(f.get('brands')).toBe('Bageriet');
    expect(f.get('nutrition_data_per')).toBe('100g');
    expect([f.get('nutriment_energy-kcal'), f.get('nutriment_energy-kcal_unit')]).toEqual(['450', 'kcal']);
    expect([f.get('nutriment_salt'), f.get('nutriment_salt_unit')]).toEqual(['0.8', 'g']);
    expect(f.has('nutriment_sugars')).toBe(false); // not on the label → not sent
    expect(String(f.get('comment'))).toContain('Iron Log');
  });

  it('uploads the product and its photos, and returns it as a food to log', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${url.split('/').pop()} ${(init.body as FormData).get('imagefield') ?? ''}`.trim());
      const body = url.endsWith('product_jqm2.pl') ? { status: 1, status_verbose: 'fields saved' } : { status: 'status ok' };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const r = await uploadProduct(product, login, { front: photo(), nutrition: photo() }, opts);
    expect(calls[0]).toBe('product_jqm2.pl');
    expect(calls.slice(1).sort()).toEqual(['product_image_upload.pl front_sv', 'product_image_upload.pl nutrition_sv']);
    expect(r.photosFailed).toEqual([]);
    expect(r.food.ref).toBe('off:7310865004710');
    expect(r.food.sv).toBe('Havrekaka (Bageriet)');
    expect(r.food.per100g[NUTRIENT_INDEX.kcal]).toBe(450);
    expect(r.food.per100g[NUTRIENT_INDEX.sodium]).toBe(320); // filled from salt
  });

  it('a photo that fails (refused or network) never undoes the product', async () => {
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (url.endsWith('product_jqm2.pl')) return new Response(JSON.stringify({ status: 1 }));
      if ((init.body as FormData).get('imagefield') === 'front_sv') throw new TypeError('network down');
      return new Response(JSON.stringify({ status: 'status not ok', error: 'too small' }));
    });
    const r = await uploadProduct(product, login, { front: photo(), nutrition: photo() }, opts);
    expect(r.food.ref).toBe('off:7310865004710');
    expect(r.photosFailed.sort()).toEqual(['front', 'nutrition']);
  });

  it('tells a wrong login apart from other refusals and network errors', async () => {
    const reply = (body: object, status = 200) => vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status }));
    reply({ status: 0, status_verbose: 'Incorrect user name or password' });
    await expect(uploadProduct(product, login)).rejects.toMatchObject({ kind: 'login' });
    reply({ status: 0, status_verbose: 'no code or invalid code' });
    await expect(uploadProduct(product, login)).rejects.toMatchObject({ kind: 'rejected' });
    reply({}, 403);
    await expect(uploadProduct(product, login)).rejects.toMatchObject({ kind: 'login' });
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('offline');
    });
    await expect(uploadProduct(product, login)).rejects.toMatchObject({ kind: 'network' });
  });

  it('refuses before sending anything: invalid barcode, missing energy, implausible label', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(uploadProduct({ ...product, code: '123' }, login)).rejects.toBeInstanceOf(OffWriteError);
    await expect(uploadProduct({ ...product, values: { fat: 1 } }, login)).rejects.toBeInstanceOf(OffWriteError);
    await expect(uploadProduct({ ...product, values: { kcal: 1880 } }, login)).rejects.toBeInstanceOf(OffWriteError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('flags labels that cannot be right', () => {
    expect(implausible({ kcal: 450, fat: 20, carbs: 60, protein: 7 })).toBeNull();
    expect(implausible({ kcal: 450, protein: 150 })).toBe('macros'); // "15,0" typed as 150
    expect(implausible({ kcal: 400, carbs: 10, sugar: 20 })).toBe('parts');
    expect(implausible({ kcal: 400, fat: 5, satFat: 9 })).toBe('parts');
    expect(implausible({ kcal: 500, fat: 60, carbs: 50 })).toBe('sum');
    expect(implausible({ kcal: 1880 })).toBe('kcal'); // kJ entered as kcal
  });
});
