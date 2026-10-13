import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RELEASES, releasesSince } from '../changelog';
import { LANGS } from './i18n';
import { APP_VERSION, BASELINE, compareVersions, whatsNewSince } from './version';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  });
});
const yes = async () => true;
const no = async () => false;

describe('compareVersions', () => {
  it('compares numerically, part by part', () => {
    expect(compareVersions('1.10.0', '1.9.2')).toBe(1);
    expect(compareVersions('1.2.0', '1.2')).toBe(0);
    expect(compareVersions('1.2.0', '1.3.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1);
  });
});

describe('whatsNewSince', () => {
  it('shows nothing on a fresh install, and nothing again', async () => {
    expect(await whatsNewSince(no, '1.3.0')).toBeNull();
    expect(await whatsNewSince(yes, '1.3.0')).toBeNull();
  });

  it('existing users from before the changelog see everything since the first APK release', async () => {
    expect(await whatsNewSince(yes, '1.3.0')).toBe(BASELINE);
    expect(await whatsNewSince(yes, '1.3.0')).toBeNull(); // once
  });

  it('after an update: news since the version last seen; never for the same or an older one', async () => {
    store.set('iron-log-seen-version', '1.2.0');
    expect(await whatsNewSince(no, '1.3.0')).toBe('1.2.0');
    expect(await whatsNewSince(no, '1.3.0')).toBeNull();
    store.set('iron-log-seen-version', '1.4.0'); // e.g. back on an older cached build
    expect(await whatsNewSince(yes, '1.3.0')).toBeNull();
  });

  it('only asks whether there is data when no version was seen yet', async () => {
    store.set('iron-log-seen-version', '1.3.0');
    const hasData = vi.fn(yes);
    await whatsNewSince(hasData, '1.3.0');
    expect(hasData).not.toHaveBeenCalled();
  });

  it('never nags when storage is blocked', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(await whatsNewSince(yes, '1.3.0')).toBeNull();
  });
});

describe('changelog', () => {
  it('has notes for the current version (bump package.json = add a changelog entry)', () => {
    expect(RELEASES[0].version).toBe(APP_VERSION);
  });

  it('is newest first, with dates, and every note in every language', () => {
    for (let i = 1; i < RELEASES.length; i++) expect(compareVersions(RELEASES[i - 1].version, RELEASES[i].version)).toBe(1);
    for (const r of RELEASES) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const n = r.notes.sv.length;
      expect(n).toBeGreaterThan(0);
      for (const { code } of LANGS) {
        expect(r.notes[code], `${r.version} ${code}`).toHaveLength(n);
        for (const note of r.notes[code]) expect(note.trim()).not.toBe('');
      }
    }
  });

  it('picks the releases since a version (none since the newest), else the latest', () => {
    expect(releasesSince('1.1.0').map((r) => r.version)).toEqual(['1.3.0', '1.2.0']);
    expect(releasesSince('1.2.0').map((r) => r.version)).toEqual(['1.3.0']);
    expect(releasesSince('1.3.0')).toEqual([]);
    expect(releasesSince(null)[0].version).toBe('1.3.0');
  });
});
