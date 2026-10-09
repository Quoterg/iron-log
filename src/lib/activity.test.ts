import { describe, expect, it } from 'vitest';
import { burnedKcal } from './activity';
import { ACTIVITIES } from './activity-types';

describe('activity', () => {
  it('burned energy excludes resting energy: (MET − 1) × kg × h', () => {
    expect(burnedKcal(9.8, 70, 30)).toBe(308); // 10 km/h run: 8.8 × 70 × 0.5
    expect(burnedKcal(3.5, 80, 60)).toBe(200); // strength: 2.5 × 80
    expect(burnedKcal(1, 80, 60)).toBe(0);
  });

  it('has unique ids and plausible MET values', () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
    expect(ACTIVITIES.every((a) => a.met >= 2 && a.met <= 12)).toBe(true);
  });
});
