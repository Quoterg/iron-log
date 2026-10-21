import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmt, lang, locale, nutrientName, unitLabel } from '../lib/i18n';
import { ensurePriceBook, priceBook } from '../lib/cost';
import { allYear, FRUITS, fruitNeeds, fruitSpan, goalGaps, inSeason, mainOrigin, monthRuns, SEASON_PERIOD, sourceSeason, sourcesOf, weekPlan, widerSource, type Fruit, type Reach } from '../lib/fruit';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from '../lib/nutrients';
import type { Gap } from '../lib/report';
import { tf, type FruitKey } from '../lib/strings-fruit';
import { fmtMonth } from '../lib/typical-prices';
import { mealAt } from '../lib/usual';
import { open } from '../nav';
import { ensureFoods, foods, settings, targets } from '../state';

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
export default function FruitCard({ low, amounts, covered }: { low: Gap[]; amounts: number[]; covered?: boolean[] }) {
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
  /**
   * The goals no fruit in season from here is a source of, in one line: grouped by the wider choice that
   * has one now ("Kalium, Vitamin E – från ”Hela världen”: Banan, Avokado"), else when ("Vitamin A –
   * Aprikos maj–juli").
   */
  const notNow = useMemo(() => {
    const names = (l: WithFood[]) => l.map((x) => fruitName(x.fruit)).join(', ');
    const wider = new Map<string, string[]>();
    const later: string[] = [];
    for (const n of needs.filter((x) => unsourced(x.key))) {
      const w = widerSource(reach, n.key, (r) => withFood(FRUITS.filter((f) => inSeason(f, month, r))));
      if (w) {
        const k = tf('fruitNotNowWider').replace('{reach}', tf(REACH_LABEL[w.reach])).replace('{fruits}', names(w.fruits));
        wider.set(k, [...(wider.get(k) ?? []), nutrient(n.key)]);
        continue;
      }
      const s = sourceSeason(n.key, all, reach);
      later.push(s ? tf('fruitNotNowLater').replace('{name}', nutrient(n.key)).replace('{fruits}', names(s.fruits)).replace('{months}', monthsText(s.months)) : nutrient(n.key));
    }
    return [...[...wider].map(([k, ns]) => k.replace('{names}', ns.join(', '))), ...later];
  }, [needs, list, all, reach, month]);
  const sourced = needs.filter((n) => !unsourced(n.key));
  // Goals whose total is partly missing data (< 80 % of the energy from foods reporting them).
  const uncertain = needs.filter((n) => covered?.[NUTRIENT_INDEX[n.key]] === false);
  const gaps = goalGaps(low, targets.value);
  const book = costsOn ? priceBook.value : null;
  const cost = book && plan?.items.length ? book.sum(plan.items.map((i) => book.entryCost({ foodRef: i.fruit.food, grams: i.grams }))) : null;
  const others = season.filter((f) => !plan?.items.some((i) => i.fruit.key === f.key));
  const monthName = new Intl.DateTimeFormat(locale(), { month: 'long' }).format(new Date());
  const [from, to] = SEASON_PERIOD.split('–');

  return (
    <section class="card suggest fruit">
      <h2>{tf('fruitTitle')}</h2>
      {!loaded ? (
        <p class="muted small" role="status">{tf('fruitLoading')}</p>
      ) : !needs.length ? (
        <p class="muted small">{gaps.length ? tf('fruitNoNeeds').replace('{list}', gaps.map((g) => nutrient(g.key)).join(', ')) : tf('fruitNoGaps')}</p>
      ) : (
        <>
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
            </>
          )}
          {sourced.length > 0 && (
            <>
              {/* Goals and what the week covers of each, in one: tap to leave one out (toggles, not a choice of one). */}
              <p class="small suggest-sub">{tf('fruitCoverage')}</p>
              <div class="chips goals">
                {sourced.map((n) => {
                  const on = !left.includes(n.key);
                  return (
                    <button key={n.key} class={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => toggle(n.key)}>
                      {on && plan ? tf('fruitChip').replace('{name}', nutrient(n.key)).replace('{pct}', fmt(Math.round(plan.covers[n.key] * 100))) : nutrient(n.key)}
                    </button>
                  );
                })}
              </div>
              {!planned.length && <p class="muted small">{tf('fruitNoGoal')}</p>}
            </>
          )}
          {plan?.capped && <p class="muted small">{tf('fruitCapped')}</p>}
          {uncertain.length > 0 && <p class="muted small">{tf('fruitUncertain').replace('{list}', uncertain.map((n) => nutrient(n.key)).join(', '))}</p>}
          {notNow.length > 0 && <p class="muted small">{tf('fruitNotNow').replace('{list}', notNow.join('; '))}</p>}
        </>
      )}
      <details>
        <summary class="small">{tf('fruitMore')}</summary>
        {loaded && span.length > 0 && <p class="muted small">{tf('fruitSpan').replace('{list}', span.map(nutrient).join(', '))}</p>}
        {loaded && others.length > 0 && (
          <p class="muted small">
            {tf('fruitAlso').replace(
              '{list}',
              others.map((f) => (allYear(f, reach) ? fruitName(f) : `${fruitName(f)} (${originText(f, month)})`)).join(', '),
            )}
          </p>
        )}
        <p class="muted small">{tf('fruitSource').replace('{period}', `${fmtMonth(from)}–${fmtMonth(to)}`)}</p>
      </details>
    </section>
  );
}
