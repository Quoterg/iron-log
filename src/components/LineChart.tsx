import { useState } from 'preact/hooks';
import { niceScale, type Point } from '../lib/body';
import { fmtAmount, lang, t } from '../lib/i18n';

const W = 320;
const H = 150;
const PAD = { top: 10, right: 12, bottom: 22, left: 34 };

const DAY = 86_400_000;
const time = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const shortDate = (d: string) =>
  new Date(time(d)).toLocaleDateString(lang.value === 'sv' ? 'sv-SE' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * One measure over time: measurement dots + a 7-day trend line. Hand-written SVG (no chart
 * library); crosshair + tooltip on pointer and keyboard; every value also in a table.
 */
export function LineChart({ title, unit, points, trend }: { title: string; unit: string; points: Point[]; trend: Point[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return null;

  const t0 = time(points[0].date);
  const t1 = Math.max(time(points[points.length - 1].date), t0 + DAY);
  const values = [...points, ...trend].map((p) => p.value);
  const { lo, hi, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const x = (d: string) => PAD.left + ((time(d) - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  const path = trend.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.date) - px) < Math.abs(x(points[best].date) - px)) best = i;
    });
    return best;
  };

  const a = active == null ? null : points[active];
  const last = points[points.length - 1];
  const summary = `${title}: ${points.length} ${t('measurements')}, ${t('latest')} ${fmtAmount(last.value)} ${unit} (${shortDate(last.date)}), ${t('trend7')} ${fmtAmount(trend[trend.length - 1].value)} ${unit}.`;

  return (
    <figure class="chart">
      <figcaption>
        <span class="chart-title">{title}</span>
        <span class="chart-legend" aria-hidden="true">
          <span class="key-dot" /> {t('measurement')}
          <span class="key-line" /> {t('trend7')}
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={summary}
        tabIndex={0}
        onPointerMove={(e) => setActive(nearest(e.clientX, (e.currentTarget as SVGSVGElement).getBoundingClientRect()))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const step = e.key === 'ArrowRight' ? 1 : -1;
            setActive(Math.min(points.length - 1, Math.max(0, (active ?? (step > 0 ? -1 : points.length)) + step)));
          }
        }}
        onBlur={() => setActive(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line class="grid" x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} />
            <text class="axis" x={PAD.left - 6} y={y(v) + 3} text-anchor="end">
              {fmtAmount(v)}
            </text>
          </g>
        ))}
        <text class="axis" x={PAD.left} y={H - 6}>
          {shortDate(points[0].date)}
        </text>
        <text class="axis" x={W - PAD.right} y={H - 6} text-anchor="end">
          {shortDate(last.date)}
        </text>
        {a && <line class="crosshair" x1={x(a.date)} x2={x(a.date)} y1={PAD.top} y2={H - PAD.bottom} />}
        <path class="trend" d={path} />
        {points.map((p, i) => (
          <circle key={p.date} class={i === active ? 'point on' : 'point'} cx={x(p.date)} cy={y(p.value)} r={4} />
        ))}
      </svg>
      <p class="chart-tip num" aria-live="polite">
        {a ? (
          <>
            <b>
              {fmtAmount(a.value)} {unit}
            </b>{' '}
            · {t('trend7')} {fmtAmount(trend[active!].value)} {unit} · {shortDate(a.date)}
          </>
        ) : (
          <span class="muted">{t('chartHint')}</span>
        )}
      </p>
      <details>
        <summary class="small">{t('showTable')}</summary>
        <table class="data">
          <thead>
            <tr>
              <th>{t('date')}</th>
              <th>
                {t('measurement')} ({unit})
              </th>
              <th>
                {t('trend7')} ({unit})
              </th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p, i) => (
              <tr key={p.date}>
                <td>{p.date}</td>
                <td class="num">{fmtAmount(p.value)}</td>
                <td class="num">{fmtAmount(trend[points.length - 1 - i].value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
