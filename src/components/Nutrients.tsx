import { useEffect, useMemo, useState } from 'preact/hooks';
import { addDays, entriesBetween, isoDate, recentLoggedDates, type Entry } from '../lib/db';
import { fmt, nutrientName, t } from '../lib/i18n';
import { NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { averagePerDay, coverage, dailyTotals, gaps, knownNutrients, MIN_COVERAGE, streak } from '../lib/report';
import { open } from '../nav';
import { date, dayTotals, ensureFoods, entries as dayEntries, foods, periodCache, targets } from '../state';
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
    let live = true;
    const today = isoDate(new Date());
    void recentLoggedDates(today).then((d) => live && setDays(streak(d, today)));
    return () => void (live = false);
  }, [dayEntries.value.length]);

  useEffect(() => {
    // Never show the previous period's numbers under the new period's label.
    setPeriodEntries(null);
    if (period === 1) return;
    let live = true;
    void entriesBetween(from, to).then(async (list) => {
      await ensureFoods(list.map((e) => e.foodRef));
      if (!live) return;
      periodCache.value = { key: `${from}|${to}`, entries: list };
      setPeriodEntries(list);
    });
    return () => void (live = false);
  }, [period, to, dayEntries.value]);

  const report = useMemo(() => {
    // With no entries everything is simply 0 of target; "unknown" only means no logged food reports it.
    const known = (list: Entry[]) => (list.length ? knownNutrients(list, foods.value) : undefined);
    if (period === 1) return { amounts: dayTotals.value, known: known(dayEntries.value), covered: undefined, perDay: null };
    if (!periodEntries) return null;
    const perDay = dailyTotals(periodEntries, foods.value);
    // Shortfalls are only listed for nutrients the period's food mostly reports (see coverage()).
    const covered = coverage(periodEntries, foods.value).map((c) => c >= MIN_COVERAGE);
    return { amounts: averagePerDay(perDay), known: known(periodEntries), covered, perDay };
  }, [period, periodEntries, dayTotals.value, dayEntries.value, foods.value]);
  const amounts = report?.amounts ?? null;
  const perDay = report?.perDay ?? null;
  const g = useMemo(
    () => (report && period !== 1 && perDay?.size ? gaps(report.amounts, targets.value, report.covered) : null),
    [report, targets.value],
  );
  const label = (key: string) => nutrientName(NUTRIENTS[NUTRIENT_INDEX[key]]);

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
              <b>{t('overLimit')}:</b>{' '}
              {g.high.slice(0, 6).map((x, i) => (
                <span key={x.key}>
                  {i > 0 && ', '}
                  <button class="link inline" onClick={() => open({ kind: 'contributors', key: x.key, from, to })}>
                    {label(x.key)} {fmt(x.ratio * 100)} %
                  </button>
                </span>
              ))}
            </p>
          )}
        </section>
      )}
      {amounts ? (
        <NutrientGroups amounts={amounts} known={report?.known} onSelect={(key) => open({ kind: 'contributors', key, from, to })} />
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
