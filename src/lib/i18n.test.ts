import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITIES } from './activity-types';
import { NUTRIENTS } from './nutrients';
import type { Dict, LangPack } from './i18n';

// The Swedish strings are the source of truth (built into i18n.ts); read them through t().
async function swedish(): Promise<Dict> {
  const i18n = await import('./i18n');
  i18n.lang.value = 'sv';
  const en = (await import('./lang/en')).default.strings as Dict;
  return Object.fromEntries(Object.keys(en).map((k) => [k, i18n.t(k as keyof Dict)])) as Dict;
}

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
const UNITS = ['st', 'dl', 'msk', 'tsk', 'skiva', 'glas', 'kopp', 'portion', 'smörgås', 'förpackning', 'helaReceptet'];

describe('language packs', () => {
  it('English covers every Swedish string', async () => {
    const sv = await swedish();
    const en = (await import('./lang/en')).default.strings;
    expect(Object.keys(en).sort()).toEqual(Object.keys(sv).sort());
  });

  for (const code of ['da', 'de', 'fi', 'so'] as const) {
    it(`${code}: known keys only, placeholders kept, ≥ 95 % translated, all nutrients/activities/units`, async () => {
      const sv = await swedish();
      const pack: LangPack = (await import(`./lang/${code}.ts`)).default;
      const keys = Object.keys(pack.strings);
      expect(keys.filter((k) => !(k in sv))).toEqual([]);
      for (const k of keys) {
        expect(placeholders(pack.strings[k as keyof Dict]!), `${code}.${k}`).toEqual(placeholders(sv[k as keyof Dict]));
      }
      expect(keys.length / Object.keys(sv).length).toBeGreaterThanOrEqual(0.95);
      expect(Object.keys(pack.nutrients ?? {}).sort()).toEqual(NUTRIENTS.map((n) => n.key).sort());
      expect(Object.keys(pack.activities ?? {}).sort()).toEqual(ACTIVITIES.map((a) => a.id).sort());
      expect(Object.keys(pack.units ?? {}).sort()).toEqual([...UNITS].sort());
    });
  }

  for (const section of ['sync', 'off'] as const) {
    it(`every pack has every ${section}-screen string, with its placeholders`, async () => {
      const en = (await import('./lang/en')).default[section]!;
      for (const code of ['da', 'de', 'fi', 'so'] as const) {
        const own = (await import(`./lang/${code}.ts`)).default[section] as Record<string, string>;
        expect(Object.keys(own).sort(), code).toEqual(Object.keys(en).sort());
        for (const k of Object.keys(en)) expect(placeholders(own[k]), `${code}.${k}`).toEqual(placeholders(en[k]));
      }
    });
  }

  it('loads a language on demand and falls back to English for missing strings', async () => {
    const i18n = await import('./i18n');
    await i18n.loadLang('de');
    i18n.lang.value = 'de';
    expect(i18n.t('diary')).toBe('Tagebuch');
    expect(i18n.nutrientName(NUTRIENTS.find((n) => n.key === 'iron')!)).toBe('Eisen');
    expect(i18n.unitLabel('msk')).toBe('EL');
    expect(i18n.unitLabel('min skål')).toBe('min skål'); // user-defined measures as typed
    expect(i18n.fmt(1.5, 1)).toBe('1,5');
    expect(i18n.dataLang()).toBe('en'); // German users see English food names
    i18n.lang.value = 'sv';
  });
});

describe('detectLang', () => {
  afterEach(() => vi.unstubAllGlobals());
  const detect = async (language: string) => {
    vi.stubGlobal('navigator', { language });
    return (await import('./i18n')).detectLang();
  };
  it('picks a supported browser language, Swedish for Norwegian, English otherwise', async () => {
    expect(await detect('sv-SE')).toBe('sv');
    expect(await detect('fi-FI')).toBe('fi');
    expect(await detect('so')).toBe('so');
    expect(await detect('nb-NO')).toBe('sv');
    expect(await detect('fr-FR')).toBe('en');
  });
});
