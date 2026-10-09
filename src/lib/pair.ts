// Pairing two of the user's devices for sync (M17b): a direct WebRTC data channel on the local
// network, set up by exchanging two codes — shown as QR codes or copied as text. No server: no STUN
// or TURN, so nothing reaches a third party, and both devices must be on the same network.
// The channel is encrypted (DTLS); the codes carry each side's key fingerprint, so only the device
// that scanned this screen can connect. Loaded only on the sync screen.
import { applyChanges, changesFor, summarize, type Change, type Summary, type SyncStore } from './sync';

const PREFIX = 'IL1.';
/** Protocol version: bump when messages change, so mismatched app versions refuse cleanly. */
const VERSION = 1;

export class PairError extends Error {
  constructor(public kind: 'code' | 'version' | 'timeout' | 'closed' | 'protocol') {
    super(kind);
  }
}

// --- Codes (session descriptions, compressed: QR codes stay easy to scan) ---

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeSignal(desc: RTCSessionDescriptionInit): Promise<string> {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  return PREFIX + b64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

export async function decodeSignal(code: string, expect: 'offer' | 'answer'): Promise<RTCSessionDescriptionInit> {
  const c = code.trim();
  if (!c.startsWith(PREFIX) || c.length > 8000) throw new PairError('code');
  try {
    const json = new TextDecoder().decode(await pipe(unb64url(c.slice(PREFIX.length)), new DecompressionStream('deflate-raw')));
    const x = JSON.parse(json) as { t?: unknown; s?: unknown };
    if (x.t !== expect || typeof x.s !== 'string' || !x.s.startsWith('v=0')) throw new Error();
    return { type: expect, sdp: x.s };
  } catch {
    throw new PairError('code');
  }
}

// --- Messages over the channel (split into parts: data channels cap the message size) ---

export type SyncMsg = { t: 'hello'; v: number } | { t: 'summary'; s: Summary } | { t: 'changes'; c: Change[] } | { t: 'done' };

/** Characters of the message per part; with JSON escaping a part stays under ~32 KB. */
export const PART = 16_000;

export function frame(msg: SyncMsg): string[] {
  const json = JSON.stringify(msg);
  const n = Math.max(1, Math.ceil(json.length / PART));
  return Array.from({ length: n }, (_, i) => JSON.stringify({ i, n, d: json.slice(i * PART, (i + 1) * PART) }));
}

/** Collects parts in order; returns the message once complete. */
export class Reassembler {
  private parts: string[] = [];
  push(raw: string): SyncMsg | undefined {
    const p = JSON.parse(raw) as { i: number; n: number; d: string };
    if (p.i !== this.parts.length || typeof p.d !== 'string' || p.n < 1) throw new PairError('protocol');
    this.parts.push(p.d);
    if (this.parts.length < p.n) return undefined;
    const msg = JSON.parse(this.parts.join('')) as SyncMsg;
    this.parts = [];
    return msg;
  }
}

/** A message transport: what the sync protocol needs from a data channel (tests use a fake). */
export interface Channel {
  send(msg: SyncMsg): Promise<void>;
  next(): Promise<SyncMsg>;
}

export interface Progress {
  step: 'hello' | 'summary' | 'changes' | 'applying' | 'done';
}

/**
 * The sync protocol; both devices run the same steps, so it doesn't matter who started.
 * Returns how many records this device received and sent.
 */
export async function runSync(
  ch: Channel,
  onStep: (p: Progress) => void = () => {},
): Promise<{ received: number; sent: number; stores: SyncStore[] }> {
  const want = async <T extends SyncMsg['t']>(t: T): Promise<Extract<SyncMsg, { t: T }>> => {
    const m = await ch.next();
    if (m.t !== t) throw new PairError('protocol');
    return m as Extract<SyncMsg, { t: T }>;
  };
  onStep({ step: 'hello' });
  await ch.send({ t: 'hello', v: VERSION });
  if ((await want('hello')).v !== VERSION) throw new PairError('version');
  onStep({ step: 'summary' });
  const summary = await summarize();
  await ch.send({ t: 'summary', s: summary });
  const theirs = (await want('summary')).s;
  onStep({ step: 'changes' });
  const mine = await changesFor(theirs, summary);
  await ch.send({ t: 'changes', c: mine });
  const incoming = (await want('changes')).c;
  onStep({ step: 'applying' });
  const applied = await applyChanges(incoming);
  await ch.send({ t: 'done' });
  await want('done');
  onStep({ step: 'done' });
  return { received: applied.count, sent: mine.length, stores: applied.stores };
}

// --- WebRTC ---

/** Wrap an open data channel as a Channel, with back-pressure for big histories. */
export function channelOf(dc: RTCDataChannel): Channel {
  const queue: SyncMsg[] = [];
  const waiters: { ok: (m: SyncMsg) => void; fail: (e: unknown) => void }[] = [];
  const asm = new Reassembler();
  let error: unknown;
  const fail = (e: unknown) => {
    error = e;
    for (const w of waiters.splice(0)) w.fail(e);
  };
  dc.onmessage = (ev) => {
    try {
      const m = asm.push(String(ev.data));
      if (!m) return;
      const w = waiters.shift();
      if (w) w.ok(m);
      else queue.push(m);
    } catch (e) {
      fail(e);
    }
  };
  dc.onclose = () => fail(new PairError('closed'));
  dc.bufferedAmountLowThreshold = 256 * 1024;
  return {
    async send(msg) {
      for (const part of frame(msg)) {
        if (dc.bufferedAmount > 1024 * 1024) await new Promise((ok) => dc.addEventListener('bufferedamountlow', ok, { once: true }));
        dc.send(part);
      }
    },
    next() {
      if (error) return Promise.reject(error);
      const m = queue.shift();
      if (m) return Promise.resolve(m);
      return new Promise((ok, failW) => waiters.push({ ok, fail: failW }));
    },
  };
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, no) => setTimeout(() => no(new PairError('timeout')), ms))]);

