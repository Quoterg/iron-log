import { useEffect, useMemo, useState } from 'preact/hooks';
import { lastDays, movingAverage, series, type BodyEntry, type BodyMetric } from '../lib/body';
import { isoDate } from '../lib/db';
import { inputNum, parseNum, t } from '../lib/i18n';
import { bodyLog, loadBody, saveBody } from '../state';
import { LineChart } from './LineChart';

const METRICS: { key: BodyMetric; label: 'bodyWeight' | 'bodyFat' | 'bodyWaist'; unit: string; min: number; max: number }[] = [
  { key: 'weightKg', label: 'bodyWeight', unit: 'kg', min: 20, max: 400 },
  { key: 'bodyFatPct', label: 'bodyFat', unit: '%', min: 2, max: 75 },
  { key: 'waistCm', label: 'bodyWaist', unit: 'cm', min: 30, max: 250 },
];
const RANGES: { days: number | null; label: 'range30' | 'range90' | 'range365' | 'rangeAll' }[] = [
  { days: 30, label: 'range30' },
  { days: 90, label: 'range90' },
  { days: 365, label: 'range365' },
  { days: null, label: 'rangeAll' },
];

/** The "Kropp" tab: log weight, body fat and waist; see trends. Loaded lazily. */
export default function BodyView() {
  useEffect(() => void loadBody(), []);
  // "Today" moves on if the app stays open past midnight.
  const [today, setToday] = useState(() => isoDate(new Date()));
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && setToday(isoDate(new Date()));
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);
  const [day, setDay] = useState(today);
  const [range, setRange] = useState<number | null>(90);
  const log = bodyLog.value;
  // Series and trends depend only on the log; range chips just re-slice them.
  const all = useMemo(
    () => METRICS.map((m) => ({ m, all: log ? series(log, m.key) : [] })).map((x) => ({ ...x, trend: movingAverage(x.all) })),
    [log],
  );
  if (!log) return <p class="muted center">{t('loading')}</p>;

  const existing = log.find((e) => e.date === day);
  return (
    <>
      <section class="card form">
        <h2>{t('logBody')}</h2>
        <BodyForm key={day} day={day} existing={existing} onDay={setDay} today={today} />
      </section>

      <div class="chips" role="group" aria-label={t('range')}>
        {RANGES.map((r) => (
          <button key={r.label} class={range === r.days ? 'chip on' : 'chip'} aria-pressed={range === r.days} onClick={() => setRange(r.days)}>
            {t(r.label)}
          </button>
        ))}
      </div>
      {all.map(({ m, all, trend }) => {
        // Trend from the full history, so the window's first points still average real data.
        const pts = lastDays(all, today, range);
        const tr = trend.slice(trend.length - pts.length);
        return pts.length ? (
          <section class="card" key={m.key}>
            <LineChart title={t(m.label)} unit={m.unit} points={pts} trend={tr} />
          </section>
        ) : null;
      })}
      {log.length === 0 && <p class="muted center">{t('noBodyData')}</p>}
    </>
  );
}

function BodyForm({ day, existing, onDay, today }: { day: string; existing?: BodyEntry; onDay: (d: string) => void; today: string }) {
  const [vals, setVals] = useState<Record<BodyMetric, string>>({
    weightKg: existing?.weightKg != null ? inputNum(existing.weightKg) : '',
    bodyFatPct: existing?.bodyFatPct != null ? inputNum(existing.bodyFatPct) : '',
    waistCm: existing?.waistCm != null ? inputNum(existing.waistCm) : '',
  });
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    if (day > today) return setError(true);
    const entry: BodyEntry = { date: day, updatedAt: Date.now() };
    for (const m of METRICS) {
      const text = vals[m.key].trim();
      if (!text) continue;
      const v = parseNum(text);
      if (!(v >= m.min && v <= m.max)) return setError(true);
      entry[m.key] = Math.round(v * 10) / 10;
    }
    setError(false);
    await saveBody(entry);
    setSaved(true);
  };

  return (
    <form onSubmit={submit} noValidate>
      <label>
        {t('date')}
        <input type="date" value={day} max={today} onChange={(e) => onDay((e.currentTarget as HTMLInputElement).value || today)} />
      </label>
      <div class="grid2">
        {METRICS.map((m) => (
          <label key={m.key}>
            {t(m.label)} ({m.unit})
            <input
              type="text"
              inputMode="decimal"
              value={vals[m.key]}
              onInput={(e) => {
                setSaved(false);
                setVals({ ...vals, [m.key]: (e.currentTarget as HTMLInputElement).value });
              }}
            />
          </label>
        ))}
      </div>
      {error && <p class="error-text">{t('bodyInvalid')}</p>}
      <div class="actions">
        <button type="submit" class="btn primary">
          {t('save')}
        </button>
      </div>
      {saved && (
        <p class="small muted" role="status">
          {t('bodySaved')}
        </p>
      )}
    </form>
  );
}
