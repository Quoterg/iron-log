import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { entriesBetween, putEntries, recentLoggedDates } from './db';

const e = (id: string, date: string) => ({ id, date, meal: 'lunch' as const, foodRef: 'slv:1', grams: 100, createdAt: 1 });

describe('report queries', () => {
  it('reads a date range via the index and walks logged dates back to the first gap', async () => {
    await putEntries([e('a', '2026-10-01'), e('b', '2026-10-06'), e('c', '2026-10-07'), e('d', '2026-10-07'), e('f', '2026-10-08')]);
    expect((await entriesBetween('2026-10-06', '2026-10-08')).map((x) => x.id).sort()).toEqual(['b', 'c', 'd', 'f']);
    // Today (10-09) not logged yet: starts from yesterday, stops at the gap before 10-06.
    expect([...(await recentLoggedDates('2026-10-09'))]).toEqual(['2026-10-08', '2026-10-07', '2026-10-06']);
    expect([...(await recentLoggedDates('2026-10-12'))]).toEqual([]);
  });
});
