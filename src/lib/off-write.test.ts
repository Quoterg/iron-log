import { afterEach, describe, expect, it, vi } from 'vitest';
import { NUTRIENT_INDEX } from './nutrients';
import { OffWriteError, productForm, uploadProduct, type OffUpload } from './off-write';

const product: OffUpload = {
  code: '7310865004710',
  name: 'Havrekaka',
  brand: 'Bageriet',
  lang: 'sv',
  values: { kcal: 450, fat: 20, carbs: 60, protein: 7, salt: 0.8, sugar: undefined },
};
const login = { user: 'anna', password: 'hemligt' };

describe('Open Food Facts upload', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the label per 100 g with the user’s login and an app comment', () => {
    const f = productForm(product, login);
    expect(f.get('code')).toBe('7310865004710');
    expect([f.get('user_id'), f.get('password')]).toEqual(['anna', 'hemligt']);
    expect(f.get('product_name_sv')).toBe('Havrekaka');
    expect(f.get('brands')).toBe('Bageriet');
    expect(f.get('nutrition_data_per')).toBe('100g');
    expect([f.get('nutriment_energy-kcal'), f.get('nutriment_fat'), f.get('nutriment_salt')]).toEqual(['450', '20', '0.8']);
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
    const photo = new Blob(['x'], { type: 'image/jpeg' });
    const food = await uploadProduct(product, login, { front: photo, nutrition: photo }, 'https://off.test/cgi/');
    expect(calls).toEqual(['product_jqm2.pl', 'product_image_upload.pl front_sv', 'product_image_upload.pl nutrition_sv']);
    expect(food.ref).toBe('off:7310865004710');
    expect(food.sv).toBe('Havrekaka (Bageriet)');
    expect(food.per100g[NUTRIENT_INDEX.kcal]).toBe(450);
    expect(food.per100g[NUTRIENT_INDEX.sodium]).toBe(320); // filled from salt
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
    await expect(uploadProduct(product, login)).rejects.toBeInstanceOf(OffWriteError);
  });

  it('a refused photo does not undo the product', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      new Response(JSON.stringify(url.endsWith('product_jqm2.pl') ? { status: 1 } : { status: 'status not ok', error: 'too small' })),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const food = await uploadProduct(product, login, { front: new Blob(['x'], { type: 'image/jpeg' }) });
    expect(food.ref).toBe('off:7310865004710');
  });
});
