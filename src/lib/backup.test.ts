import { describe, expect, it } from 'vitest';
import { BackupError, makeBackup, parseBackup, SYNC_VALIDATORS, toCsv } from './backup';
import { SETTINGS_VERSION, type AllData } from './db';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';

const data: AllData = {
  entries: [{ id: 'e1', date: '2026-10-09', meal: 'lunch', foodRef: 'custom:a', grams: 50, createdAt: 1, unit: 'skopa', qty: 2 }],
  customFoods: [{ ref: 'custom:a', sv: 'Proteinpulver', en: null, per100g: [380, 75], createdAt: 1, updatedAt: 1 }],
  usage: [{ foodRef: 'custom:a', count: 1, lastUsed: 1, lastGrams: 50, fav: true, lastUnit: 'skopa', lastQty: 2, amounts: [{ grams: 30 }, { grams: 50, unit: 'skopa', qty: 2 }] }],
  servings: [{ foodRef: 'custom:a', servings: [{ name: 'skopa', g: 25 }] }],
  body: [{ date: '2026-10-08', weightKg: 80.4, waistCm: 90, updatedAt: 3 }],
  activities: [{ id: 'a1', date: '2026-10-08', type: 'run10', minutes: 30, kcal: 308, createdAt: 4 }],
  water: [{ date: '2026-10-08', ml: 1500 }],
  templates: [
    {
      id: 't1', name: 'Frukost', createdAt: 1, updatedAt: 2,
      items: [{ foodRef: 'slv:1', grams: 300, unit: 'dl', qty: 3 }, { foodRef: 'custom:a', grams: 25 }],
    },
  ],
  recipes: [
    {
      ref: 'recipe:r1', name: 'Gröt', ingredients: [{ foodRef: 'slv:1', grams: 100, unit: 'dl', qty: 3 }],
      servings: 2, cookedWeightG: 300, createdAt: 1, updatedAt: 2, per100g: NUTRIENTS.map((_, i) => (i === 0 ? 120 : null)), portionG: 150, totalG: 300,
    },
  ],
  offFoods: [{ ref: 'off:7310865004703', sv: 'Yoghurt (Arla)', en: null, per100g: [100], fetchedAt: 3, units: [{ name: 'portion', g: 150 }] }],
  days: [{ date: '2026-10-08', updatedAt: 5 }],
  shopping: [
    { id: 's1', foodRef: 'slv:1', grams: 300, updatedAt: 6 },
    { id: 's2', text: 'Tandkräm', checked: true, kr: 25, updatedAt: 7 },
  ],
  prices: [{ foodRef: 'slv:1', krPerKg: 21.33, updatedAt: 8 }],
  settings: { lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: { iron: { min: 12 } }, version: SETTINGS_VERSION, adaptive: true, goal: 'lose', pace: 0.5, costs: true },
};

