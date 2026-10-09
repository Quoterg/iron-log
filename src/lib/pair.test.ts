import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import type { Entry } from './db';

const SDP = 'v=0\r\no=- 46117 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=fingerprint:sha-256 AA:BB\r\n'.repeat(4);

async function device() {
  vi.resetModules();
  (globalThis as { indexedDB?: unknown }).indexedDB = new IDBFactory();
  const db = await import('./db');
  const pair = await import('./pair');
  await db.getSettings(); // open this device's database while its factory is the global one
  return { db, pair };
}

describe('pairing codes', () => {
  it('round-trip a description, compressed, and reject anything else', async () => {
    const { encodeSignal, decodeSignal, PairError } = await import('./pair');
    const code = await encodeSignal({ type: 'offer', sdp: SDP });
    expect(code.startsWith('IL1.')).toBe(true);
    expect(code.length).toBeLessThan(SDP.length); // compressed: easier QR
    expect(await decodeSignal(code, 'offer')).toEqual({ type: 'offer', sdp: SDP });
    await expect(decodeSignal(code, 'answer')).rejects.toThrow(PairError); // wrong step
    await expect(decodeSignal('hello', 'offer')).rejects.toThrow(PairError);
    await expect(decodeSignal('IL1.!!!not-base64', 'offer')).rejects.toThrow(PairError);
  });
});

describe('message framing', () => {
  it('splits long messages into parts and reassembles them in order', async () => {
    const { frame, Reassembler, PART } = await import('./pair');
    const big = { t: 'changes' as const, c: Array.from({ length: 2000 }, (_, i) => ({ k: `entries:${i}`, mt: i, v: { x: 'y'.repeat(20) } })) };
    const parts = frame(big);
    expect(parts.length).toBeGreaterThan(1);
    // Escaping can at most double a part: still far below data channels' 64 KB+ message limit.
    expect(parts.every((p) => p.length <= 2 * PART + 64)).toBe(true);
    const asm = new Reassembler();
    const got = parts.map((p) => asm.push(p));
    expect(got.slice(0, -1).every((m) => m === undefined)).toBe(true);
    expect(got.at(-1)).toEqual(big);
    expect(() => new Reassembler().push(parts[1])).toThrow(); // out of order
  });
});

describe('sync protocol over a channel', () => {
  it('two devices end up with the same data, whoever starts', async () => {
    const a = await device();
    const b = await device();
    const e = (id: string): Entry => ({ id, date: '2026-10-09', meal: 'lunch', foodRef: 'slv:1', grams: 100, createdAt: 1 });
    await a.db.putEntry(e('a1'));
    await b.db.putEntry(e('b1'));
    for (let i = 0; i < 300; i++) await b.db.putEntry(e(`bulk${i}`)); // several parts

    // An in-memory channel pair that sends through the real framing.
    type Msg = import('./pair').SyncMsg;
    const link = () => {
      const inbox: Msg[] = [];
      const waiting: ((m: Msg) => void)[] = [];
      const asm = new a.pair.Reassembler();
      return {
        deliver(raw: string) {
          const m = asm.push(raw);
          if (!m) return;
          const w = waiting.shift();
          if (w) w(m);
          else inbox.push(m);
        },
        next: () => (inbox.length ? Promise.resolve(inbox.shift()!) : new Promise<Msg>((ok) => waiting.push(ok))),
      };
    };
    const toA = link();
    const toB = link();
    const chA = { send: async (m: Msg) => a.pair.frame(m).forEach((p) => toB.deliver(p)), next: toA.next };
    const chB = { send: async (m: Msg) => b.pair.frame(m).forEach((p) => toA.deliver(p)), next: toB.next };

    const [ra, rb] = await Promise.all([a.pair.runSync(chA), b.pair.runSync(chB)]);
    expect(ra).toEqual({ received: 301, sent: 1, stores: ['entries'] });
    expect(rb).toEqual({ received: 1, sent: 301, stores: ['entries'] });
    expect((await a.db.entriesFor('2026-10-09')).length).toBe(302);
    expect((await b.db.entriesFor('2026-10-09')).length).toBe(302);
  });
});
