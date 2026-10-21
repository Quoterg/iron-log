import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmt, lang, locale, nutrientName, unitLabel } from '../lib/i18n';
import { ensurePriceBook, priceBook } from '../lib/cost';
import { allYear, FRUITS, fruitNeeds, fruitSpan, goalGaps, inSeason, LITTLE, mainOrigin, monthRuns, REACHES, SEASON_PERIOD, sourceSeason, sourcesOf, weekPlan, widerSource, type Fruit, type Reach } from '../lib/fruit';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from '../lib/nutrients';
import type { Gap } from '../lib/report';
import { tf, type FruitKey } from '../lib/strings-fruit';
import { fmtMonth } from '../lib/typical-prices';
import { mealAt } from '../lib/usual';
import { open } from '../nav';
import { ensureFoods, foods, settings, targets, updateSettings } from '../state';

const REACH_LABEL: Record<Reach, FruitKey> = { sweden: 'reachSweden', europe: 'reachEurope', any: 'reachAny' };

const fruitName = (f: Fruit) => (lang.value === 'sv' || lang.value === 'da' ? f.sv : f.en);
const nutrient = (key: string) => nutrientName(NUTRIENTS[NUTRIENT_INDEX[key]]);

const regionNames = new Map<string, Intl.DisplayNames | null>();
function countryName(code: string): string {
  const l = locale();
  if (!regionNames.has(l)) {
    try {
      regionNames.set(l, new Intl.DisplayNames([l], { type: 'region' }));
    } catch {
      regionNames.set(l, null); // older browsers without Intl.DisplayNames
    }
  }
  return regionNames.get(l)?.of(code) ?? code;
}

/** "svensk", "mest från Spanien", "längre ifrån" — or "" when there's nothing to say. */
function originText(f: Fruit, month: number): string {
  const o = mainOrigin(f, month);
  return o === 'SE' ? tf('fruitFromSweden') : o ? tf('fruitFrom').replace('{country}', countryName(o)) : tf('fruitFromFar');
}

type WithFood = { fruit: Fruit; food: Food };

/** "maj–juli", "november–februari, juni" in the app's language. */
function monthsText(months: number[]): string {
  const f = new Intl.DateTimeFormat(locale(), { month: 'long' });
  const name = (m: number) => f.format(new Date(2026, m, 15));
  return monthRuns(months).map(([a, b]) => (a === b ? name(a) : `${name(a)}–${name(b)}`)).join(', ');
}

/**
 * Fruit in season (M40, opt-in): the fruit plentiful this month from the chosen origins, and what to buy
 * for a week — in whole portions — to cover as broadly as possible every vitamin and mineral fruit can
 * give that the user is below target in (owner, M40b). Any of them can be left out.
 */