describe('backup', () => {
  it('round-trips through JSON', () => {
    const text = JSON.stringify(makeBackup(data, new Date('2026-10-09T10:00:00Z')));
    expect(parseBackup(text)).toEqual(data);
  });

  it('accepts backups from before recipes existed, and pads short nutrient vectors', () => {
    const old = { format: 'iron-log-backup', version: 1, entries: [], customFoods: [], usage: [] };
    expect(parseBackup(JSON.stringify(old)).recipes).toEqual([]);
    const short = { ...data.recipes[0], per100g: [120, null] };
    const r = parseBackup(JSON.stringify(makeBackup({ ...data, recipes: [short] }))).recipes[0];
    expect(r.per100g).toHaveLength(NUTRIENTS.length);
    expect(r.per100g.slice(0, 2)).toEqual([120, null]);
  });

  it('rejects files that are not Iron Log backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"entries": []}')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ ...makeBackup(data), version: 99 }))).toThrow(BackupError);
  });

  it('round-trips supplements and rejects invalid supplement info', () => {
    const supp = { ...data.customFoods[0], ref: 'custom:s', supplement: { unit: 'kapsel', perDay: 2 } };
    const text = (s: object) => JSON.stringify(makeBackup({ ...data, customFoods: [{ ...supp, ...s }] }));
    expect(parseBackup(text({})).customFoods[0].supplement).toEqual({ unit: 'kapsel', perDay: 2 });
    expect(() => parseBackup(text({ supplement: { unit: '', perDay: 1 } }))).toThrow(BackupError);
    expect(() => parseBackup(text({ supplement: { unit: 'st', perDay: -1 } }))).toThrow(BackupError);
  });

  it('refuses invalid prices; drops an invalid typed line price', () => {
    const parse = (extra: object) => parseBackup(JSON.stringify({ ...makeBackup(data), ...extra }));
    for (const krPerKg of [-1, 0, 'x', NaN, 1e5]) {
      expect(() => parse({ prices: [{ foodRef: 'slv:1', krPerKg, updatedAt: 1 }] }), String(krPerKg)).toThrow(BackupError);
    }
    for (const kr of [-5, 'x', 1e5]) {
      expect(parse({ shopping: [{ id: 'a', text: 'Tandkräm', kr, updatedAt: 1 }] }).shopping![0].kr, String(kr)).toBeUndefined();
    }
  });

  it('keeps a whole shopping list (never cut silently); refuses only absurd sizes and invalid items', () => {
    const items = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, text: `Vara ${i}`, updatedAt: 1 }));
    const parse = (shopping: unknown[]) => parseBackup(JSON.stringify({ ...makeBackup(data), shopping }));
    expect(parse(items(350)).shopping).toHaveLength(350);
    expect(() => parse(items(3001))).toThrow(BackupError);
    expect(() => parse([{ id: 'x', updatedAt: 1 }])).toThrow(BackupError); // neither food nor text
    expect(() => parse([{ id: 'x', foodRef: 'slv:1', grams: -5, updatedAt: 1 }])).toThrow(BackupError);
  });

  it('validates saved meals and drops invalid remembered amounts', () => {
    const bad = (t: object) => () => parseBackup(JSON.stringify(makeBackup({ ...data, templates: [{ ...data.templates![0], ...t }] })));
    expect(bad({ items: [] })).toThrow(BackupError);
    expect(bad({ name: ' ' })).toThrow(BackupError);
    expect(bad({ items: [{ foodRef: 'slv:1', grams: -1 }] })).toThrow(BackupError);
    expect(bad({ items: Array(51).fill({ foodRef: 'slv:1', grams: 1 }) })).toThrow(BackupError);
    expect(bad({ name: '  Frukost ' })().templates![0].name).toBe('Frukost'); // trimmed, like the app saves it
    const usage = [{ ...data.usage[0], amounts: [{ grams: 0 }, 'x', { grams: 40, unit: 'skopa' }] }];
    expect(parseBackup(JSON.stringify({ ...makeBackup(data), usage })).usage[0].amounts).toEqual([{ grams: 40 }]);
  });

  it('rejects the whole file if any item is invalid', () => {
    const bad = (patch: object) =>
      JSON.stringify({ ...makeBackup(data), entries: [{ ...data.entries[0], ...patch }] });
    expect(() => parseBackup(bad({ grams: -5 }))).toThrow(BackupError);
    expect(() => parseBackup(bad({ date: '9 okt' }))).toThrow(BackupError);
    expect(() => parseBackup(bad({ meal: 'brunch' }))).toThrow(BackupError);
    expect(() => parseBackup(bad({ unit: 'st', qty: 0 }))).toThrow(BackupError);
  });

  it('drops invalid settings and unknown target keys instead of failing', () => {
    const b = makeBackup({ ...data, settings: { lang: 'xx' } as never });
    expect(parseBackup(JSON.stringify(b)).settings).toBeUndefined();
    const c = makeBackup({ ...data, settings: { ...data.settings!, targetOverrides: { iron: 12, evil: 1, zinc: -1 } as never } });
    expect(parseBackup(JSON.stringify(c)).settings?.targetOverrides).toEqual({ iron: { min: 12 } });
  });
});

