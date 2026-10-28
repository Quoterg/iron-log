import { describe, expect, it } from 'vitest';
import { addDays } from './db';
import { allowedPaces, countedDays, estimate, followDue, followStep, goalDelta, goalShift, goalTarget, minIntake, type DayIntake, type WeighIn } from './adaptive';
import { SV_ENERGY } from './strings-energy';

const START = '2026-09-01';
/** 28 days of intake: `kcal(i)` on day i. */
const days = (kcal: (i: number) => number, complete = false): DayIntake[] =>
  Array.from({ length: 28 }, (_, i) => ({ date: addDays(START, i), kcal: kcal(i), complete }));
/** Weekly weigh-ins on a straight line: `start` kg, changing `perWeek` kg a week. */
const weights = (start: number, perWeek: number, every = 7): WeighIn[] =>
  Array.from({ length: Math.floor(27 / every) + 1 }, (_, k) => ({ date: addDays(START, k * every), kg: start + (perWeek * k * every) / 7 }));

describe('adaptive energy expenditure', () => {
  it('stable weight: expenditure = average intake', () => {
    const e = estimate(days(() => 2400), weights(80, 0));
    expect(e).toMatchObject({ ok: true, kcal: 2400, days: 28, weighIns: 4, kgPerWeek: 0, weightKg: 80 });
  });

  it('losing 0.5 kg a week on 2000 kcal: expenditure ≈ 2000 + 0.5 × 7700 / 7 = 2550', () => {
    const e = estimate(days(() => 2000), weights(80, -0.5));
    expect(e.ok && e.kcal).toBe(2550);
    expect(e.ok && e.kgPerWeek).toBe(-0.5);
  });

  it('shows its arithmetic (M41b): the intake of the days that count + the weight trend = expenditure', () => {
    // 2000 kcal most days, three logged days far below that (not marked complete): those are left out.
    const e = estimate(days((i) => (i < 3 ? 600 : 2000)), weights(80, -0.5));
    expect(e).toMatchObject({ ok: true, intake: 2000, skipped: 3, days: 25, kcal: 2550 });
    // The 30-day average a user sees elsewhere includes the low days — lower than the intake used here.
    expect(e.ok && e.kcal - e.intake).toBe(550);
  });

  it('reports its uncertainty: noisier intake and weight give a wider ±', () => {
    const calm = estimate(days(() => 2400), weights(80, 0, 3));
    const noisy = estimate(days((i) => (i % 2 ? 1700 : 3100)), weights(80, 0, 3).map((w, k) => ({ ...w, kg: w.kg + (k % 2 ? 0.8 : -0.8) })));
    expect(calm.ok && noisy.ok && noisy.plusMinus > calm.plusMinus).toBe(true);
  });

  it('few weigh-ins never look precise: 3 on a perfect line still carry scale noise', () => {
    const three: WeighIn[] = [0, 7, 14].map((i, k) => ({ date: addDays(START, i), kg: 80 - 0.25 * k }));
    const e = estimate(days(() => 2000), three);
    // At least 0.3 kg of scale noise over 14 days: 0.3 / 14 × 7700 ≈ 165 kcal/day.
    expect(e.ok && e.plusMinus).toBeGreaterThanOrEqual(160);
    // More weigh-ins over a longer span: tighter.
    const many = estimate(days(() => 2000), weights(80, -0.25, 2));
    expect(many.ok && e.ok && many.plusMinus < e.plusMinus).toBe(true);
  });

  it('days with foods of unknown energy never count (they would lower the estimate)', () => {
    const list = days(() => 2200).map((d, i) => (i < 3 ? { ...d, kcal: 1500, unknown: true, complete: true } : d));
    expect(countedDays(list)).toHaveLength(25);
    const e = estimate(list, weights(80, 0));
    expect(e.ok && e.kcal).toBe(2200);
  });

  it('days far below the usual intake count only when marked complete', () => {
    const list = days((i) => (i < 5 ? 600 : 2200));
    expect(countedDays(list)).toHaveLength(23);
    expect(countedDays(list.map((d, i) => (i === 0 ? { ...d, complete: true } : d)))).toHaveLength(24);
    expect(countedDays(days(() => 0))).toEqual([]); // nothing logged: nothing counts
  });

  it('needs ≥ 10 days, ≥ 3 weigh-ins and ≥ 2 weeks between them, and says what is missing', () => {
    const few = days((i) => (i < 9 ? 2000 : 0));
    expect(estimate(few, weights(80, 0))).toEqual({ ok: false, reason: 'data', days: 9, weighIns: 4 });
    expect(estimate(days(() => 2000), weights(80, 0).slice(0, 2))).toMatchObject({ ok: false, reason: 'data', weighIns: 2 });
    const short: WeighIn[] = [0, 4, 8].map((i) => ({ date: addDays(START, i), kg: 80 }));
    expect(estimate(days(() => 2000), short)).toMatchObject({ ok: false, reason: 'data' }); // only 8 days apart
  });

  it('refuses numbers no body produces (missing meals, or a wrong scale)', () => {
    // 900 kcal logged a day while gaining 1 kg a week.
    expect(estimate(days(() => 900), weights(80, 1))).toMatchObject({ ok: false, reason: 'implausible' });
  });

  it('suggests a target for a goal at a safe pace, never below a minimum intake', () => {
    expect(allowedPaces(80)).toEqual([0.25, 0.5]); // 0.75 % of 80 kg = 0.6 kg/week
    expect(allowedPaces(110)).toEqual([0.25, 0.5, 0.75]);
    expect(goalTarget(2500, 'maintain', 0.5, 1200)).toEqual({ kcal: 2500, floored: false });
    expect(goalTarget(2500, 'lose', 0.5, 1200)).toEqual({ kcal: 1950, floored: false });
    expect(goalTarget(2500, 'gain', 0.25, 1200)).toEqual({ kcal: 2780, floored: false });
    expect(goalTarget(1500, 'lose', 0.5, 1200)).toEqual({ kcal: 1200, floored: true });
    expect(minIntake({ sex: 'female', kcal: 2000 })).toBe(1200);
    expect(minIntake({ sex: 'male', kcal: 2500 })).toBe(1500);
    // Not below the basal rate either.
    expect(minIntake({ sex: 'male', kcal: 2500, age: 30, weightKg: 120, heightCm: 195 })).toBeGreaterThan(1500);
  });

  it('every language has every string of the card, with the same placeholders as Swedish', async () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const code of ['en', 'da', 'de', 'fi', 'so']) {
      const energy = (await import(`./lang/${code}.ts`)).default.energy as Record<string, string>;
      expect(Object.keys(energy).sort(), code).toEqual(Object.keys(SV_ENERGY).sort());
      for (const [k, v] of Object.entries(SV_ENERGY)) expect(ph(energy[k]), `${code}.${k}`).toEqual(ph(v));
    }
  });
});

