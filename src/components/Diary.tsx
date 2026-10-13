import { useEffect } from 'preact/hooks';
import { ensurePriceBook, priceBook, type Cost } from '../lib/cost';
import { entryVector, isoDate, MEALS, type Entry } from '../lib/db';
import { activityName, fmt, fmtAmount, lang, nutrientName, t, unitLabel } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS, value } from '../lib/nutrients';
import { energySplit } from '../lib/totals';
import { open } from '../nav';
import {
  activityTypes, addWater, burnedToday, clock, date, dayActivities, dayComplete, dayTotals,
  dayWater, dismissUsual, entries, foods, logUsual, notice, prevEntries, recipes, removeActivity,
  repeatYesterday, settings, supplementRefs, supplements, takeSupplement, targets,
  toggleDayComplete, toggleSupplementTaken, updateSettings, usual, usualState,
} from '../state';
import { scheduledOn, timeRank } from '../lib/supplements';
import { pickUsual } from '../lib/usual';
import { isoWeek, previousWeek } from '../lib/checkin';
import { Bar } from './Bar';

export function Diary() {
  const tot = dayTotals.value;
  const g = (k: string) => tot[NUTRIENT_INDEX[k]];
  const tg = targets.value;
  const split = energySplit(g('protein'), g('carbs'), g('fat'), g('alcohol'));
  // "Your usual": one card at most, on an empty meal of today (lib/usual.ts).
  const now = new Date(clock.value);
  const usualMeal =
    date.value === isoDate(now)
      ? pickUsual(usual.value, (m) => !entries.value.some((e) => e.meal === m && !supplementRefs.value.has(e.foodRef)), usualState.value, date.value, now)
      : null;

  // Food cost (M34, opt-in): the prices load when the app is idle after start (main.tsx), or right
  // away when the setting is turned on (Settings); this is the fallback, e.g. turned on by sync.
  const costsOn = !!settings.value.costs;
  useEffect(() => {
    if (!costsOn) return;
    const id = setTimeout(ensurePriceBook, 4000);
    return () => clearTimeout(id);
  }, [costsOn]);
  const book = costsOn ? priceBook.value : null;
  // Each entry's cost once per render (recipes by ref).
  const costs = new Map<string, Cost | null>();
  if (book) {
    const recipeOf = new Map(recipes.value.filter((r) => !r.deleted).map((r) => [r.ref, r]));
    for (const e of entries.value) costs.set(e.id, book.entryCost(e, recipeOf.get(e.foodRef)));
  }
  const costOf = (e: Entry) => costs.get(e.id) ?? null;
  const dayCost = book ? book.sum(entries.value.filter((e) => !supplementRefs.value.has(e.foodRef)).map(costOf)) : null;

  return (
    <>
      {notice.value && (
        <p class="small warn pad" role="status">
          {notice.value}
        </p>
      )}
      {/* Weekly check-in (opt-in): once per new week, on today's diary, until it has been seen. */}
      {settings.value.checkin && date.value === isoDate(now) && settings.value.checkinSeen !== previousWeek(date.value).key && (
        <section class="card checkin-teaser">
          <span>{t('checkinReady')}</span>
          <button class="btn small" onClick={() => open({ kind: 'checkin' })}>
            {t('checkinShow')}
          </button>
        </section>
      )}
      {/* Follow the estimate (M35): this week's change of the energy target, until dismissed. */}
      {settings.value.followNote && settings.value.followNote.week === isoWeek(isoDate(now)).key && (
        <section class="card checkin-teaser" role="status">
          <span>
            {t('followDone')
              .replace('{kcal}', fmt(settings.value.followNote.to))
              .replace('{delta}', `${settings.value.followNote.to > settings.value.followNote.from ? '+' : '−'}${fmt(Math.abs(settings.value.followNote.to - settings.value.followNote.from))}`)}
          </span>
          <button class="btn small" aria-label={t('notNow')} title={t('notNow')} onClick={() => void updateSettings({ followNote: undefined })}>
            ×
          </button>
        </section>
      )}
      <section class="card summary">
        <Bar label={t('energy')} amount={g('kcal')} unit="kcal" target={tg.kcal} hero />
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
        {dayCost && <p class="muted small day-cost">{t('dayCost').replace('{kr}', book!.text(dayCost))}</p>}
      </section>

      {MEALS.map((meal) => {
        const list = entries.value.filter((e) => e.meal === meal && !supplementRefs.value.has(e.foodRef));
        const kcal = list.reduce((s, e) => s + entryKcal(e), 0);
        const mealCost = book && list.length ? book.sum(list.map(costOf)) : null;
        const u = usual.value[meal];
        const showUsual = usualMeal === meal;
        // Else, an empty meal that was logged the day before: offer it again in one tap.
        const prev = list.length || showUsual ? [] : prevEntries.value.filter((e) => e.meal === meal && !supplementRefs.value.has(e.foodRef));
        return (
          <section class="card meal" key={meal}>
            <header class="meal-head">
              <h2>{t(meal)}</h2>
              <span class="num muted">
                {list.length ? `${fmt(kcal)} kcal` : ''}
                {mealCost && ` · ${book!.text(mealCost)}`}
              </span>
              <button class="btn small" onClick={() => open({ kind: 'search', meal })}>
                + {t('addFood')}
              </button>
            </header>
            {showUsual && (
              <div class="usual">
                <button class="usual-log" onClick={() => void logUsual(meal)}>
                  <span class="entry-name">
                    {t('usualMeal')}: {u!.items.map((i) => name(i.foodRef)).join(', ')}
                  </span>
                  <span class="num">{fmt(u!.kcal)} kcal</span>
                </button>
                <button class="btn small" aria-label={t('notNow')} title={t('notNow')} onClick={() => dismissUsual(meal)}>
                  ×
                </button>
              </div>
            )}
            {list.length > 0 && (
              <>
              <ul class="entries">
                {list.map((e) => {
                  const cost = book?.shown(costOf(e)) ? costOf(e) : null;
                  return (
                    <li key={e.id} class={cost ? 'priced' : undefined}>
                      <button class="entry" onClick={() => open({ kind: 'food', ref: e.foodRef, entryId: e.id })}>
                        <span class="entry-name">{name(e.foodRef)}</span>
                        <span class="num muted">
                          {e.unit && e.qty ? `${fmtAmount(e.qty)} ${unitLabel(e.unit)}` : `${fmtAmount(e.grams)} g`}
                        </span>
                        <span class="num">{fmt(entryKcal(e))} kcal</span>
                      </button>
                      {/* A food's cost opens its price (the shopping list's editor); a recipe's is its ingredients'. */}
                      {cost &&
                        (e.foodRef.startsWith('recipe:') ? (
                          <span class="num muted cost">{book!.text(cost)}</span>
                        ) : (
                          <button class="btn small cost" aria-label={`${t('costEdit').replace('{name}', name(e.foodRef))}, ${book!.text(cost)}`} onClick={() => open({ kind: 'price', ref: e.foodRef })}>
                            {book!.text(cost)}
                          </button>
                        ))}
                    </li>
                  );
                })}
              </ul>
              <div class="links">
                <button class="link" onClick={() => open({ kind: 'copy', meal })}>
                  {t('copyMeal')}
                </button>
                <button class="link" onClick={() => open({ kind: 'template', meal })}>
                  {t('saveAsMeal')}
                </button>
              </div>
              </>
            )}
            {prev.length > 0 && (
              <button class="link" onClick={() => void repeatYesterday(meal)}>
                ↻ {t('sameAsYesterday')} · {fmt(prev.reduce((s, e) => s + entryKcal(e), 0))} kcal
              </button>
            )}
          </section>
        );
      })}
      <SupplementCard />
      <ActivityCard />
      <WaterCard />
      {settings.value.adaptive && entries.value.length > 0 && (
        <button class={dayComplete.value ? 'btn wide day-done on' : 'btn wide day-done'} aria-pressed={dayComplete.value} onClick={() => void toggleDayComplete()}>
          {dayComplete.value ? '✓ ' : ''}
          {t('dayComplete')}
        </button>
      )}
      {entries.value.length === 0 ? (
        <p class="muted center">{t('emptyDay')}</p>
      ) : (
        <button class="btn wide" onClick={() => open({ kind: 'copy' })}>
          {t('copyDay')}
        </button>
      )}
      <button class="btn wide" onClick={() => open({ kind: 'shopping' })}>
        {t('shoppingList')}
      </button>
    </>
  );
}

function name(ref: string): string {
  const f = foods.value.get(ref);
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
  const byRef = new Map<string, Entry[]>();
  for (const e of entries.value) if (supplementRefs.value.has(e.foodRef)) byRef.set(e.foodRef, [...(byRef.get(e.foodRef) ?? []), e]);
  // This day's checklist: daily ones scheduled for this weekday, as-needed ones, and anything taken.
  const list = supplements.value
    .filter((f) => f.supplement!.perDay === 0 || scheduledOn(f.supplement!, date.value) || byRef.has(f.ref))
    .sort((a, b) => timeRank(a.supplement!) - timeRank(b.supplement!));
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
                  <span class="entry-name">
                    {f.sv}
                    {s.time && <span class="muted small"> · {t(`time_${s.time}`)}</span>}
                  </span>
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
