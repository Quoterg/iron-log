import { describe, expect, it } from 'vitest';
import { lastDays, movingAverage, niceScale, series, type BodyEntry } from './body';

const e = (date: string, weightKg?: number, waistCm?: number): BodyEntry => ({ date, weightKg, waistCm, updatedAt: 1 });

describe('body log', () => {
  it('extracts one metric, sorted, skipping days without it', () => {
    const s = series([e('2026-10-03', 80), e('2026-10-01', 81, 90), e('2026-10-02', undefined, 89)], 'weightKg');
    expect(s).toEqual([{ date: '2026-10-01', value: 81 }, { date: '2026-10-03', value: 80 }]);
  });

  it('7-day moving average uses a time window (irregular weigh-ins)', () => {
    const pts = [
      { date: '2026-10-01', value: 80 },
      { date: '2026-10-02', value: 82 },
      { date: '2026-10-07', value: 78 }, // window 10-01..10-07 → (80 + 82 + 78) / 3
      { date: '2026-10-08', value: 79 }, // window 10-02..10-08 → (82 + 78 + 79) / 3
      { date: '2026-10-20', value: 76 }, // alone in its window
    ];
    expect(movingAverage(pts).map((p) => p.value)).toEqual([80, 81, 80, 79.67, 76]);
  });

  it('filters to the last N days', () => {
    const pts = [{ date: '2026-09-01', value: 1 }, { date: '2026-10-01', value: 2 }, { date: '2026-10-09', value: 3 }];
    expect(lastDays(pts, '2026-10-09', 30).map((p) => p.value)).toEqual([2, 3]);
    expect(lastDays(pts, '2026-10-09', null)).toHaveLength(3);
  });

  it('picks clean axis bounds and ticks', () => {
    expect(niceScale(78.3, 82.1)).toEqual({ lo: 78, hi: 84, ticks: [78, 80, 82, 84] });
    expect(niceScale(80, 80).lo).toBeLessThan(80);
  });
});
