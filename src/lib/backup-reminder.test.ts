import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { BACKUP_DAYS, backupDue, countFrom } from './backup-reminder';

describe('quiet backup reminder (M69)', () => {
  it('counts from the later of the last backup and the last "Inte nu"', () => {
    expect(countFrom({})).toBeUndefined();
    expect(countFrom({ backupAt: '2026-10-01' })).toBe('2026-10-01');
    expect(countFrom({ backupAt: '2026-10-01', backupNudgeAt: '2026-11-01' })).toBe('2026-11-01');
    expect(countFrom({ backupAt: '2026-11-02', backupNudgeAt: '2026-11-01' })).toBe('2026-11-02');
  });

  it('shows after about a month of logged days, not before, and never when switched off', () => {
    expect(backupDue({}, BACKUP_DAYS - 1)).toBe(false);
    expect(backupDue({}, BACKUP_DAYS)).toBe(true);
    expect(backupDue({ backupReminderOff: true }, 400)).toBe(false);
  });

  it('counts logged days (not entries) after a date, and stops counting at the cap', async () => {
    const db = await import('./db');
    const day = (i: number) => db.addDays('2026-09-01', i);
    const entries = Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, date: day(i), meal: 'lunch' as const, foodRef: 'slv:1', grams: 1, createdAt: i }));
    // Two entries on one day count once.
    await db.putEntries([...entries, { ...entries[0], id: 'twin' }]);
    expect(await db.loggedDaysAfter(undefined, 100)).toBe(40);
    expect(await db.loggedDaysAfter(day(9), 100)).toBe(30); // days after the 10th
    expect(await db.loggedDaysAfter(undefined, BACKUP_DAYS)).toBe(BACKUP_DAYS);
  });
});