describe('profile import', () => {
  const withProfile = (profile: object) =>
    parseBackup(JSON.stringify({ ...makeBackup(data), settings: { lang: 'sv', profile, targetOverrides: {} } })).settings
      ?.profile;

  it('round-trips the full profile', () => {
    const profile = {
      sex: 'female', kcal: 2110, kcalAuto: true, age: 30, weightKg: 60.5, heightCm: 165, bodyFatPct: 27.5, pal: 1.55,
      status: 'pregnant2', menstruating: false,
    };
    expect(withProfile(profile)).toEqual(profile);
  });

  it('drops invalid fields instead of failing', () => {
    const p = withProfile({ sex: 'male', kcal: 2500, age: 30.5, heightCm: 500, status: 'astronaut', pal: 1.5 });
    expect(p).toEqual({ sex: 'male', kcal: 2500, pal: 1.55 });
    expect(withProfile({ sex: 'male', kcal: 2500, bodyFatPct: 95 })?.bodyFatPct).toBeUndefined();
    expect(withProfile({ sex: 'male', kcal: 2500, bodyFatPct: '20' })?.bodyFatPct).toBeUndefined();
    expect(withProfile({ sex: 'male', kcal: 2500, pal: 1.1 })?.pal).toBe(1.2);
    expect(withProfile({ sex: 'male', kcal: 2500, pal: 0.5 })?.pal).toBeUndefined();
    expect(withProfile({ sex: 'male', kcal: 2500, age: 12 })?.age).toBeUndefined();
  });

  it('round-trips macro presets and custom ranges; invalid custom falls back to NNR', () => {
    const settingsOf = (extra: object) =>
      parseBackup(
        JSON.stringify({
          ...makeBackup(data),
          settings: { lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: {}, ...extra },
        }),
      ).settings;
    const pct = { protein: [30, 40], carbs: [20, 40], fat: [25, 45] };
    expect(settingsOf({ macroPreset: 'custom', macroPct: pct })).toMatchObject({ macroPreset: 'custom', macroPct: pct });
    expect(settingsOf({ macroPreset: 'keto' })?.macroPreset).toBe('keto');
    expect(settingsOf({ macroPreset: 'custom', macroPct: { protein: [50, 10] } })?.macroPreset).toBe('nnr');
    expect(settingsOf({ macroPreset: 'carnivore' })?.macroPreset).toBeUndefined();
  });

  it('round-trips fruit in season and its origin choice (M40); an unknown origin is dropped', () => {
    const settingsOf = (extra: object) =>
      parseBackup(
        JSON.stringify({
          ...makeBackup(data),
          settings: { lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: {}, ...extra },
        }),
      ).settings;
    expect(settingsOf({ fruit: true, fruitReach: 'sweden' })).toMatchObject({ fruit: true, fruitReach: 'sweden' });
    expect(settingsOf({ fruit: 'yes', fruitReach: 'mars' })).not.toHaveProperty('fruit');
    expect(settingsOf({ fruitReach: 'mars' })).not.toHaveProperty('fruitReach');
    // Sync validates settings with the same rules.
    expect(SYNC_VALIDATORS.kv({ lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: {}, fruit: true, fruitReach: 'any' })).toMatchObject({ fruit: true, fruitReach: 'any' });
  });

  it('keeps automatic energy only with the data a formula needs', () => {
    expect(withProfile({ sex: 'male', kcal: 2500, kcalAuto: true, weightKg: 80, bodyFatPct: 20 })?.kcalAuto).toBe(true);
    expect(withProfile({ sex: 'male', kcal: 2500, kcalAuto: true, age: 40 })?.kcalAuto).toBeUndefined();
  });
});

describe('csv', () => {
  const v = new Array(NUTRIENTS.length).fill(null);
  v[NUTRIENT_INDEX.kcal] = 380;
  v[NUTRIENT_INDEX.protein] = 75.5;
  const foods = new Map<string, Food>([['custom:a', { ref: 'custom:a', sv: '=HYPERLINK("x")', en: null, per100g: v }]]);

  it('uses ; and decimal comma in Swedish, with all nutrients for the amount', () => {
    const csv = toCsv(data.entries, foods, 'sv', (m) => (m === 'lunch' ? 'Lunch' : m));
    const [head, row] = csv.replace('﻿', '').trim().split('\r\n');
    expect(head.split(';').slice(0, 5)).toEqual(['Datum', 'Måltid', 'Livsmedel', 'Mängd (g)', 'Energi (kcal)']);
    const cells = row.split(';');
    expect(cells[0]).toBe('2026-10-09');
    expect(cells[4]).toBe('190');
    expect(cells[4 + NUTRIENT_INDEX.protein]).toBe('37,75');
    expect(cells[4 + NUTRIENT_INDEX.iron]).toBe(''); // unknown, not 0
  });

  it('follows the locale: ; and decimal comma for German and Finnish, , and point for English', () => {
    for (const lang of ['de', 'fi', 'da'] as const) {
      const row = toCsv(data.entries, foods, lang, (m) => m).replace('\ufeff', '').trim().split('\r\n')[1];
      expect(row.split(';')[4 + NUTRIENT_INDEX.protein], lang).toBe('37,75');
    }
    const en = toCsv(data.entries, foods, 'en', (m) => m).replace('\ufeff', '').trim().split('\r\n');
    expect(en[0].startsWith('Date,Meal,Food,Amount (g),')).toBe(true);
    expect(en[1].split(',')[4 + NUTRIENT_INDEX.protein]).toBe('37.75');
  });

  it('uses the labels it is given (the app passes translated ones)', () => {
    const labels = { date: 'Datum', meal: 'Mahlzeit', food: 'Name', amount: 'Menge (g)', supplements: 'Ergänzung', nutrient: () => 'X' };
    const head = toCsv(data.entries, foods, 'de', (m) => m, new Set(), labels).replace('\ufeff', '').split('\r\n')[0];
    expect(head.split(';').slice(0, 5)).toEqual(['Datum', 'Mahlzeit', 'Name', 'Menge (g)', 'X (kcal)']);
  });

  it('neutralises formulas in food names (CSV injection)', () => {
    const csv = toCsv(data.entries, foods, 'en', (m) => m);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
