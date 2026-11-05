import { afterEach, describe, expect, it, vi } from 'vitest';
import { NUTRIENTS } from './nutrients';
import type { Dict, LangPack } from './i18n';

// The Swedish strings are the source of truth (built into i18n.ts); read them through t().
async function swedish(): Promise<Dict> {
  const i18n = await import('./i18n');
  await import('./strings-later'); // the later screens' Swedish strings (M39b)
  i18n.lang.value = 'sv';
  const en = (await import('./lang/en')).default.strings as Dict;
  return Object.fromEntries(Object.keys(en).map((k) => [k, i18n.t(k as keyof Dict)])) as Dict;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('language packs', () => {
  it('English covers every Swedish string', async () => {
    const sv = await swedish();
    const en = (await import('./lang/en')).default.strings;
    expect(Object.keys(en).sort()).toEqual(Object.keys(sv).sort());
  });

  it('en: known keys only, placeholders kept (names of nutrients, activities and units come from the data)', async () => {
    const sv = await swedish();
    const pack: LangPack = (await import('./lang/en')).default;
    const keys = Object.keys(pack.strings);
    expect(keys.filter((k) => !(k in sv))).toEqual([]);
    for (const k of keys) expect(placeholders(pack.strings[k as keyof Dict]!), `en.${k}`).toEqual(placeholders(sv[k as keyof Dict]));
  });

  it('only Swedish and English (M41c); a removed language maps to the nearest one', async () => {
    const i18n = await import('./i18n');
    expect(i18n.LANGS.map((l) => l.code)).toEqual(['sv', 'en']);
    expect(i18n.toLang('da')).toBe('sv');
    expect(i18n.toLang('de')).toBe('en');
    expect(i18n.toLang('fi')).toBe('en');
    expect(i18n.toLang('so')).toBe('en');
    expect(i18n.toLang('xx')).toBeUndefined();
  });

  it('loads a language on demand and falls back to English for missing strings', async () => {
    const i18n = await import('./i18n');
    await i18n.loadLang('en');
    i18n.lang.value = 'en';
    expect(i18n.t('diary')).toBe('Diary');
    expect(i18n.nutrientName(NUTRIENTS.find((n) => n.key === 'iron')!)).toBe('Iron');
    expect(i18n.unitLabel('msk')).toBe('tbsp');
    expect(i18n.unitLabel('min skål')).toBe('min skål'); // user-defined measures as typed
    expect(i18n.fmt(1.5, 1)).toBe('1.5');
    expect(i18n.dataLang()).toBe('en');
    i18n.lang.value = 'sv';
  });
});

describe('detectLang', () => {
  afterEach(() => vi.unstubAllGlobals());
  const detect = async (language: string) => {
    vi.stubGlobal('navigator', { language });
    return (await import('./i18n')).detectLang();
  };
  it('Swedish for Swedish, Danish and Norwegian browsers, English otherwise', async () => {
    expect(await detect('sv-SE')).toBe('sv');
    expect(await detect('da-DK')).toBe('sv');
    expect(await detect('nb-NO')).toBe('sv');
    expect(await detect('fi-FI')).toBe('en');
    expect(await detect('so')).toBe('en');
    expect(await detect('fr-FR')).toBe('en');
  });
});
