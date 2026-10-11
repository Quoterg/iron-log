import { useMemo } from 'preact/hooks';
import { fmt, nutrientName } from '../lib/i18n';
import { NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { tg } from '../lib/strings-suggest';
import { dayTotals, targets } from '../state';

/**
 * "What if": how the day's energy and the nutrients this food adds most to (vs. their targets) would
 * move if it were logged. Neutral information; shown by default, can be switched off in Settings.
 */
export default function WhatIf({ per100g, grams }: { per100g: (number | null)[]; grams: number }) {
  const tgt = targets.value;
  const before = dayTotals.value;
  const add = (i: number) => ((per100g[i] ?? 0) * grams) / 100;
  // Energy, then up to 3 nutrients still short of their target where this amount adds ≥ 5 % of it,
  // largest share first (not salt/sodium: limits in practice, never something to fill up).
  const keys = useMemo(
    () =>
      NUTRIENTS.filter(
        (n) =>
          n.key !== 'kcal' && n.key !== 'sodium' && n.key !== 'salt' && tgt[n.key]?.min &&
          per100g[NUTRIENT_INDEX[n.key]] != null && before[NUTRIENT_INDEX[n.key]] < tgt[n.key].min!,
      )
        .map((n) => ({ key: n.key, share: add(NUTRIENT_INDEX[n.key]) / tgt[n.key].min! }))
        .filter((x) => x.share >= 0.05)
        .sort((a, b) => b.share - a.share)
        .slice(0, 3)
        .map((x) => x.key),
    [per100g, grams, before, tgt],
  );
  if (!(grams > 0)) return null;
  return (
    <section class="whatif" aria-label={tg('whatIfTitle')}>
      <h3 class="small muted">{tg('whatIfTitle')}</h3>
      {['kcal', ...keys].map((key) => {
        const i = NUTRIENT_INDEX[key];
        const goal = tgt[key]?.min ?? tgt[key]?.max ?? null;
        const now = before[i];
        const next = now + add(i);
        const n = NUTRIENTS[i];
        return (
          <div key={key} class="whatif-row">
            <div class="bar-head">
              <span>{nutrientName(n)}</span>
              <span class="num">
                {fmt(now, now < 10 ? 1 : 0)} → <b>{fmt(next, next < 10 ? 1 : 0)}</b> {n.unit}
                {goal ? ` · ${fmt((next / goal) * 100)} %` : ''}
              </span>
            </div>
            {goal ? (
              <div class="track whatif-track">
                <div class="fill whatif-after" style={{ transform: `scaleX(${Math.min(next / goal, 1)})` }} />
                <div class="fill whatif-before" style={{ transform: `scaleX(${Math.min(now / goal, 1)})` }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
