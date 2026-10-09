import { useEffect, useRef, useState } from 'preact/hooks';
import { encode } from 'uqr';
import { fmt, t } from '../lib/i18n';
import { answerOffer, PairError, runSync, startOffer, type Pairing, type Progress } from '../lib/pair';
import { back } from '../nav';
import { Sheet } from './Sheet';
import { ts } from '../lib/strings-sync';

type Step =
  | { s: 'choose' }
  | { s: 'preparing' }
  | { s: 'showOffer'; p: Pairing }
  | { s: 'scanOffer' }
  | { s: 'showAnswer'; p: Pairing }
  | { s: 'syncing'; step: Progress['step'] }
  | { s: 'done'; received: number; sent: number }
  | { s: 'error'; kind: string };

/**
 * Sync with another of the user's devices: device A shows a code, device B scans it and shows its
 * answer, A scans that — then the two sync directly (same network, encrypted). Loaded lazily.
 */
export default function SyncSheet() {
  const [step, setStep] = useState<Step>({ s: 'choose' });
  const pairing = useRef<Pairing | null>(null);
  useEffect(() => () => pairing.current?.close(), []);

  const fail = (e: unknown) => setStep({ s: 'error', kind: e instanceof PairError ? e.kind : 'other' });

  /** Once the channel is open: sync, then show the result. */
  const sync = async (p: Pairing) => {
    try {
      const ch = await p.open;
      setStep({ s: 'syncing', step: 'hello' });
      const r = await runSync(ch, (pr) => setStep({ s: 'syncing', step: pr.step }));
      setStep({ s: 'done', received: r.received, sent: r.sent });
    } catch (e) {
      fail(e);
    } finally {
      p.close();
    }
  };

  const begin = async () => {
    setStep({ s: 'preparing' });
    try {
      const p = await startOffer();
      pairing.current = p;
      setStep({ s: 'showOffer', p });
      void sync(p);
    } catch (e) {
      fail(e);
    }
  };

  const gotOffer = async (code: string) => {
    setStep({ s: 'preparing' });
    try {
      const p = await answerOffer(code);
      pairing.current = p;
      setStep({ s: 'showAnswer', p });
      void sync(p);
    } catch (e) {
      fail(e);
    }
  };

  const gotAnswer = async (p: Pairing, code: string) => {
    try {
      await p.accept!(code);
      setStep({ s: 'syncing', step: 'hello' });
    } catch (e) {
      fail(e);
    }
  };

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
              <button class="btn" onClick={() => setStep({ s: 'scanOffer' })}>
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
          </>
        )}
        {step.s === 'scanOffer' && (
          <>
            <p>{ts('syncScanOfferHint')}</p>
            <CodeInput onCode={(c) => void gotOffer(c)} />
          </>
        )}
        {step.s === 'showAnswer' && (
          <>
            <p>{ts('syncAnswerHint')}</p>
            <Code text={step.p.code} />
            <p class="muted small" role="status">
              {ts('syncWaiting')}
            </p>
          </>
        )}
        {step.s === 'syncing' && <p role="status">{ts(step.step === 'applying' ? 'syncApplying' : 'syncRunning')}</p>}
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
                    : step.kind === 'timeout' || step.kind === 'closed'
                      ? 'syncErrorConnect'
                      : 'syncErrorOther',
              )}
            </p>
            <div class="actions">
              <button class="btn" onClick={() => setStep({ s: 'choose' })}>
                {t('retry')}
              </button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

/** A pairing code as a QR code (always dark on light: scanners need the contrast) plus copyable text. */
function Code({ text }: { text: string }) {
  const { data, size } = encode(text, { ecc: 'L', border: 3 });
  let d = '';
  data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)));
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
