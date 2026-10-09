import { describe, expect, it } from 'vitest';
import {
  ageBand,
  computeTargets,
  energyNeed,
  nnrTargets,
  normalizeMacroPct,
  normalizeOverrides,
  nnrMacroPct,
  overrideConflicts,
  snapPal,
  withEnergy,
  type Profile,
} from './targets';

const woman = (p: Partial<Profile> = {}): Profile => ({ sex: 'female', kcal: 2000, ...p });
const man = (p: Partial<Profile> = {}): Profile => ({ sex: 'male', kcal: 2500, ...p });
const min = (p: Profile, key: string) => nnrTargets(p)[key].min;

describe('NNR 2023 targets by age, sex and life stage', () => {
  it('switches age band exactly at 25, 51 and 71', () => {
    expect([24, 25, 50, 51, 70, 71].map(ageBand)).toEqual(['18-24', '25-50', '25-50', '51-70', '51-70', '71+']);
  });

  it('pregnancy values do not depend on age (NNR gives one set per trimester)', () => {
    expect(min(woman({ age: 52, status: 'pregnant2' }), 'iron')).toBe(25);
    expect(min(woman({ age: 52, status: 'pregnant2' }), 'vitE')).toBe(11);
  });

  it('uses the 25–50 band when age is unknown', () => {
    expect(ageBand(undefined)).toBe('25-50');
    expect(min(woman(), 'calcium')).toBe(950);
    expect(min(woman(), 'iron')).toBe(15);
  });

  it('18–24: more calcium and phosphorus', () => {
    expect(min(woman({ age: 20 }), 'calcium')).toBe(1000);
    expect(min(man({ age: 24 }), 'phosphorus')).toBe(550);
    expect(min(man({ age: 25 }), 'phosphorus')).toBe(520);
  });

  it('51–70 and 71+: vitamin D, A, E, zinc, selenium and iron change', () => {
    expect(min(woman({ age: 60 }), 'vitE')).toBe(9);
    expect(min(woman({ age: 60 }), 'zinc')).toBe(9.5);
    expect(min(man({ age: 75 }), 'vitD')).toBe(20);
    expect(min(man({ age: 75 }), 'selenium')).toBe(85);
    expect(min(woman({ age: 75 }), 'vitA')).toBe(650);
    expect(min(man({ age: 70 }), 'vitD')).toBe(10);
  });

  it('iron for women follows menstruation, defaulting to age < 51', () => {
    expect(min(woman({ age: 45 }), 'iron')).toBe(15);
    expect(min(woman({ age: 55 }), 'iron')).toBe(8);
    expect(min(woman({ age: 75 }), 'iron')).toBe(7);
    expect(min(woman({ age: 55, menstruating: true }), 'iron')).toBe(15);
    expect(min(woman({ age: 40, menstruating: false }), 'iron')).toBe(8);
    expect(min(man({ age: 55 }), 'iron')).toBe(9);
  });

  it('pregnancy by trimester and lactation', () => {
    expect(min(woman({ status: 'pregnant1' }), 'iron')).toBe(24);
    expect(min(woman({ status: 'pregnant3' }), 'iron')).toBe(26);
    expect(min(woman({ status: 'pregnant2' }), 'folate')).toBe(600);
    expect(min(woman({ status: 'pregnant2' }), 'iodine')).toBe(200);
    expect(min(woman({ status: 'lactating' }), 'vitA')).toBe(1400);
    expect(min(woman({ status: 'lactating' }), 'vitC')).toBe(155);
    // Status is ignored for men.
    expect(min(man({ status: 'pregnant3' }), 'iron')).toBe(9);
  });

  it('older adults get 15–20 E% protein', () => {
    expect(nnrTargets(woman({ age: 70 })).protein).toEqual({ min: 75, max: 100 });
    expect(nnrTargets(woman({ age: 40 })).protein).toEqual({ min: 50, max: 100 });
  });
});

describe('energy need', () => {
  it('matches tdeecalculator.net exactly (results recorded 2026-10-09)', () => {
    // Man 30 y, 80 kg, 180 cm, moderate (1.55): Mifflin → 2,759; with 20 % body fat (Katch–McArdle) → 2,716.
    const m = man({ age: 30, weightKg: 80, heightCm: 180, pal: 1.55 });
    expect(energyNeed(m)).toBe(2759);
    expect(energyNeed({ ...m, bodyFatPct: 20 })).toBe(2716);
    // Woman 40 y, 65 kg, 168 cm, sedentary (1.2): Mifflin → 1,607; with 30 % body fat → 1,623.
    const w = woman({ age: 40, weightKg: 65, heightCm: 168, pal: 1.2 });
    expect(energyNeed(w)).toBe(1607);
    expect(energyNeed({ ...w, bodyFatPct: 30 })).toBe(1623);
  });

  it('Katch–McArdle needs only weight and body fat; defaults to sedentary', () => {
    expect(energyNeed(man({ weightKg: 80, bodyFatPct: 20 }))).toBe(Math.round((370 + 21.6 * 64) * 1.2));
    expect(energyNeed(man({ bodyFatPct: 20 }))).toBeNull();
    expect(energyNeed(man({ age: 40 }))).toBeNull();
  });

  it('adds NNR pregnancy/lactation energy on top (≈ +550 kcal in trimester 3)', () => {
    const w = woman({ age: 30, weightKg: 60, heightCm: 165, pal: 1.2 }); // BMR 1320.25 × 1.2 = 1584.3
    expect(energyNeed(w)).toBe(1584);
    expect(energyNeed({ ...w, status: 'pregnant3' })).toBe(2134);
    expect(energyNeed({ ...w, status: 'lactating' })).toBe(2062);
  });

  it('applies to kcal only when automatic, and turns automatic off when data is missing', () => {
    const p = woman({ age: 30, weightKg: 60, heightCm: 165 });
    expect(withEnergy(p).kcal).toBe(2000);
    expect(withEnergy({ ...p, kcalAuto: true }).kcal).toBe(1584);
    const missing = withEnergy({ ...p, kcalAuto: true, weightKg: undefined, kcal: 2110 });
    expect(missing).toMatchObject({ kcalAuto: false, kcal: 2110 });
  });

  it('snaps activity levels to the tdeecalculator.net levels (migrates the old NNR-style ones)', () => {
    expect([1.4, 1.6, 1.8, 2.0].map(snapPal)).toEqual([1.375, 1.55, 1.725, 1.9]);
    expect([1.0, 1.2, 1.5, 2.5].map(snapPal)).toEqual([1.2, 1.2, 1.55, 1.9]);
  });
});

