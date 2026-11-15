import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';

// No Web Workers in Node: a stand-in food worker that knows no foods.
(globalThis as { Worker?: unknown }).Worker = class {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  postMessage(msg: { id: number; type: string }) {
    if (msg.type === 'search' || msg.type === 'get') queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, foods: [] } }));
  }
};
(globalThis as { document?: unknown }).document ??= { baseURI: 'http://localhost/' };
import { basalKcal, computeTargets, DEFAULT_PROFILE, energyNeed, nnrTargets, untouchedProfile, type Profile } from './targets';

describe('standard targets without a profile (M65)', () => {
  const std = nnrTargets(DEFAULT_PROFILE);
  const woman = nnrTargets({ sex: 'female', kcal: 2000, menstruating: true });
  const man = nnrTargets({ sex: 'male', kcal: 2000 });

  it('a new user has no sex chosen: standard targets, 2 000 kcal', () => {
    expect(DEFAULT_PROFILE).toMatchObject({ standard: true, kcal: 2000 });
    expect(std.kcal.min).toBe(2000);
  });

  it('cover women and men: the higher recommended intake, the lower limit', () => {
    expect(std.iron.min).toBe(15); // women while menstruating; men 9
    expect(std.fibre.min).toBe(35); // men; women 25
    for (const key of Object.keys(std)) {
      const m = std[key].min;
      if (m != null) expect(m).toBe(Math.max(woman[key]?.min ?? -Infinity, man[key]?.min ?? -Infinity));
      const x = std[key].max;
      if (x != null) expect(x).toBe(Math.min(woman[key]?.max ?? Infinity, man[key]?.max ?? Infinity));
    }
  });

  it('assumes no pregnancy and guesses no energy need from a formula that needs a sex', () => {
    const p: Profile = { ...DEFAULT_PROFILE, age: 40, weightKg: 70, heightCm: 175 };
    expect(basalKcal(p)).toBeNull();
    expect(energyNeed(p)).toBeNull();
    // Katch–McArdle needs no sex: with body fat there is an estimate.
    expect(energyNeed({ ...p, bodyFatPct: 20 })).toBeGreaterThan(0);
    expect(computeTargets({ profile: p }).kcal.min).toBe(2000);
  });

  it('with an age, the age band applies to both sides; iron follows the menstruation default (review #100)', () => {
    const at = (age: number) => nnrTargets({ ...DEFAULT_PROFILE, age });
    expect(at(30).iron.min).toBe(15); // women before 51: 15 mg
    expect(at(68).iron.min).toBe(9); // after menopause women 8, men 9
    expect(at(75).iron.min).toBe(9); // 71+: women 7, men 9
    // Every value covers both sides of the same age band.
    for (const age of [20, 30, 60, 75]) {
      const std = at(age);
      const w = nnrTargets({ sex: 'female', kcal: 2000, age });
      const m = nnrTargets({ sex: 'male', kcal: 2000, age });
      for (const key of Object.keys(std)) {
        if (std[key].min != null) expect(std[key].min).toBe(Math.max(w[key]?.min ?? -Infinity, m[key]?.min ?? -Infinity));
      }
      expect(std.vitD.min).toBe(Math.max(w.vitD.min!, m.vitD.min!));
    }
  });

  it('with an age and a weight, the weight-based targets are set; wholegrain only for adults', () => {
    const std = nnrTargets({ ...DEFAULT_PROFILE, age: 40, weightKg: 70 });
    expect(std.leucine.min).toBe(2.7); // 39 mg/kg × 70 kg, the same for both sexes
    expect(std.wholegrain.min).toBe(Math.round((9 * 2000) / 239.006));
    expect(nnrTargets({ ...DEFAULT_PROFILE, age: 17 }).wholegrain).toBeUndefined();
  });

  it('a target object handed out can be changed without changing the next one', () => {
    const p = { ...DEFAULT_PROFILE };
    const a = nnrTargets(p);
    a.iron = { min: 1, max: null };
    expect(nnrTargets(p).iron.min).toBe(15);
  });

  it('only the untouched old default counts as no profile', () => {
    expect(untouchedProfile({ sex: 'female', kcal: 2000 })).toBe(true);
    expect(untouchedProfile({ sex: 'female', kcal: 2000, age: 30 })).toBe(false);
    expect(untouchedProfile({ sex: 'female', kcal: 1800 })).toBe(false);
    expect(untouchedProfile({ sex: 'female', kcal: 2000, menstruating: false })).toBe(false);
    expect(untouchedProfile({ sex: 'male', kcal: 2500 })).toBe(false);
    expect(untouchedProfile(DEFAULT_PROFILE)).toBe(false);
  });

  it('an old untouched profile becomes the standard one on load, once; a later choice of "Kvinna" sticks', async () => {
    const d = await openDB('iron-log', 1, {
      upgrade(db) {
        db.createObjectStore('entries', { keyPath: 'id' }).createIndex('date', 'date');
        db.createObjectStore('kv');
      },
    });
    await d.put('kv', { lang: 'sv', profile: { sex: 'female', kcal: 2000, pal: 1.2 }, targetOverrides: {}, version: 3, welcomed: true }, 'settings');
    d.close();
    const state = await import('../state');
    const db = await import('./db');
    await state.loadSettings();
    expect(state.settings.value.profile.standard).toBe(true);
    expect((await db.getSettings())?.profile.standard).toBe(true);

    // Picking "Kvinna" (what the profile form saves) is not undone by the next start.
    await db.saveSettings({ ...state.settings.value, profile: { sex: 'female', kcal: 2000, pal: 1.2 } });
    await state.loadSettings();
    expect(state.settings.value.profile.standard).toBeUndefined();
  });
});
