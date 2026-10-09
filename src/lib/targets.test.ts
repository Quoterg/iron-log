import { describe, expect, it } from 'vitest';
import {
  ageBand,
  computeTargets,
  energyNeed,
  nnrTargets,
  normalizeMacroPct,
  normalizeOverrides,
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
  it('Mifflin–St Jeor × PAL, plus pregnancy/lactation energy', () => {
    // Woman 30 y, 60 kg, 165 cm: BMR 1320 kcal × 1.6 = 2112 → 2110.
    expect(energyNeed(woman({ age: 30, weightKg: 60, heightCm: 165 }))).toBe(2110);
    expect(energyNeed(woman({ age: 30, weightKg: 60, heightCm: 165, pal: 1.4 }))).toBe(1850);
    // + 2.3 MJ ≈ 550 kcal in trimester 3.
    expect(energyNeed(woman({ age: 30, weightKg: 60, heightCm: 165, status: 'pregnant3' }))).toBe(2660);
    // Man 40 y, 80 kg, 180 cm: BMR 1730 × 1.8 = 3114 → 3110.
    expect(energyNeed(man({ age: 40, weightKg: 80, heightCm: 180, pal: 1.8 }))).toBe(3110);
    expect(energyNeed(man({ age: 40 }))).toBeNull();
  });

  it('applies to kcal only when automatic, and turns automatic off when data is missing', () => {
    const p = woman({ age: 30, weightKg: 60, heightCm: 165 });
    expect(withEnergy(p).kcal).toBe(2000);
    expect(withEnergy({ ...p, kcalAuto: true }).kcal).toBe(2110);
    const missing = withEnergy({ ...p, kcalAuto: true, weightKg: undefined, kcal: 2110 });
    expect(missing).toMatchObject({ kcalAuto: false, kcal: 2110 });
  });

  it('snaps activity levels to the ones the UI offers', () => {
    expect([1.2, 1.5, 1.51, 1.75, 2.5].map(snapPal)).toEqual([1.4, 1.6, 1.6, 1.8, 2.0]);
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

  it('validates custom macro ranges', () => {
    expect(normalizeMacroPct({ protein: [10, 20], carbs: [45, 60], fat: [25, 40] })).not.toBeNull();
    expect(normalizeMacroPct({ protein: [30, 20], carbs: [45, 60], fat: [25, 40] })).toBeNull();
    expect(normalizeMacroPct({ protein: [10, 120], carbs: [45, 60], fat: [25, 40] })).toBeNull();
  });
});
