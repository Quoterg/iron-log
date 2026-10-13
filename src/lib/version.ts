// The app's version and "what's new" (M32): after a release (a version bump in package.json), the
// first start shows the changelog once; a fresh install and ordinary deploys show nothing.
import { version } from '../../package.json';

export const APP_VERSION: string = version;

const KEY = 'iron-log-seen-version';
/** What users from before the changelog existed have certainly seen (the first APK releases). */
export const BASELINE = '1.1.0';

/** -1, 0 or 1, comparing dotted versions numerically ("1.10.0" > "1.9.2"). */
export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * The version to show news since, or null: nothing when this version was seen already or on a fresh
 * install (no data yet: it's all new anyway). Records this version as seen. `hasData` is only asked
 * the first time (no version seen yet: from before M32, or a new install).
 */
export async function whatsNewSince(hasData: () => Promise<boolean>, current = APP_VERSION): Promise<string | null> {
  let seen: string | null;
  try {
    seen = localStorage.getItem(KEY);
    localStorage.setItem(KEY, current);
  } catch {
    return null; // storage blocked: never nag on every start
  }
  if (seen) return compareVersions(current, seen) > 0 ? seen : null;
  return (await hasData()) ? BASELINE : null;
}
