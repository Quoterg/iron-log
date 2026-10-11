// Weekly check-in (M26, opt-in): which week to show. The diary needs only this; the report logic is
// in checkin-report.ts, loaded with the sheet.
import { addDays } from './db';

/** ISO week (Monday–Sunday) of a date: key like "2026-W41", first and last day. */
export function isoWeek(date: string): { key: string; start: string; end: string } {
  const [y, m, d] = date.split('-').map(Number);
  const day = (new Date(y, m - 1, d).getDay() + 6) % 7; // Monday = 0
  const start = addDays(date, -day);
  // The ISO year/week is that of the week's Thursday.
  const thu = addDays(start, 3);
  const [ty, tm, td] = thu.split('-').map(Number);
  // Whole days (round: a summer-time date is an hour short of a whole number of days from 1 Jan).
  const days = Math.round((new Date(ty, tm - 1, td).getTime() - new Date(ty, 0, 1).getTime()) / 864e5);
  return { key: `${ty}-W${String(Math.floor(days / 7) + 1).padStart(2, '0')}`, start, end: addDays(start, 6) };
}

/** The last complete week before `today`'s week. */
export const previousWeek = (today: string) => isoWeek(addDays(isoWeek(today).start, -1));