export default function FruitCard({ low, amounts }: { low: Gap[]; amounts: number[] }) {
  const month = new Date().getMonth();
  const reach = settings.value.fruitReach ?? 'europe';
  const season = useMemo(() => FRUITS.filter((f) => inSeason(f, month, reach)), [month, reach]);
  // Every fruit's food (23 small rows), so a wider choice of origin can be checked too.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    void ensureFoods(FRUITS.map((f) => f.food)).then(() => live && setLoaded(true));
    return () => void (live = false);
  }, []);
  const costsOn = !!settings.value.costs;
  useEffect(() => void (costsOn && ensurePriceBook()), [costsOn]);

  const withFood = (fruits: Fruit[]): WithFood[] =>
    loaded ? fruits.flatMap((fruit) => (foods.value.get(fruit.food) ? [{ fruit, food: foods.value.get(fruit.food) as Food }] : [])) : [];
  const all = useMemo(() => withFood(FRUITS), [loaded, foods.value]);
  // What fruit is a source of at all (EU rule, over every fruit): the only nutrients it is suggested for.
  const span = useMemo(() => fruitSpan(all.map((x) => x.food)), [all]);
  const list = useMemo(() => withFood(season), [loaded, season, foods.value]);
  // Every nutrient fruit can give that is below target, most important first; all included unless left out.
  const needs = useMemo(() => fruitNeeds(low, amounts, targets.value, span), [low, amounts, targets.value, span]);
  const [left, setLeft] = useState<string[]>([]);
  const chosen = needs.filter((n) => !left.includes(n.key));
  const toggle = (key: string) => setLeft(left.includes(key) ? left.filter((k) => k !== key) : [...left, key]);
  // The shopping list is driven by the goals some fruit in season from here is a source of (no buying
  // fruit for crumbs); every fruit counts for all it gives among them. The others say where or when.
  const unsourced = (key: string) => !sourcesOf(key, list).length;
  const planned = chosen.filter((n) => !unsourced(n.key));
  const plan = useMemo(() => (planned.length ? weekPlan(planned, list) : null), [planned.map((n) => n.key).join(), list]);
  /** A goal no fruit in season from here is a source of: a wider choice that has one now, or when one is. */
  const noSourceText = (key: string) => {
    const names = (l: WithFood[]) => l.map((x) => fruitName(x.fruit)).join(', ');
    const w = widerSource(reach, key, (r) => withFood(FRUITS.filter((f) => inSeason(f, month, r))));
    if (w) return tf('fruitNoSourceWider').replace('{name}', nutrient(key)).replace('{reach}', tf(REACH_LABEL[w.reach])).replace('{fruits}', names(w.fruits));
    const later = sourceSeason(key, all, reach);
    return later
      ? tf('fruitNoSourceLater').replace('{name}', nutrient(key)).replace('{fruits}', names(later.fruits)).replace('{months}', monthsText(later.months))
      : tf('fruitNoSource').replace('{name}', nutrient(key));
  };
  const gaps = goalGaps(low, targets.value);
  const book = costsOn ? priceBook.value : null;
  const cost = book && plan?.items.length ? book.sum(plan.items.map((i) => book.entryCost({ foodRef: i.fruit.food, grams: i.grams }))) : null;
  const others = season.filter((f) => !plan?.items.some((i) => i.fruit.key === f.key));
  const monthName = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(new Date());
  const [from, to] = SEASON_PERIOD.split('–');

  return (
    <section class="card suggest fruit">
      <h2>{tf('fruitTitle')}</h2>
      <div class="chips" role="group" aria-label={tf('fruitReach')}>
        {REACHES.map((r) => (
          <button key={r} class={reach === r ? 'chip on' : 'chip'} aria-pressed={reach === r} onClick={() => void updateSettings({ fruitReach: r })}>
            {tf(REACH_LABEL[r])}
          </button>
        ))}
      </div>
      {loaded && span.length > 0 && <p class="muted small">{tf('fruitSpan').replace('{list}', span.map(nutrient).join(', '))}</p>}
      {!loaded ? (
        <p class="muted small" role="status">{tf('fruitLoading')}</p>
      ) : !needs.length ? (
        <p class="muted small">{gaps.length ? tf('fruitNoNeeds').replace('{list}', gaps.map((g) => nutrient(g.key)).join(', ')) : tf('fruitNoGaps')}</p>
      ) : !season.length ? (
        <p class="muted small">{tf('fruitNoneInSeason')}</p>
      ) : (
        <>
          <p class="small suggest-sub">{tf('fruitGoals')}</p>
          <div class="chips" aria-label={tf('fruitGoals')}>
            {needs.map((n) => {
              const on = chosen.some((c) => c.key === n.key);
              return (
                <button key={n.key} class={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => toggle(n.key)}>
                  {nutrient(n.key)}
                </button>
              );
            })}
          </div>
          {!chosen.length && <p class="muted small">{tf('fruitNoGoal')}</p>}
          {plan && plan.items.length > 0 && (
            <>
              <p class="small">{tf('fruitWeek').replace('{month}', monthName)}</p>
              <ul class="entries">
                {plan.items.map((i) => (
                  <li key={i.fruit.key}>
                    <button class="result" onClick={() => open({ kind: 'food', ref: i.fruit.food, meal: mealAt(new Date()) })}>
                      <span class="entry-name">{fruitName(i.fruit)}</span>
                      <span class="muted">
                        {tf('fruitAmount').replace('{count}', fmt(i.count)).replace('{unit}', unitLabel(i.fruit.unit[0])).replace('{grams}', fmt(i.grams))}
                        {' · '}
                        {originText(i.fruit, month)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {book && cost && book.shown(cost) && <p class="small">{tf('fruitCost').replace('{kr}', book.text(cost))}</p>}
              <h3 class="suggest-sub">{tf('fruitCoverage')}</h3>
            </>
          )}
          {chosen.map((n) =>
            unsourced(n.key) ? (
              <p key={n.key} class="muted small">{noSourceText(n.key)}</p>
            ) : plan ? (
              <p key={n.key} class="small">
                {tf(plan.covers[n.key] < LITTLE ? 'fruitCoversLittle' : 'fruitCovers').replace('{name}', nutrient(n.key)).replace('{pct}', fmt(Math.round(plan.covers[n.key] * 100)))}
              </p>
            ) : null,
          )}
          {plan?.capped && <p class="muted small">{tf('fruitCapped')}</p>}
        </>
      )}
      {loaded && others.length > 0 && (
        <p class="muted small">
          {tf('fruitAlso').replace(
            '{list}',
            others.map((f) => (allYear(f, reach) ? fruitName(f) : `${fruitName(f)} (${originText(f, month)})`)).join(', '),
          )}
        </p>
      )}
      <p class="muted small">{tf('fruitSource').replace('{period}', `${fmtMonth(from)}–${fmtMonth(to)}`)}</p>
    </section>
  );
}
