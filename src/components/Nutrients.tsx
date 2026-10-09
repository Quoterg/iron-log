import { useEffect, useState } from 'preact/hooks';
import { addDays, entriesBetween, isoDate, loggedDates, type Entry } from '../lib/db';
import { fmt, lang, t } from '../lib/i18n';
import { NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { averagePerDay, dailyTotals, gaps, streak } from '../lib/report';
import { open } from '../nav';
import { date, dayTotals, ensureFoods, entries as dayEntries, foods, targets } from '../state';
import { NutrientGroups } from './NutrientGroups';

const PERIODS = [1, 7, 30] as const;
type Period = (typeof PERIODS)[number];

/**
 * Nutrients for the selected day, or the average per logged day over the last 7 / 30 days
 * (ending on the selected day), with gaps vs. targets. Tap a nutrient for its top foods.
 */
export function Nutrients() {
  const [period, setPeriod] = useState<Period>(1);
  const [periodEntries, setPeriodEntries] = useState<Entry[] | null>(null);
  const [days, setDays] = useState<number | null>(null);
  const to = date.value;
  const from = addDays(to, -(period - 1));

  useEffect(() => {
    void loggedDates().then((d) => setDays(streak(d, isoDate(new Date()))));
  }, [dayEntries.value.length]);

  useEffect(() => {
    if (period === 1) return setPeriodEntries(null);
    let live = true;
    void entriesBetween(from, to).then(async (list) => {
      await ensureFoods(list.map((e) => e.foodRef));
      if (live) setPeriodEntries(list);
    });
    return () => void (live = false);
  }, [period, to, dayEntries.value]);

  const perDay = period === 1 ? null : periodEntries && dailyTotals(periodEntries, foods.value);
  const amounts = period === 1 ? dayTotals.value : perDay ? averagePerDay(perDay) : null;
  const g = amounts && period !== 1 && perDay?.size ? gaps(amounts, targets.value) : null;
  const label = (key: string) => NUTRIENTS[NUTRIENT_INDEX[key]][lang.value];

  return (
    <>
      <div class="chips" role="group" aria-label={t('periodLabel')}>
        {PERIODS.map((p) => (
          <button key={p} class={period === p ? 'chip on' : 'chip'} aria-pressed={period === p} onClick={() => setPeriod(p)}>
            {p === 1 ? t('periodDay') : t(p === 7 ? 'period7' : 'period30')}
          </button>
        ))}
      </div>
      {days != null && days > 1 && <p class="muted small">{t('streak').replace('{n}', String(days))}</p>}
      {period !== 1 && perDay && (
        <p class="muted small">
          {t('averageNote').replace('{n}', String(perDay.size)).replace('{d}', String(period))}
        </p>
      )}
      {g && (g.low.length > 0 || g.high.length > 0) && (
        <section class="card">
          <h2>{t('insights')}</h2>
          {g.low.length > 0 && (
            <p class="small">
              <b>{t('lowNutrients')}:</b>{' '}
              {g.low.slice(0, 6).map((x, i) => (
                <span key={x.key}>
                  {i > 0 && ', '}
                  <button class="link inline" onClick={() => open({ kind: 'contributors', key: x.key, from, to })}>
                    {label(x.key)} {fmt(x.ratio * 100)} %
                  </button>
                </span>
              ))}
            </p>
          )}
          {g.high.length > 0 && (
            <p class="small warn">
              <b>{t('overLimit')}:</b> {g.high.map((x) => `${label(x.key)} ${fmt(x.ratio * 100)} %`).join(', ')}
            </p>
          )}
        </section>
      )}
      {amounts ? (
        <NutrientGroups amounts={amounts} onSelect={(key) => open({ kind: 'contributors', key, from, to })} />
      ) : (
        <p class="muted center">{t('loading')}</p>
      )}
      <button class="btn wide" onClick={() => open({ kind: 'targets' })}>
        {t('adjustTargets')}
      </button>
      <p class="muted small">{t('targetsNote')}</p>
    </>
  );
}
