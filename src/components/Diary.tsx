import { entryVector, MEALS, type Entry } from '../lib/db';
import { activityName, fmt, fmtAmount, lang, nutrientName, t, unitLabel } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS, value } from '../lib/nutrients';
import { energySplit } from '../lib/totals';
import { open } from '../nav';
import {
  activityTypes, addWater, burnedToday, dayActivities, dayTotals, dayWater, entries, foods, removeActivity, settings, supplementRefs,
  supplements, takeSupplement, targets, toggleSupplementTaken,
} from '../state';
import { Bar } from './Bar';

export function Diary() {
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
              <span class="macro-lbl">{nutrientName(NUTRIENTS[NUTRIENT_INDEX[k]])}</span>
              <span class="macro-pct num">{Math.round(split[k] * 100)} E%</span>
            </div>
          ))}
        </div>
      </section>

      {MEALS.map((meal) => {
        const list = entries.value.filter((e) => e.meal === meal && !supplementRefs.value.has(e.foodRef));
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
      <SupplementCard />
      <ActivityCard />
      <WaterCard />
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

function ActivityCard() {
  return (
    <section class="card">
      <header class="meal-head">
        <h2>{t('activityLog')}</h2>
        <span class="num muted">{burnedToday.value ? `−${fmt(burnedToday.value)} kcal` : ''}</span>
        <button class="btn small" onClick={() => open({ kind: 'activity' })}>
          + {t('add')}
        </button>
      </header>
      {dayActivities.value.length > 0 && (
        <ul class="entries">
          {dayActivities.value.map((a) => {
            const types = activityTypes.value;
            // Unknown id (e.g. from a backup made with another release): show the id itself.
            const type = types?.find((x) => x.id === a.type);
            const name = types ? (type ? activityName(type) : a.type) : '…';
            return (
              <li key={a.id} class="ingredient">
                <span class="entry entry-static">
                  <span class="entry-name">{name}</span>
                  <span class="num muted">{fmt(a.minutes)} min</span>
                  <span class="num">{fmt(a.kcal)} kcal</span>
                </span>
                <button class="btn small" aria-label={`${t('remove')} ${name}`} onClick={() => void removeActivity(a.id)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WaterCard() {
  return (
    <section class="card">
      <header class="meal-head">
        <h2>{t('water')}</h2>
        <span class="num">{fmt(dayWater.value / 1000, 2)} l</span>
      </header>
      <div class="chips">
        <button class="chip" onClick={() => void addWater(200)}>+{fmt(2)} dl</button>
        <button class="chip" onClick={() => void addWater(500)}>+{fmt(5)} dl</button>
        <button class="chip" disabled={dayWater.value === 0} onClick={() => void addWater(-200)}>
          −{fmt(2)} dl
        </button>
      </div>
    </section>
  );
}

/** Supplements: daily ones as a checklist (one tap logs the daily dose), the rest with "+1". */
function SupplementCard() {
  const list = supplements.value;
  const byRef = new Map<string, Entry[]>();
  for (const e of entries.value) if (supplementRefs.value.has(e.foodRef)) byRef.set(e.foodRef, [...(byRef.get(e.foodRef) ?? []), e]);
  return (
    <section class="card">
      <header class="meal-head">
        <h2>{t('supplements')}</h2>
        <span />
        <button class="btn small" onClick={() => open({ kind: 'supplement' })}>
          + {t('add')}
        </button>
      </header>
      {list.length > 0 && (
        <ul class="entries">
          {list.map((f) => {
            const s = f.supplement!;
            const taken = byRef.get(f.ref) ?? [];
            const qty = taken.reduce((n, e) => n + (e.qty ?? e.grams), 0);
            return (
              <li key={f.ref} class="ingredient">
                {s.perDay > 0 && (
                  <input
                    type="checkbox"
                    class="supp-check"
                    checked={taken.length > 0}
                    aria-label={`${t('supplementTaken')}: ${f.sv}`}
                    onChange={() => void toggleSupplementTaken(f.ref)}
                  />
                )}
                <button class="entry" onClick={() => open({ kind: 'supplement', ref: f.ref })}>
                  <span class="entry-name">{f.sv}</span>
                  {!taken.length && (
                    <span class="num muted">{s.perDay ? `${fmtAmount(s.perDay)} ${unitLabel(s.unit)}/${t('perDayShort')}` : ''}</span>
                  )}
                </button>
                {taken.length > 0 && (
                  <button class="btn small num" onClick={() => open({ kind: 'food', ref: f.ref, entryId: taken[taken.length - 1].id })}>
                    {fmtAmount(qty)} {unitLabel(s.unit)}
                  </button>
                )}
                {s.perDay === 0 && (
                  <button class="btn small" aria-label={`+1 ${unitLabel(s.unit)} ${f.sv}`} onClick={() => void takeSupplement(f.ref, 1)}>
                    +1
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
