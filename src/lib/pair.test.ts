import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import type { Entry } from './db';
import type { Channel, SyncMsg } from './pair';

const SDP = 'v=0\r\no=- 46117 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=extmap-allow-mixed\r\na=fingerprint:sha-256 AA:BB\r\n'.repeat(4);

async function device() {
  vi.resetModules();
  (globalThis as { indexedDB?: unknown }).indexedDB = new IDBFactory();
  const db = await import('./db');
  const pair = await import('./pair');
  await db.getSettings(); // open this device's database while its factory is the global one
  return { db, pair };
}
type Device = Awaited<ReturnType<typeof device>>;

const entry = (id: string): Entry => ({ id, date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams: 100, createdAt: 1 });

/** Two in-memory channels joined back to back, through the real framing. */
function linked(a: Device, b: Device, opts: { closeAfterDone?: boolean } = {}): [Channel, Channel] {
  const end = (pair: Device['pair']) => {
    const inbox: SyncMsg[] = [];
    const waiting: { ok: (m: SyncMsg) => void; no: (e: unknown) => void }[] = [];
    const asm = new pair.Reassembler();
    let closed = false;
    return {
      deliver(raw: string) {
        const m = asm.push(raw);
        if (!m) return;
        const w = waiting.shift();
        if (w) w.ok(m);
        else inbox.push(m);
      },
      close() {
        closed = true;
        for (const w of waiting.splice(0)) w.no(new pair.PairError('closed'));
      },
      next: () =>
        inbox.length
          ? Promise.resolve(inbox.shift()!)
          : closed
            ? Promise.reject(new pair.PairError('closed'))
            : new Promise<SyncMsg>((ok, no) => waiting.push({ ok, no })),
    };
  };
  const toA = end(a.pair);
  const toB = end(b.pair);
  const chA: Channel = {
    send: async (m) => {
      a.pair.frame(m).forEach((p) => toB.deliver(p));
      // Simulate A closing right after sending its 'done', before B has read anything else.
      if (opts.closeAfterDone && m.t === 'done') toB.close();
    },
    next: toA.next,
    flush: async () => {},
  };
  const chB: Channel = { send: async (m) => b.pair.frame(m).forEach((p) => toA.deliver(p)), next: toB.next, flush: async () => {} };
  return [chA, chB];
}

describe('pairing codes', () => {
  it('round-trip a description (minus droppable lines), compressed, and reject anything else', async () => {
    const { encodeSignal, decodeSignal, PairError } = await import('./pair');
    const code = await encodeSignal({ type: 'offer', sdp: SDP });
    expect(code.startsWith('IL1.')).toBe(true);
    expect(code.length).toBeLessThan(SDP.length); // compressed: easier QR
    expect(await decodeSignal(code, 'offer')).toEqual({ type: 'offer', sdp: SDP.replace(/a=extmap-allow-mixed\r\n/g, '') });
    await expect(decodeSignal(code, 'answer')).rejects.toThrow(PairError); // offer pasted where an answer belongs
    await expect(decodeSignal('hello', 'offer')).rejects.toThrow(PairError);
    await expect(decodeSignal('IL1.!!!not-base64', 'offer')).rejects.toThrow(PairError);
  });
});

describe('message framing', () => {
  it('splits long messages into parts and reassembles them in order', async () => {
    const { frame, Reassembler, PART } = await import('./pair');
    const big: SyncMsg = {
      t: 'changes',
      c: Array.from({ length: 2000 }, (_, i) => ({ k: `entries:${i}`, mt: i, v: { x: '"quoted"'.repeat(5) } })),
      total: 2000,
      last: true,
    };
    const parts = frame(big);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= PART + 12)).toBe(true); // no re-escaping
    const asm = new Reassembler();
    const got = parts.map((p) => asm.push(p));
    expect(got.slice(0, -1).every((m) => m === undefined)).toBe(true);
    expect(got.at(-1)).toEqual(big);
  });

  it('rejects malformed, out-of-order, oversized or inconsistent parts', async () => {
    const { frame, Reassembler, PairError } = await import('./pair');
    const parts = frame({ t: 'changes', c: Array.from({ length: 900 }, (_, i) => ({ k: `entries:${i}`, mt: i, del: true as const })), total: 900, last: true });
    expect(() => new Reassembler().push(parts[1])).toThrow(PairError); // out of order
    expect(() => new Reassembler().push('garbage')).toThrow(PairError);
    expect(() => new Reassembler().push('0/99999|{}')).toThrow(PairError); // too many parts
    expect(() => new Reassembler().push(`0/1|${'x'.repeat(20_000)}`)).toThrow(PairError); // part too big
    const asm = new Reassembler();
    asm.push(parts[0]);
    expect(() => asm.push(parts[1].replace(/^1\/\d+/, `1/${parts.length + 1}`))).toThrow(PairError); // n changed
    expect(() => new Reassembler().push('0/1|{not json')).toThrow(PairError);
  });
});

describe('sync protocol over a channel', () => {
  it('two devices end up with the same data; big histories go in batches', async () => {
    const a = await device();
    const b = await device();
    await a.db.putEntry(entry('a1'));
    await b.db.putEntries(Array.from({ length: 1200 }, (_, i) => entry(`bulk${i}`))); // 3 batches
    const [chA, chB] = linked(a, b);
    const steps: string[] = [];
    const [ra, rb] = await Promise.all([
      a.pair.runSync(chA, 'first', (p) => p.step === 'applying' && steps.push(`${p.done}/${p.total}`)),
      b.pair.runSync(chB, 'second'),
    ]);
    expect(ra).toEqual({ received: 1200, sent: 1, stores: ['entries'] });
    expect(rb).toEqual({ received: 1, sent: 1200, stores: ['entries'] });
    expect(steps).toEqual(['500/1200', '1000/1200', '1200/1200']);
    expect((await a.db.entriesFor('2026-10-09')).length).toBe(1201);
    expect((await b.db.entriesFor('2026-10-09')).length).toBe(1201);
  });

  it('a connection closed right after the final step still counts as a successful sync', async () => {
    const a = await device();
    const b = await device();
    await a.db.putEntry(entry('a1'));
    const [chA, chB] = linked(a, b, { closeAfterDone: true });
    const [, rb] = await Promise.all([a.pair.runSync(chA, 'first'), b.pair.runSync(chB, 'second')]);
    expect(rb.received).toBe(1);
  });

  it('refuses a device speaking another protocol version', async () => {
    const a = await device();
    const { runSync } = a.pair;
    const fake: Channel = { send: async () => {}, next: async () => ({ t: 'hello', v: 1 }), flush: async () => {} };
    await expect(runSync(fake, 'first')).rejects.toMatchObject({ kind: 'version' });
    await expect(runSync(fake, 'second')).rejects.toMatchObject({ kind: 'version' });
  });
});
