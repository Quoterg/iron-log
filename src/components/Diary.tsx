import { entryVector, MEALS, type Entry } from '../lib/db';
import { fmt, fmtAmount, lang, t, unitLabel } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS, value } from '../lib/nutrients';
import { energySplit } from '../lib/totals';
import { open } from '../nav';
import { signal } from '@preact/signals';
import type { ActivityType } from '../lib/activity-types';
import { addWater, burnedToday, dayActivities, dayTotals, dayWater, entries, foods, removeActivity, settings, targets } from '../state';
import { Bar } from './Bar';

/** Activity names, loaded on demand (only days with activities need them). */
const activityTypes = signal<ActivityType[] | null>(null);
const loadActivityTypes = () =>
  void import('../lib/activity-types').then((m) => void (activityTypes.value = m.ACTIVITIES));

export function Diary() {
  if (dayActivities.value.length && !activityTypes.value) loadActivityTypes();
  const tot = dayTotals.value;
  const g = (k: string) => tot[NUTRIENT_INDEX[k]];
  const tg = targets.value;
  const split = energySplit(g('protein'), g('carbs'), g('fat'), g('alcohol'));

  return (
    <>
      <section class="card summary">
        <Bar label={t('energy')} amount={g('kcal')} unit="kcal" target={tg.kcal} />
        {settings.value.addBurnedToTarget && burnedToday.value > 0 && (
          <p class="muted small">{t('targetInclActivity').replace('{kcal}', fmt(burnedToday.value))}</p>
        )}
        <div class="macros">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div class={`macro m-${k}`} key={k}>
              <span class="macro-val num">{fmt(g(k))} g</span>
              <span class="macro-lbl">{NUTRIENTS[NUTRIENT_INDEX[k]][lang.value]}</span>
              <span class="macro-pct num">{Math.round(split[k] * 100)} E%</span>
            </div>
          ))}
        </div>
      </section>

      {MEALS.map((meal) => {
        const list = entries.value.filter((e) => e.meal === meal);
        const kcal = list.reduce((s, e) => s + entryKcal(e), 0);
        return (
          <section class="card meal" key={meal}>
            <header class="meal-head">
              <h2>{t(meal)}</h2>
              <span class="num muted">{list.length ? `${fmt(kcal)} kcal` : ''}</span>
              <button class="btn small" onClick={() => open({ kind: 'search', meal })}>
                + {t('addFood')}
              </button>
            </header>
            {list.length > 0 && (
              <>
              <ul class="entries">
                {list.map((e) => (
                  <li key={e.id}>
                    <button class="entry" onClick={() => open({ kind: 'food', ref: e.foodRef, entryId: e.id })}>
                      <span class="entry-name">{name(e)}</span>
                      <span class="num muted">
                        {e.unit && e.qty ? `${fmtAmount(e.qty)} ${unitLabel(e.unit)}` : `${fmtAmount(e.grams)} g`}
                      </span>
                      <span class="num">{fmt(entryKcal(e))} kcal</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button class="link" onClick={() => open({ kind: 'copy', meal })}>
                {t('copyMeal')}
              </button>
              </>
            )}
          </section>
        );
      })}
      <section class="card">
        <header class="meal-head">
          <h2>{t('activityLog')}</h2>
          <span class="num muted">{burnedToday.value ? `−${fmt(burnedToday.value)} kcal` : ''}</span>
          <button class="btn small" onClick={() => open({ kind: 'activity' })}>
            + {t('addFood')}
          </button>
        </header>
        {dayActivities.value.length > 0 && (
          <ul class="entries">
            {dayActivities.value.map((a) => {
              const type = activityTypes.value?.find((x) => x.id === a.type);
              return (
                <li key={a.id} class="ingredient">
                  <span class="entry entry-static">
                    <span class="entry-name">{type ? type[lang.value] : '…'}</span>
                    <span class="num muted">{a.minutes} min</span>
                    <span class="num">{fmt(a.kcal)} kcal</span>
                  </span>
                  <button class="btn small" aria-label={`${t('remove')} ${type?.[lang.value] ?? ''}`} onClick={() => void removeActivity(a.id)}>
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section class="card">
        <header class="meal-head">
          <h2>{t('water')}</h2>
          <span class="num">{fmt(dayWater.value / 1000, 2)} l</span>
        </header>
        <div class="chips">
          <button class="chip" onClick={() => void addWater(200)}>+2 dl</button>
          <button class="chip" onClick={() => void addWater(500)}>+5 dl</button>
          <button class="chip" disabled={dayWater.value === 0} onClick={() => void addWater(-200)}>
            −2 dl
          </button>
        </div>
      </section>
      {entries.value.length === 0 ? (
        <p class="muted center">{t('emptyDay')}</p>
      ) : (
        <button class="btn wide" onClick={() => open({ kind: 'copy' })}>
          {t('copyDay')}
        </button>
      )}
    </>
  );
}

function name(e: Entry): string {
  const f = foods.value.get(e.foodRef);
  return f ? foodName(f, lang.value) : '…';
}

function entryKcal(e: Entry): number {
  const v = entryVector(e, foods.value);
  return v ? (value(v, 'kcal') * e.grams) / 100 : 0;
}