describe('follow the estimate (M35)', () => {
  it('moves the target toward the suggestion, at most 150 kcal a week, never below the floor', () => {
    expect(followStep(3000, 2450, 1500)).toBe(2850); // weight up at 3000: −150 this week…
    expect(followStep(2850, 2450, 1500)).toBe(2700); // …and the next, until there
    expect(followStep(2500, 2450, 1500)).toBe(2450); // close: all the way
    expect(followStep(2000, 2400, 1500)).toBe(2150); // up as well
    expect(followStep(1600, 1300, 1500)).toBe(1500); // floor
    expect(followStep(2200, 2200, 1500)).toBe(2200);
  });

  it("steps once a week, also when an older device dropped followWeek (this week's note counts)", () => {
    expect(followDue({}, '2026-W43')).toBe(true);
    expect(followDue({ followWeek: '2026-W42' }, '2026-W43')).toBe(true);
    expect(followDue({ followWeek: '2026-W43' }, '2026-W43')).toBe(false);
    expect(followDue({ followNote: { week: '2026-W43' } }, '2026-W43')).toBe(false); // followWeek lost in sync
    expect(followDue({ followNote: { week: '2026-W42' } }, '2026-W43')).toBe(true);
  });
});

describe('a goal change while following (M41)', () => {
  it("a goal's energy: −/+ the pace × 7700 / 7 kcal a day, 0 to maintain", () => {
    expect(goalDelta('maintain', 0.5)).toBe(0);
    expect(goalDelta('lose', 0.5)).toBeCloseTo(-550);
    expect(goalDelta('gain', 0.25)).toBeCloseTo(275);
  });

  it('moves the target at once by the difference, not capped like a weekly step, never below the floor', () => {
    expect(goalShift(2430, { goal: 'gain', pace: 0.25 }, { goal: 'lose', pace: 0.25 }, 1500)).toBe(1880);
    expect(goalShift(2000, { goal: 'maintain', pace: 0.5 }, { goal: 'lose', pace: 0.5 }, 1500)).toBe(1500); // 1450 < floor
    expect(goalShift(2200, { goal: 'lose', pace: 0.5 }, { goal: 'lose', pace: 0.25 }, 1500)).toBe(2480); // slower pace: +275
    expect(goalShift(2200, { goal: 'lose', pace: 0.5 }, { goal: 'lose', pace: 0.5 }, 1500)).toBe(2200);
  });
});
