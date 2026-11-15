import { useEffect, useState } from 'preact/hooks';
import { entriesBetween, type Entry } from '../lib/db';
import { dataLang, fmt, fmtAmount, lang, nutrientName, t } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { contributors } from '../lib/report';
import { everydayFoods, perKcal, perKrona, richestFoods, type RankRow, type TopRow } from '../lib/top';
import { ensurePriceBook, priceBook, priceBookFailed } from '../lib/cost';
import { activeSources, ensureFoods, entries as dayEntries, foods, periodCache, settings, targets } from '../state';
import { open } from '../nav';
import { Sheet } from './Sheet';

/**
 * Nutrient detail: the daily target, which foods gave the most of it over a period, and the
 * richest foods in the databases (per 100 g). Loaded lazily.
 */
export default function Contributors({ nutrient, from, to }: { nutrient: string; from: string; to: string }) {
  // Reuse what the Nutrients tab already loaded (no second query, no loading flash).
  const cached = periodCache.value?.key === `${from}|${to}` ? periodCache.value.entries : from === to ? dayEntries.value : null;
  const [list, setList] = useState<Entry[] | null>(cached);
  const [rich, setRich] = useState<TopRow[] | null>(null);
  // Per 100 g (the databases' richest), per 100 kcal (everyday foods) or per 10 kr (M49).
  const costs = !!settings.value.costs;
  const [measure, setMeasure] = useState<Measure>('g');
  const shown = measure === 'kr' && !costs ? 'g' : measure;
  const book = shown === 'kr' ? priceBook.value : null;
  useEffect(() => void (shown === 'kr' && ensurePriceBook()), [shown]);
  useEffect(() => {
    let live = true;
    setRich(null);
    if (shown === 'kr' && !book) return; // shown as loading (or failed) until the prices are in
    const sources = activeSources(settings.value);
    const load = async (): Promise<RankRow[]> => {
      if (shown === 'g') return richestFoods(nutrient, sources);
      const everyday = await everydayFoods(nutrient, sources);
      if (shown === 'kcal') return perKcal(everyday);
      const all = [...everyday, ...(await richestFoods(nutrient, sources))];
      return perKrona(all, (ref) => book!.own.get(ref) ?? book!.typical.get(ref));
    };
    void load().then(
      (r) => live && setRich(r),
      () => live && setRich([]),
    );
    return () => void (live = false);
  }, [nutrient, shown, book]);
  useEffect(() => {
    if (cached) return;
    let live = true;
    void entriesBetween(from, to).then(async (e) => {
      await ensureFoods(e.map((x) => x.foodRef));
      if (live) setList(e);
    });
    return () => void (live = false);
  }, [nutrient, from, to]);

  const n = NUTRIENTS[NUTRIENT_INDEX[nutrient]];
  const top = list ? contributors(list, foods.value, NUTRIENT_INDEX[nutrient]) : [];
  return (
    <Sheet title={nutrientName(n)}>
      <div class="pad">
        <p>
          {t('target')}: <TargetText k={nutrient} unit={n.unit} />
        </p>
        {nutrient === 'fruitVeg' && <p class="muted small">{t('fruitVegNote')}</p>}
        <h3>{t('topSources')}</h3>
        <p class="muted small">{from === to ? from : `${from} – ${to}`}</p>
        {!list && <p class="muted">{t('loading')}</p>}
        {list && top.length === 0 && <p class="muted">{t('noSources')}</p>}
        <ul class="entries">
          {top.map((c) => {
            const f = foods.value.get(c.foodRef);
            return (
              <li key={c.foodRef} class="contrib">
                <span class="entry-name">{f ? foodName(f, lang.value) : '…'}</span>
                <span class="num">
                  {fmtAmount(c.amount)} {n.unit}
                </span>
                <span class="num muted">{fmt(c.share * 100)} %</span>
                <span class="share" style={{ transform: `scaleX(${c.share})` }} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
        <h3>{t('richestFoods')}</h3>
        <div class="chips" role="group" aria-label={t('richestFoods')}>
          {MEASURES.filter(([m]) => m !== 'kr' || costs).map(([m, label]) => (
            <button key={m} class={shown === m ? 'chip on' : 'chip'} aria-pressed={shown === m} onClick={() => setMeasure(m)}>
              {t(label)}
            </button>
          ))}
        </div>
        {!rich && (shown === 'kr' && !book && priceBookFailed.value ? (
          <p class="muted small">
            {t('loadFailed')}{' '}
            <button class="link inline" onClick={ensurePriceBook}>
              {t('retry')}
            </button>
          </p>
        ) : (
          <p class="muted">{t('loading')}</p>
        ))}
        {rich?.length === 0 && <p class="muted">{t('noRichest')}</p>}
        <ul class="entries">
          {rich?.map(([ref, sv, en, value]) => (
            <li key={ref}>
              <button class="entry" onClick={() => open({ kind: 'food', ref })}>
                <span class="entry-name">{dataLang() === 'en' ? (en ?? sv) : sv}</span>
                <span class="num">
                  {fmtAmount(value)} {n.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p class="muted small">{t(NOTE[shown])}</p>
      </div>
    </Sheet>
  );
}

type Measure = 'g' | 'kcal' | 'kr';
const MEASURES = [
  ['g', 'measureG'],
  ['kcal', 'measureKcal'],
  ['kr', 'measureKr'],
] as const;
const NOTE = { g: 'richestNote', kcal: 'richestKcalNote', kr: 'richestKrNote' } as const;

function TargetText({ k, unit }: { k: string; unit: string }) {
  const tg = targets.value[k];
  if (!tg || (tg.min == null && tg.max == null)) return <span class="muted">{t('noTarget')}</span>;
  if (tg.min != null && tg.max != null) return <span class="num">{`${fmtAmount(tg.min)}–${fmtAmount(tg.max)} ${unit}`}</span>;
  return <span class="num">{tg.min != null ? `≥ ${fmtAmount(tg.min)} ${unit}` : `≤ ${fmtAmount(tg.max!)} ${unit}`}</span>;
}