async function gathered(pc: RTCPeerConnection): Promise<void> {
  // The whole description goes into one code, so wait for all (local-network) candidates.
  if (pc.iceGatheringState === 'complete') return;
  await withTimeout(
    new Promise<void>((ok) => pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && ok())),
    5000,
  ).catch(() => {}); // use what was gathered so far
}

export interface Pairing {
  /** The code to show (QR) to the other device. */
  code: string;
  /** Resolves when the encrypted channel is open. */
  open: Promise<Channel>;
  /** Offerer only: give it the other device's answer code. */
  accept?: (answer: string) => Promise<void>;
  close(): void;
}

function opened(dc: RTCDataChannel): Promise<Channel> {
  return withTimeout(
    new Promise<Channel>((ok, no) => {
      if (dc.readyState === 'open') return ok(channelOf(dc));
      dc.onopen = () => ok(channelOf(dc));
      dc.onerror = () => no(new PairError('closed'));
    }),
    60_000,
  );
}

/** Device A: create the first code. */
export async function startOffer(): Promise<Pairing> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const dc = pc.createDataChannel('iron-log-sync', { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return {
    code: await encodeSignal(pc.localDescription!),
    open: opened(dc),
    accept: async (answer) => pc.setRemoteDescription(await decodeSignal(answer, 'answer')),
    close: () => pc.close(),
  };
}

/** Device B: answer the code scanned from device A. */
export async function answerOffer(offerCode: string): Promise<Pairing> {
  const offer = await decodeSignal(offerCode, 'offer');
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = new Promise<RTCDataChannel>((ok) => (pc.ondatachannel = (ev) => ok(ev.channel)));
  await pc.setRemoteDescription(offer);
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  return {
    code: await encodeSignal(pc.localDescription!),
    open: channel.then(opened),
    close: () => pc.close(),
  };
}
