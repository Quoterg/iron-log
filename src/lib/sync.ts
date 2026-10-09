// Device-to-device sync engine. Transport-agnostic: the pairing screen (M17b) moves these messages
// over a direct, encrypted WebRTC connection; tests move them in memory. Loaded only when syncing.
//
// Protocol (both sides do the same, so it doesn't matter who started):
//   1. send `await summarize()`                       — every record's key and last-change time
//   2. on their summary: send `await changesFor(it)`   — what they lack or have older (incl. deletions)
//   3. on their changes: `await applyChanges(them)`    — newest change wins; ties keep the local copy
// After one round both devices hold the same data. Deletions travel as tombstones, so a deleted
// entry doesn't come back from the other device. Clocks only need to be roughly right: a change
// made within seconds of a conflicting one on the other device may lose, as in any last-write-wins.
import { SYNC_VALIDATORS } from './backup';
import { metaKey, openDb, SYNC_STORES, type Meta, type SyncStore } from './db';

/** metaKey → last change (ms). Records from before change tracking count as 0. */
export type Summary = Record<string, number>;

/** One record to bring over: its new value, or a deletion. */
export interface Change {
  k: string;
  mt: number;
  del?: true;
  v?: unknown;
}

/** The key each store's records are stored under (kv holds only 'settings'). */
const KEY_OF: Record<SyncStore, (v: Record<string, unknown>) => unknown> = {
  entries: (v) => v.id,
  customFoods: (v) => v.ref,
  usage: (v) => v.foodRef,
  servings: (v) => v.foodRef,
  offFoods: (v) => v.ref,
  recipes: (v) => v.ref,
  body: (v) => v.date,
  activities: (v) => v.id,
  water: (v) => v.date,
  kv: () => 'settings',
};

export class SyncError extends Error {}

function split(k: string): [SyncStore, string] {
  const i = k.indexOf(':');
  const store = k.slice(0, i) as SyncStore;
  if (i < 1 || !SYNC_STORES.includes(store)) throw new SyncError(`unknown store in ${k.slice(0, 40)}`);
  return [store, k.slice(i + 1)];
}

/** Every synced record (and tombstone) on this device with its last-change time. */
export async function summarize(): Promise<Summary> {
  const d = await openDb();
  const tx = d.transaction([...SYNC_STORES, 'meta']);
  const out: Summary = {};
  for (const store of SYNC_STORES) {
    const keys = store === 'kv' ? (await tx.objectStore('kv').get('settings')) !== undefined ? ['settings'] : [] : await tx.objectStore(store).getAllKeys();
    for (const key of keys) out[metaKey(store, String(key))] = 0;
  }
  let cur = await tx.objectStore('meta').openCursor();
  while (cur) {
    out[cur.key] = cur.value.mt;
    cur = await cur.continue();
  }
  await tx.done;
  return out;
}

/** What the other device lacks or has an older version of. */
export async function changesFor(theirs: Summary): Promise<Change[]> {
  const mine = await summarize();
  const wanted = Object.entries(mine).filter(([k, mt]) => mt > (theirs[k] ?? -1));
  if (!wanted.length) return [];
  const d = await openDb();
  const tx = d.transaction([...SYNC_STORES, 'meta']);
  const out: Change[] = [];
  for (const [k, mt] of wanted) {
    const meta = (await tx.objectStore('meta').get(k)) as Meta | undefined;
    if (meta?.del) {
      out.push({ k, mt, del: true });
      continue;
    }
    const [store, key] = split(k);
    const v = await tx.objectStore(store).get(key);
    if (v !== undefined) out.push({ k, mt, v });
  }
  await tx.done;
  return out;
}

/**
 * Apply the other device's changes where they are newer. Every record is validated with the same
 * rules as a backup import and must be stored under its own key; anything invalid aborts the whole
 * sync before writing (nothing half-applied). Returns how many records changed.
 */
export async function applyChanges(changes: Change[]): Promise<number> {
  // Validate everything first: a bad record must not leave a half-synced database.
  const checked = changes.map((c) => {
    if (typeof c.k !== 'string' || typeof c.mt !== 'number' || !Number.isFinite(c.mt) || c.mt < 0) throw new SyncError('bad change');
    const [store, key] = split(c.k);
    if (c.del) return { ...c, store, key, v: undefined };
    let v: unknown;
    try {
      v = SYNC_VALIDATORS[store](c.v);
    } catch {
      throw new SyncError(`invalid ${store} record`);
    }
    if (String(KEY_OF[store](v as Record<string, unknown>)) !== key) throw new SyncError(`key mismatch in ${store}`);
    return { ...c, store, key, v };
  });

  const d = await openDb();
  const tx = d.transaction([...SYNC_STORES, 'meta'], 'readwrite');
  let applied = 0;
  for (const c of checked) {
    const meta = (await tx.objectStore('meta').get(c.k)) as Meta | undefined;
    const exists = meta ? true : (await tx.objectStore(c.store).getKey(c.key)) !== undefined;
    const local = meta?.mt ?? (exists ? 0 : -1);
    if (c.mt <= local) continue;
    const os = tx.objectStore(c.store) as unknown as { put(v: unknown, k?: string): Promise<unknown>; delete(k: string): Promise<void> };
    if (c.del) await os.delete(c.key);
    else await os.put(c.v, c.store === 'kv' ? c.key : undefined);
    await tx.objectStore('meta').put(c.del ? { mt: c.mt, del: true } : { mt: c.mt }, c.k);
    applied++;
  }
  await tx.done;
  return applied;
}
