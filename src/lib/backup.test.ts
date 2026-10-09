import { describe, expect, it } from 'vitest';
import { BackupError, makeBackup, parseBackup, toCsv } from './backup';
import type { AllData } from './db';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from './nutrients';

const data: AllData = {
  entries: [{ id: 'e1', date: '2026-10-09', meal: 'lunch', foodRef: 'custom:a', grams: 50, createdAt: 1, unit: 'skopa', qty: 2 }],
  customFoods: [{ ref: 'custom:a', sv: 'Proteinpulver', en: null, per100g: [380, 75], createdAt: 1, updatedAt: 1 }],
  usage: [{ foodRef: 'custom:a', count: 1, lastUsed: 1, lastGrams: 50, fav: true, lastUnit: 'skopa', lastQty: 2 }],
  servings: [{ foodRef: 'custom:a', servings: [{ name: 'skopa', g: 25 }] }],
  offFoods: [{ ref: 'off:7310865004703', sv: 'Yoghurt (Arla)', en: null, per100g: [100], fetchedAt: 3, units: [{ name: 'portion', g: 150 }] }],
  settings: { lang: 'sv', profile: { sex: 'male', kcal: 2500 }, targetOverrides: { iron: { min: 12 } } },
};

describe('backup', () => {
  it('round-trips through JSON', () => {
    const text = JSON.stringify(makeBackup(data, new Date('2026-10-09T10:00:00Z')));
    expect(parseBackup(text)).toEqual(data);
  });

  it('rejects files that are not Iron Log backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError);
    expect(() => parseBackup('{"entries": []}')).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ ...makeBackup(data), version: 99 }))).toThrow(BackupError);
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
      sex: 'female', kcal: 2110, kcalAuto: true, age: 30, weightKg: 60.5, heightCm: 165, pal: 1.6,
      status: 'pregnant2', menstruating: false,
    };
    expect(withProfile(profile)).toEqual(profile);
  });

  it('drops invalid fields instead of failing', () => {
    const p = withProfile({ sex: 'male', kcal: 2500, age: 30.5, heightCm: 500, status: 'astronaut', pal: 1.5 });
    expect(p).toEqual({ sex: 'male', kcal: 2500, pal: 1.6 });
    expect(withProfile({ sex: 'male', kcal: 2500, age: 12 })?.age).toBeUndefined();
  });

  it('keeps automatic energy only with the data it needs', () => {
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

  it('neutralises formulas in food names (CSV injection)', () => {
    const csv = toCsv(data.entries, foods, 'en', (m) => m);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
