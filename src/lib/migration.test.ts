import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { computeTargets, energyNeed, migrateEnergyProfile, type Profile } from './targets';

const old: Profile = { sex: 'female', kcal: 2110, kcalAuto: true, age: 30, weightKg: 60, heightCm: 165 };

describe('one-time move to tdeecalculator.net activity levels', () => {
  it('an unset level (NNR 1.6) becomes moderate 1.55, and a changed auto target is flagged', () => {
    const { profile, kcalChanged } = migrateEnergyProfile(old);
    expect(profile.pal).toBe(1.55);
    expect(profile.kcal).toBe(2046); // 1320.25 × 1.55
    expect(kcalChanged).toBe(true);
  });

  it('manual energy targets are left alone; NNR-style levels snap to the nearest', () => {
    const { profile, kcalChanged } = migrateEnergyProfile({ ...old, kcalAuto: false, pal: 1.8 });
    expect(profile).toMatchObject({ kcal: 2110, pal: 1.725 });
    expect(kcalChanged).toBe(false);
  });

  it('runs once on load, is saved, and survives the next load unchanged', async () => {
    const d = await openDB('iron-log', 1, {
      upgrade(db) {
        db.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('kv');
      },
    });
    await d.put('kv', { lang: 'sv', profile: old, targetOverrides: { iron: 12 } }, 'settings');
    d.close();

    const state = await import('../state');
    const db = await import('./db');
    await state.loadSettings();
    expect(state.settings.value.profile).toMatchObject({ pal: 1.55, kcal: 2046 });
    expect(state.settings.value.energyNotice).toBe(true);
    expect(state.settings.value.targetOverrides).toEqual({ iron: { min: 12 } });
    const saved = await db.getSettings();
    expect(saved?.version).toBe(db.SETTINGS_VERSION);

    // A second load doesn't migrate again (e.g. the user's later choice of sedentary sticks).
    await db.saveSettings({ ...saved!, profile: { ...saved!.profile, pal: 1.2 }, energyNotice: false });
    await state.loadSettings();
    expect(state.settings.value.profile.pal).toBe(1.2);
    expect(state.settings.value.energyNotice).toBe(false);
  });
});

describe('Katch–McArdle without age', () => {
  it('gives an energy need from weight + body fat; targets fall back to the 25–50 band', () => {
    const p: Profile = { sex: 'female', kcal: 2000, weightKg: 60, bodyFatPct: 25, pal: 1.2 };
    expect(energyNeed(p)).toBe(Math.round((370 + 21.6 * 45) * 1.2));
    const t = computeTargets({ profile: { ...p, kcal: energyNeed(p)! } });
    expect(t.calcium.min).toBe(950);
    expect(t.kcal.min).toBe(energyNeed(p));
  });
});
