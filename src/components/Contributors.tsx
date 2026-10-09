import { useEffect, useState } from 'preact/hooks';
import { entriesBetween, type Entry } from '../lib/db';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { contributors } from '../lib/report';
import { ensureFoods, foods } from '../state';
import { Sheet } from './Sheet';

/** Which foods gave the most of one nutrient over a period. Loaded lazily. */
export default function Contributors({ nutrient, from, to }: { nutrient: string; from: string; to: string }) {
  const [list, setList] = useState<Entry[] | null>(null);
  useEffect(() => {
    void entriesBetween(from, to).then(async (e) => {
      await ensureFoods(e.map((x) => x.foodRef));
      setList(e);
    });
  }, [nutrient, from, to]);

  const n = NUTRIENTS[NUTRIENT_INDEX[nutrient]];
  const top = list ? contributors(list, foods.value, NUTRIENT_INDEX[nutrient]) : [];
  return (
    <Sheet title={`${t('topSources')}: ${n[lang.value]}`}>
      <div class="pad">
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
      </div>
    </Sheet>
  );
}
