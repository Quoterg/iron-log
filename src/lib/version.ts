// The app's version and "what's new" (M32): after a release (a version bump in package.json), the
// first start shows the changelog once; a fresh install and ordinary deploys show nothing.
import { version } from '../../package.json';

export const APP_VERSION: string = version;

const KEY = 'iron-log-seen-version';
/** What users from before the changelog existed have certainly seen (the first APK releases). */
export const BASELINE = '1.1.0';

/** -1, 0 or 1, comparing dotted versions numerically ("1.10.0" > "1.9.2"; "1.3.0-beta" counts as 1.3.0). */
export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map((p) => parseInt(p, 10) || 0);
  const y = b.split('.').map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

function read(): string | null | undefined {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return undefined; // storage blocked
  }
}

/** Records `current` as seen: call once the news is on screen (or there is none to show). */
export function markSeen(current = APP_VERSION): void {
  try {
    localStorage.setItem(KEY, current);
  } catch {
    /* blocked: whatsNewSince() then never shows anything */
  }
}

/**
 * The version to show news since, or null: nothing when this version was seen already, on a fresh
 * install (no data yet: it's all new anyway; recorded as seen right away) or when storage is
 * blocked (never nag on every start). When it returns a version, the caller records it with
 * markSeen() once the news is actually shown, so news that couldn't be shown comes next start.
 * `hasData` is only asked when no version was seen yet (from before M32, or a new install).
 */
export async function whatsNewSince(hasData: () => Promise<boolean>, current = APP_VERSION): Promise<string | null> {
  const seen = read();
  if (seen === undefined) return null;
  if (seen) return compareVersions(current, seen) > 0 ? seen : null;
  if (await hasData()) return BASELINE;
  markSeen(current);
  return null;
}
