import { describe, expect, it } from 'vitest';
import { FIELDS, parseIronNotes, pickMetric, type Metric } from './ironnotes';

const [WEIGHT, FAT, WAIST] = FIELDS;
const m = (id: string, name: string, kind: string): Metric => ({ id, name, kind });

describe('which Iron Notes measure is read (review #95)', () => {
  it('a "Target weight" listed first is never taken for body weight', () => {
    const list = [m('t', 'Target weight', 'weight'), m('w', 'Body weight', 'weight')];
    expect(pickMetric(list, WEIGHT)?.id).toBe('w');
    const backup = {
      app: 'iron-notes',
      version: 1,
      metrics: list,
      body: [
        { metricId: 't', date: '2026-11-01', value: 70, at: 1 },
        { metricId: 'w', date: '2026-11-01', value: 82, at: 1 },
      ],
    };
    expect(parseIronNotes(backup, '2026-11-15').days.get('2026-11-01')).toEqual({ weightKg: 82 });
  });

  it('goal, lean, fat-free and muscle measures are left out; exact default names win', () => {
    expect(pickMetric([m('l', 'Lean body weight', 'weight'), m('g', 'Goal weight', 'weight')], WEIGHT)).toBeUndefined();
    expect(pickMetric([m('a', 'Fat-free %', 'percent'), m('b', 'Muscle fat %', 'percent'), m('f', 'Body fat', 'percent')], FAT)?.id).toBe('f');
    expect(pickMetric([m('x', 'Fettprocent', 'percent')], FAT)?.id).toBe('x');
    expect(pickMetric([m('v', 'Vikt', 'weight'), m('o', 'Morgonvikt', 'weight')], WEIGHT)?.id).toBe('v');
    expect(pickMetric([m('w', 'Midja', 'length'), m('c', 'Chest', 'length')], WAIST)?.id).toBe('w');
  });

  it('two candidates without an exact name: none rather than a guess', () => {
    expect(pickMetric([m('a', 'Morning weight', 'weight'), m('b', 'Evening weight', 'weight')], WEIGHT)).toBeUndefined();
    expect(pickMetric([m('a', 'Waist (navel)', 'length'), m('b', 'Waist (narrowest)', 'length')], WAIST)).toBeUndefined();
  });

  it('a lone weight measure is still the body weight, whatever its name — unless it is a goal', () => {
    expect(pickMetric([m('w', 'Me', 'weight')], WEIGHT)?.id).toBe('w');
    expect(pickMetric([m('w', 'Mål', 'weight')], WEIGHT)).toBeUndefined();
  });
});
