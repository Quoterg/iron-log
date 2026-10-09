import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { encode } from 'uqr';
import { fmt, t } from '../lib/i18n';
import { allowLocalAddresses, answerOffer, PairError, runSync, startOffer, type Pairing, type Progress } from '../lib/pair';
import { back } from '../nav';
import { Sheet } from './Sheet';
import { ts } from '../lib/strings-sync';

type Step =
  | { s: 'choose' }
  | { s: 'preparing' }
  | { s: 'showOffer'; p: Pairing }
  | { s: 'scanOffer' }
  | { s: 'showAnswer'; p: Pairing }
  | { s: 'syncing'; progress: Progress }
  | { s: 'done'; received: number; sent: number }
  | { s: 'error'; kind: string; saved: boolean };

/**
 * Sync with another of the user's devices: device A shows a code, device B scans it and shows its
 * answer, A scans that — then the two sync directly (same network, encrypted). Loaded lazily.
 */
export default function SyncSheet() {
  const [step, setStep] = useState<Step>({ s: 'choose' });
  const pairing = useRef<Pairing | null>(null);
  /** Each attempt gets a number: callbacks from an abandoned attempt must not touch the screen. */
  const attempt = useRef(0);
  /** Changes already saved in this attempt (an error after that must not claim nothing changed). */
  const saved = useRef(0);
  useEffect(() => () => pairing.current?.close(), []);

  /** Start over: close any previous connection and ignore its late callbacks. */
  const fresh = () => {
    pairing.current?.close();
    pairing.current = null;
    saved.current = 0;
    return ++attempt.current;
  };
  const live = (n: number) => n === attempt.current;
  const fail = (n: number, e: unknown) => {
    if (!live(n)) return;
    pairing.current?.close();
    setStep({ s: 'error', kind: e instanceof PairError ? e.kind : 'other', saved: saved.current > 0 });
  };

  /** Once the channel is open: sync, then show the result. */
  const sync = async (n: number, p: Pairing) => {
    try {
      const ch = await p.open;
      if (!live(n)) return;
      setStep({ s: 'syncing', progress: { step: 'hello' } });
      const r = await runSync(
        ch,
        (pr) => live(n) && setStep({ s: 'syncing', progress: pr }),
        (count) => (saved.current = count),
      );
      if (live(n)) setStep({ s: 'done', received: r.received, sent: r.sent });
    } catch (e) {
      fail(n, e);
    } finally {
      p.close();
    }
  };

  const begin = async () => {
    const n = fresh();
    setStep({ s: 'preparing' });
    try {
      await allowLocalAddresses(); // so the code carries a reachable local address (see pair.ts)
      const p = await startOffer();
      if (!live(n)) return p.close();
      pairing.current = p;
      setStep({ s: 'showOffer', p });
      void sync(n, p);
    } catch (e) {
      fail(n, e);
    }
  };

  const gotOffer = async (code: string) => {
    const n = fresh();
    setStep({ s: 'preparing' });
    try {
      const p = await answerOffer(code);
      if (!live(n)) return p.close();
      pairing.current = p;
      setStep({ s: 'showAnswer', p });
      void sync(n, p);
    } catch (e) {
      fail(n, e);
    }
  };

  const gotAnswer = async (p: Pairing, code: string) => {
    const n = attempt.current;
    try {
      await p.accept!(code);
      // Unless the channel already got further on its own.
      if (live(n)) setStep((cur) => (cur.s === 'showOffer' ? { s: 'syncing', progress: { step: 'hello' } } : cur));
    } catch (e) {
      fail(n, e);
    }
  };

  const cancel = (
    <div class="actions">
      <button type="button" class="btn" onClick={() => back()}>
        {t('cancel')}
      </button>
    </div>
  );

  return (
    <Sheet title={ts('syncTitle')}>
      <div class="pad">
        {step.s === 'choose' && (
          <>
            <p>{ts('syncIntro')}</p>
            <p class="muted small">{ts('syncPrivacy')}</p>
            <div class="actions">
              <button class="btn primary" onClick={() => void begin()}>
                {ts('syncShowCode')}
              </button>
              <button class="btn" onClick={() => (fresh(), setStep({ s: 'scanOffer' }))}>
                {ts('syncScanCode')}
              </button>
            </div>
          </>
        )}
        {step.s === 'preparing' && <p role="status">{ts('syncPreparing')}</p>}
        {step.s === 'showOffer' && (
          <>
            <p>{ts('syncOfferHint')}</p>
            <Code text={step.p.code} />
            <h3>{ts('syncThenScanAnswer')}</h3>
            <CodeInput onCode={(c) => void gotAnswer(step.p, c)} />
            {cancel}
          </>
        )}
        {step.s === 'scanOffer' && (
          <>
            <p>{ts('syncScanOfferHint')}</p>
            <CodeInput onCode={(c) => void gotOffer(c)} />
            {cancel}
          </>
        )}
        {step.s === 'showAnswer' && (
          <>
            <p>{ts('syncAnswerHint')}</p>
            <Code text={step.p.code} />
            <p class="muted small" role="status">
              {ts('syncWaiting')}
            </p>
            {cancel}
          </>
        )}
        {step.s === 'syncing' && (
          <p role="status">
            {step.progress.step === 'applying' && step.progress.total
              ? ts('syncProgress').replace('{done}', fmt(step.progress.done ?? 0)).replace('{total}', fmt(step.progress.total))
              : ts('syncRunning')}
          </p>
        )}
        {step.s === 'done' && (
          <>
            <p role="status">
              {ts('syncDone').replace('{in}', fmt(step.received)).replace('{out}', fmt(step.sent))}
            </p>
            <div class="actions">
              {/* Reload so every screen shows the merged data. */}
              <button class="btn primary" onClick={() => (step.received ? location.reload() : back())}>
                {t('ok')}
              </button>
            </div>
          </>
        )}
        {step.s === 'error' && (
          <>
            <p class="error-text" role="alert">
              {ts(
                step.kind === 'code'
                  ? 'syncErrorCode'
                  : step.kind === 'version'
                    ? 'syncErrorVersion'
                    : step.saved
                      ? 'syncErrorPartial'
                      : step.kind === 'timeout' || step.kind === 'closed'
                        ? 'syncErrorConnect'
                        : 'syncErrorOther',
              )}
            </p>
            <div class="actions">
              <button class="btn" onClick={() => (fresh(), setStep({ s: 'choose' }))}>
                {t('retry')}
              </button>
              {step.saved && (
                <button class="btn" onClick={() => location.reload()}>
                  {ts('syncShowSaved')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** A pairing code as a QR code (always dark on light: scanners need the contrast) plus copyable text. */
function Code({ text }: { text: string }) {
  // Encoded once per code (not on every re-render, e.g. when "Kopierad" appears).
  const { d, size } = useMemo(() => {
    const qr = encode(text, { ecc: 'L', border: 3 });
    let path = '';
    qr.data.forEach((row, y) => row.forEach((on, x) => on && (path += `M${x} ${y}h1v1h-1z`)));
    return { d: path, size: qr.size };
  }, [text]);
  const [copied, setCopied] = useState(false);
  return (
    <div class="sync-code">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ts('syncQrLabel')} shape-rendering="crispEdges">
        <rect width={size} height={size} fill="#fff" />
        <path d={d} fill="#000" />
      </svg>
      <details>
        <summary>{ts('syncAsText')}</summary>
        <textarea readOnly rows={4} value={text} aria-label={ts('syncAsText')} onFocus={(e) => (e.currentTarget as HTMLTextAreaElement).select()} />
        <button
          type="button"
          class="btn small"
          onClick={() => void navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {})}
        >
          {copied ? ts('copied') : t('copy')}
        </button>
      </details>
    </div>
  );
}

/** Read a pairing code: camera (QR) where available, or pasted text. */
function CodeInput({ onCode }: { onCode: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<'starting' | 'scanning' | 'none'>('starting');
  const [text, setText] = useState('');
  const done = useRef(false);
  const use = (c: string) => {
    if (done.current) return;
    done.current = true;
    onCode(c.trim());
  };

  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera API');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const { createDetector } = await import('../lib/scanner');
        const detector = await createDetector(['qr_code']);
        if (stopped) return;
        setCamera('scanning');
        const tick = async () => {
          if (stopped || done.current) return;
          if (video.readyState >= 2) {
            const hit = (await detector.detect(video).catch(() => [])).map((b) => b.rawValue).find((v) => v.startsWith('IL1.'));
            if (hit) return use(hit);
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch {
        if (!stopped) setCamera('none');
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  return (
    <>
      {camera !== 'none' && (
        <div class="scanner">
          <video ref={videoRef} muted playsInline aria-label={ts('syncScanCode')} />
        </div>
      )}
      <p class="small muted" role="status">
        {camera === 'starting' ? t('scanStarting') : camera === 'scanning' ? ts('syncScanHint') : ts('syncNoCamera')}
      </p>
      <form
        class="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) use(text);
        }}
      >
        <label>
          {ts('syncPasteLabel')}
          <textarea rows={3} value={text} onInput={(e) => setText((e.currentTarget as HTMLTextAreaElement).value)} />
        </label>
        <div class="actions">
          <button type="submit" class="btn" disabled={!text.trim()}>
            {ts('syncUseCode')}
          </button>
        </div>
      </form>
    </>
  );
}
