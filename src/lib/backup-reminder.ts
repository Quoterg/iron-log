// A quiet backup reminder (M69): data lives on this device only, so once in a while — after about a
// month of new logging — the diary offers one tap to save a backup. Never a streak, never repeated:
// saving or "Inte nu" starts the count again, and it can be switched off. Pure: tested in Node.

/** Logged days after the last backup (or "Inte nu") before the reminder shows. */
export const BACKUP_DAYS = 28;

export interface BackupState {
  /** Date (YYYY-MM-DD) of the last backup saved on this device. */
  backupAt?: string;
  /** Date the reminder was last put away with "Inte nu". */
  backupNudgeAt?: string;
  /** The reminder is switched off. */
  backupReminderOff?: boolean;
}

/** The date logged days are counted after: the later of the last backup and the last "Inte nu". */
export function countFrom(s: BackupState): string | undefined {
  const a = s.backupAt;
  const b = s.backupNudgeAt;
  return a && b ? (a > b ? a : b) : a ?? b;
}

/** Whether to show the reminder, given how many days have been logged since `countFrom`. */
export function backupDue(s: BackupState, loggedDays: number): boolean {
  return !s.backupReminderOff && loggedDays >= BACKUP_DAYS;
}
