// Device-to-device sync engine. Transport-agnostic: the pairing screen (M17b) moves these messages
// over a direct, encrypted WebRTC connection (in parts — see pair.ts); tests move them in memory.
// Loaded only when syncing.
//
// Protocol (both sides do the same, so it doesn't matter who started):
//   1. send `mine = await summarize()`                    — every record's key and last-change time
//   2. on their summary: send `await changesFor(it, mine)` — what they lack or have older (incl. deletions)
//   3. on their changes: `await applyChanges(them)`         — the newest change wins
// Ties (same change time) keep the local copy — whether that copy is a record or a deletion.
// Deletions travel as tombstones, kept for 90 days: a device that hasn't synced for longer may bring
// back records deleted elsewhere. Clocks only need to be roughly right; change times from the other
// device are capped at a few minutes ahead of ours, so a wrong clock can't make a record unbeatable.
import { SYNC_VALIDATORS } from './backup';
import { KEY_PATH, openDb, SYNC_STORES, type Meta, type Settings, type SyncStore, type Usage } from './db';

/** metaKey → last change (ms). */
export type Summary = Record<string, number>;

/** One record to bring over: its new value, or a deletion. */
export interface Change {
  k: string;
  mt: number;
  del?: true;
  v?: unknown;
}

export interface Applied {
  /** Records changed on this device. */
  count: number;
  /** Which stores changed (the app reloads what's affected). */
  stores: SyncStore[];
}

export const TOMBSTONE_DAYS = 90;
const MAX_CLOCK_AHEAD = 5 * 60_000;
/** Kept per device, never taken from the other device's settings. */
const DEVICE_LOCAL_SETTINGS = ['lang', 'sources', 'energyNotice'] as const;

/** A sync failure. Its message may contain text from the other device: show it as plain text only. */
export class SyncError extends Error {}

function split(k: string): [SyncStore, string] {
  const i = k.indexOf(':');
  const store = k.slice(0, i) as SyncStore;
  if (i < 1 || !SYNC_STORES.includes(store)) throw new SyncError(`unknown store in ${k.slice(0, 40)}`);
  return [store, k.slice(i + 1)];
}

const keyOf = (store: SyncStore, v: unknown): string =>
  store === 'kv' ? 'settings' : String((v as Record<string, unknown>)[KEY_PATH[store]]);

/**
 * Every synced record (and tombstone) on this device with its last-change time — read from the
 * change log only (every record has an entry since the v9 upgrade). Prunes old tombstones first.
 */
export async function summarize(now = Date.now()): Promise<Summary> {
  const tx = (await openDb()).transaction('meta', 'readwrite');
  const out: Summary = {};
  const cutoff = now - TOMBSTONE_DAYS * 864e5;
  let cur = await tx.store.openCursor();
  while (cur) {
    if (cur.value.del && cur.value.mt < cutoff) await cur.delete();
    else out[cur.key] = cur.value.mt;
    cur = await cur.continue();
  }
  await tx.done;
  return out;
}

/** What the other device lacks or has an older version of. Pass `mine` if already summarized. */
export async function changesFor(theirs: Summary, mine?: Summary): Promise<Change[]> {
  mine ??= await summarize();
  const wanted = Object.entries(mine).filter(([k, mt]) => mt > (theirs[k] ?? -1));
  if (!wanted.length) return [];
  const tx = (await openDb()).transaction([...SYNC_STORES, 'meta']);
  // One read per store (not per record): a first sync can be thousands of records on a slow phone.
  const metas = new Map<string, Meta>();
  let cur = await tx.objectStore('meta').openCursor();
  while (cur) {
    metas.set(cur.key, cur.value);
    cur = await cur.continue();
  }
  const byStore = new Map<SyncStore, Map<string, unknown>>();
  const records = async (store: SyncStore) => {
    let m = byStore.get(store);
    if (!m) {
      const all = store === 'kv' ? [await tx.objectStore('kv').get('settings')].filter((x) => x !== undefined) : await tx.objectStore(store).getAll();
      m = new Map(all.map((v) => [keyOf(store, v), v]));
      byStore.set(store, m);
    }
    return m;
  };
  const out: Change[] = [];
  for (const [k, mt] of wanted) {
    if (metas.get(k)?.del) {
      out.push({ k, mt, del: true });
      continue;
    }
    const [store, key] = split(k);
    const v = (await records(store)).get(key);
    if (v !== undefined) out.push({ k, mt, v });
  }
  await tx.done;
  return out;
}

/**
 * Apply the other device's changes where they are newer. Every record is validated with the same
 * rules as a backup import and must be stored under its own key; anything invalid aborts the whole
 * sync before writing (nothing half-applied).
 */
export async function applyChanges(changes: Change[], now = Date.now()): Promise<Applied> {
  // Validate everything first: a bad record must not leave a half-synced database.
  const checked = changes.map((c) => {
    if (typeof c.k !== 'string' || typeof c.mt !== 'number' || !Number.isFinite(c.mt) || c.mt < 0) throw new SyncError('bad change');
    const [store, key] = split(c.k);
    const mt = Math.min(c.mt, now + MAX_CLOCK_AHEAD);
    if (c.del) return { k: c.k, mt, del: true as const, store, key, v: undefined };
    let v: unknown;
    try {
      v = SYNC_VALIDATORS[store](c.v);
    } catch {
      throw new SyncError(`invalid ${store} record`);
    }
    if (keyOf(store, v) !== key) throw new SyncError(`key mismatch in ${store}`);
    return { k: c.k, mt, del: undefined, store, key, v };
  });

  const tx = (await openDb()).transaction([...SYNC_STORES, 'meta'], 'readwrite');
  const stores = new Set<SyncStore>();
  let count = 0;
  for (const c of checked) {
    const local = ((await tx.objectStore('meta').get(c.k)) as Meta | undefined)?.mt ?? -1;
    if (c.mt <= local) continue;
    const os = tx.objectStore(c.store) as unknown as { get(k: string): Promise<unknown>; put(v: unknown, k?: string): Promise<unknown>; delete(k: string): Promise<void> };
    if (c.del) {
      await os.delete(c.key);
    } else {
      let v = c.v;
      const cur = await os.get(c.key);
      if (c.store === 'usage' && cur) {
        // Usage counts add up on both devices: keep the larger count with the newer details.
        v = { ...(v as Usage), count: Math.max((v as Usage).count, (cur as Usage).count) };
      }
      if (c.store === 'kv' && cur) {
        // Language and food-database choice belong to each device.
        const keep = Object.fromEntries(DEVICE_LOCAL_SETTINGS.filter((k) => (cur as Settings)[k] !== undefined).map((k) => [k, (cur as Settings)[k]]));
        const merged: Record<string, unknown> = { ...(v as Settings) };
        for (const k of DEVICE_LOCAL_SETTINGS) delete merged[k];
        v = { ...merged, ...keep };
      }
      await os.put(v, c.store === 'kv' ? c.key : undefined);
    }
    await tx.objectStore('meta').put(c.del ? { mt: c.mt, del: true } : { mt: c.mt }, c.k);
    stores.add(c.store);
    count++;
  }
  await tx.done;
  return { count, stores: [...stores] };
}
