import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { t } from '../lib/i18n';
import { isValidBarcode, OffError } from '../lib/off';
import { open, replaceTop } from '../nav';
import { lookupBarcode } from '../state';
import { Sheet } from './Sheet';

type Status = 'starting' | 'scanning' | 'noCamera' | 'looking' | 'notFound' | 'noData' | 'network' | 'invalid';

/** Scan (or type) a barcode → look it up → continue to the food screen. */
export function ScanSheet({ meal }: { meal: Meal }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('starting');
  const [code, setCode] = useState('');
  const [lastCode, setLastCode] = useState('');
  const busy = useRef(false);

  const lookup = async (raw: string) => {
    const c = raw.replace(/\s/g, '');
    if (!isValidBarcode(c)) return setStatus('invalid');
    if (busy.current) return;
    busy.current = true;
    setLastCode(c);
    setCode(c); // a scanned code lands in the field, so "Sök" retries it after a network error
    setStatus('looking');
    try {
      const food = await lookupBarcode(c);
      replaceTop({ kind: 'food', ref: food.ref, meal });
    } catch (err) {
      setStatus(err instanceof OffError ? err.kind : 'network');
    } finally {
      busy.current = false;
    }
  };

  // Camera + detection loop. Stops the camera when the sheet closes.
  useEffect(() => {
    let stream: MediaStream | undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera API');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        const { createDetector } = await import('../lib/scanner');
        const detector = await createDetector();
        if (stopped) return;
        setStatus('scanning');
        // ~4 scans per second is plenty and keeps old phones cool.
        const tick = async () => {
          if (stopped) return;
          if (!busy.current && video.readyState >= 2) {
            const found = await detector.detect(video).catch(() => []);
            const hit = found.map((b) => b.rawValue).find(isValidBarcode);
            if (hit) return void lookup(hit);
          }
          timer = setTimeout(tick, 250);
        };
        void tick();
      } catch {
        if (!stopped) setStatus('noCamera');
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, []);

  const message: Partial<Record<Status, string>> = {
    starting: t('scanStarting'),
    scanning: t('scanHint'),
    noCamera: t('scanNoCamera'),
    looking: t('scanLooking'),
    notFound: t('scanNotFound'),
    noData: t('scanNoData'),
    network: t('scanNetwork'),
    invalid: t('scanInvalid'),
  };

  return (
    <Sheet title={t('scanBarcode')}>
      <div class="pad">
        <div class="scanner" hidden={status === 'noCamera'}>
          <video ref={videoRef} muted playsInline aria-label={t('scanBarcode')} />
          <div class="scan-frame" aria-hidden="true" />
        </div>
        <p class="small" role="status">
          {message[status]}
        </p>
        {(status === 'notFound' || status === 'noData') && (
          <button class="btn wide" onClick={() => open({ kind: 'editFood', meal, name: '' })}>
            + {t('createFood')}
          </button>
        )}
        <form
          class="row"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(code);
          }}
        >
          <label>
            {t('barcode')}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              placeholder="7310865004703"
              onInput={(e) => setCode((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <button type="submit" class="btn" disabled={status === 'looking'}>
            {t('lookUp')}
          </button>
        </form>
        {lastCode && <p class="muted small">{t('barcode')}: {lastCode}</p>}
        <p class="muted small">{t('offPrivacy')}</p>
      </div>
    </Sheet>
  );
}
