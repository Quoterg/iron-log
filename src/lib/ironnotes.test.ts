import { describe, expect, it } from 'vitest';
import { IronNotesError, isIronNotes, parseIronNotes, planBody } from './ironnotes';

// An Iron Notes backup as its app writes it (version 1): measures are named, typed metrics.
const backup = (extra: object = {}) => ({
  app: 'iron-notes',
  version: 1,
  metrics: [
    { id: 'w', name: 'Body weight', kind: 'weight', order: 0 },
    { id: 'f', name: 'Body fat', kind: 'percent', order: 1 },
    { id: 'm', name: 'Waist', kind: 'length', order: 2 },
    { id: 'c', name: 'Chest', kind: 'length', order: 3 },
  ],
  body: [
    { id: '1', metricId: 'w', date: '2026-11-01', value: 80.44, at: 1 },
    { id: '2', metricId: 'w', date: '2026-11-01', value: 80.1, at: 2 }, // later the same day: wins
    { id: '3', metricId: 'f', date: '2026-11-01', value: 18, at: 1 },
    { id: '4', metricId: 'm', date: '2026-11-02', value: 88, at: 1 },
    { id: '5', metricId: 'c', date: '2026-11-02', value: 104, at: 1 }, // chest: not a measure Iron Log has
    { id: '6', metricId: 'w', date: '2026-11-03', value: 900, at: 1 }, // out of range
    { id: '7', metricId: 'w', date: '2026-12-01', value: 79, at: 1 }, // in the future
  ],
  settings: { diet: 'cut' },
  ...extra,
});

describe('Iron Notes import (M53)', () => {
  it('reads weight, body fat and waist by date (the latest entry of a day), and the diet phase as a goal', () => {
    expect(isIronNotes(backup())).toBe(true);
    expect(isIronNotes({ format: 'iron-log-backup' })).toBe(false);
    const d = parseIronNotes(backup(), '2026-11-11');
    expect([...d.days]).toEqual([
      ['2026-11-01', { weightKg: 80.1, bodyFatPct: 18 }],
      ['2026-11-02', { waistCm: 88 }],
    ]);
    expect(d.goal).toBe('lose');
    expect(parseIronNotes(backup({ settings: { diet: 'build' } }), '2026-11-11').goal).toBe('gain');
    expect(parseIronNotes(backup({ settings: {} }), '2026-11-11').goal).toBeUndefined();
  });

  it('matches renamed measures by kind and name; a lone weight measure is the body weight', () => {
    const sv = backup({ metrics: [{ id: 'w', name: 'Vikt', kind: 'weight' }, { id: 'f', name: 'Fettprocent', kind: 'percent' }, { id: 'm', name: 'Midja', kind: 'length' }] });
    expect(parseIronNotes(sv, '2026-11-11').days.get('2026-11-01')).toEqual({ weightKg: 80.1, bodyFatPct: 18 });
    const odd = backup({ metrics: [{ id: 'w', name: 'Morgon', kind: 'weight' }] });
    expect(parseIronNotes(odd, '2026-11-11').days.get('2026-11-01')).toEqual({ weightKg: 80.1 });
  });

  it('refuses what is not an Iron Notes backup of a known version', () => {
    expect(() => parseIronNotes({ app: 'iron-notes', version: 2 }, '2026-11-11')).toThrow(IronNotesError);
    expect(() => parseIronNotes({ app: 'iron-notes', version: 1, body: 'x' }, '2026-11-11')).toThrow(IronNotesError);
  });

  it('adds only what Iron Log lacks: a new date, or a missing value on an existing one', () => {
    const d = parseIronNotes(backup(), '2026-11-11');
    const existing = [{ date: '2026-11-01', weightKg: 81, updatedAt: 1 }];
    const plan = planBody(d, existing, 99);
    expect(plan.write).toEqual([
      { date: '2026-11-01', weightKg: 81, bodyFatPct: 18, updatedAt: 99 }, // own weight kept
      { date: '2026-11-02', waistCm: 88, updatedAt: 99 },
    ]);
    expect(plan.counts).toEqual({ weightKg: 0, bodyFatPct: 1, waistCm: 1 });
    // Importing the same file again changes nothing.
    expect(planBody(d, plan.write, 100).write).toEqual([]);
  });
});