describe('adjusted targets (presets and overrides)', () => {
  const profile = woman({ kcal: 2000 });

  it('keto: carbs at most 5 E% (25 g), no minimum; fat 70–80 E%', () => {
    const t = computeTargets({ profile, macroPreset: 'keto' });
    expect(t.carbs).toEqual({ min: null, max: 25 });
    expect(t.fat).toEqual({ min: 156, max: 178 });
  });

  it('custom ranges, and per-nutrient min/max overrides win', () => {
    const t = computeTargets({
      profile,
      macroPreset: 'custom',
      macroPct: { protein: [30, 40], carbs: [30, 40], fat: [20, 40] },
      targetOverrides: { protein: { min: 140 }, iron: { min: 18 }, salt: { max: 4 }, vitC: { max: 500 } },
    });
    expect(t.protein).toEqual({ min: 140, max: 200 });
    expect(t.iron).toEqual({ min: 18, max: null });
    expect(t.salt).toEqual({ min: null, max: 4 });
    expect(t.vitC).toEqual({ min: 95, max: 500 });
  });

  it('migrates the old { key: min } override format and drops invalid entries', () => {
    expect(normalizeOverrides({ iron: 12, zinc: { min: 10, max: 40 }, bad: -1, inverted: { min: 5, max: 1 } })).toEqual({
      iron: { min: 12 },
      zinc: { min: 10, max: 40 },
    });
    expect(normalizeOverrides(undefined)).toEqual({});
  });

  it('ignores an override bound that contradicts a later preset (no impossible 130 / 25 g)', () => {
    const s = { profile, macroPreset: 'keto' as const, targetOverrides: { carbs: { min: 130 }, iron: { min: 18 } } };
    expect(computeTargets(s).carbs).toEqual({ min: null, max: 25 });
    expect([...overrideConflicts(s)]).toEqual(['carbs']);
    expect(computeTargets({ ...s, macroPreset: 'nnr' }).carbs).toEqual({ min: 130, max: 300 });
  });

  it('low carb rounds grams from E%; NNR protein is 15–20 E% over 65', () => {
    expect(computeTargets({ profile, macroPreset: 'lowCarb' }).carbs).toEqual({ min: 50, max: 125 });
    expect(nnrMacroPct(66).protein).toEqual([15, 20]);
    expect(nnrMacroPct(65).protein).toEqual([10, 20]);
  });

  it('rejects huge or prototype-polluting override keys', () => {
    const raw = JSON.parse('{"__proto__": {"min": 1}, "iron": {"min": 1e300}, "zinc": {"max": 40}}');
    expect(normalizeOverrides(raw)).toEqual({ zinc: { max: 40 } });
    expect(Object.getPrototypeOf(normalizeOverrides(raw))).toBe(Object.prototype);
  });

  it('validates custom macro ranges', () => {
    expect(normalizeMacroPct({ protein: [10, 20], carbs: [45, 60], fat: [25, 40] })).not.toBeNull();
    expect(normalizeMacroPct({ protein: [30, 20], carbs: [45, 60], fat: [25, 40] })).toBeNull();
    expect(normalizeMacroPct({ protein: [10, 120], carbs: [45, 60], fat: [25, 40] })).toBeNull();
  });
});

describe('NNR 2023 targets for the M16 nutrients', () => {
  it('vitamin K, pantothenic acid, biotin, copper and manganese by sex, age and status', () => {
    const w = nnrTargets({ sex: 'female', kcal: 2000, age: 30 });
    expect([w.vitK.min, w.pantothenic.min, w.biotin.min, w.copper.min, w.manganese.min]).toEqual([65, 5, 40, 0.9, 3]);
    expect(nnrTargets({ sex: 'male', kcal: 2500, age: 30 }).vitK.min).toBe(75);
    expect(nnrTargets({ sex: 'male', kcal: 2500, age: 60 }).vitK.min).toBe(70);
    expect(nnrTargets({ sex: 'female', kcal: 2000, age: 75 }).vitK.min).toBe(60);
    const p3 = nnrTargets({ sex: 'female', kcal: 2000, age: 30, status: 'pregnant3' });
    expect([p3.vitK.min, p3.copper.min]).toEqual([75, 1.0]);
    const l = nnrTargets({ sex: 'female', kcal: 2000, age: 30, status: 'lactating' });
    expect([l.pantothenic.min, l.biotin.min, l.copper.min]).toEqual([7, 45, 1.3]);
  });
});
