import { useEffect, useState } from 'preact/hooks';
import { entriesBetween, type Entry } from '../lib/db';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { contributors } from '../lib/report';
import { richestFoods, type TopRow } from '../lib/top';
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
  useEffect(() => {
    let live = true;
    setRich(null);
    void richestFoods(nutrient, activeSources(settings.value)).then(
      (r) => live && setRich(r),
      () => live && setRich([]),
    );
    return () => void (live = false);
  }, [nutrient]);
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
    <Sheet title={n[lang.value]}>
      <div class="pad">
        <p>
          {t('target')}: <TargetText k={nutrient} unit={n.unit} />
        </p>
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
        {!rich && <p class="muted">{t('loading')}</p>}
        {rich?.length === 0 && <p class="muted">{t('noRichest')}</p>}
        <ul class="entries">
          {rich?.map(([ref, sv, en, value]) => (
            <li key={ref}>
              <button class="entry" onClick={() => open({ kind: 'food', ref })}>
                <span class="entry-name">{lang.value === 'en' ? (en ?? sv) : sv}</span>
                <span class="num">
                  {fmtAmount(value)} {n.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p class="muted small">{t('richestNote')}</p>
      </div>
    </Sheet>
  );
}

function TargetText({ k, unit }: { k: string; unit: string }) {
  const tg = targets.value[k];
  if (!tg || (tg.min == null && tg.max == null)) return <span class="muted">{t('noTarget')}</span>;
  if (tg.min != null && tg.max != null) return <span class="num">{`${fmtAmount(tg.min)}–${fmtAmount(tg.max)} ${unit}`}</span>;
  return <span class="num">{tg.min != null ? `≥ ${fmtAmount(tg.min)} ${unit}` : `≤ ${fmtAmount(tg.max!)} ${unit}`}</span>;
}
