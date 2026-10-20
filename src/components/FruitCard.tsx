import { useEffect, useMemo, useState } from 'preact/hooks';
import { fmt, lang, locale, nutrientName, unitLabel } from '../lib/i18n';
import { ensurePriceBook, priceBook } from '../lib/cost';
import { allYear, defaultGoals, FRUITS, fruitNeeds, inSeason, mainOrigin, REACHES, SEASON_PERIOD, weekPlan, type Fruit, type Reach } from '../lib/fruit';
import { NUTRIENT_INDEX, NUTRIENTS, type Food } from '../lib/nutrients';
import type { Gap } from '../lib/report';
import { tf, type FruitKey } from '../lib/strings-fruit';
import { fmtMonth } from '../lib/typical-prices';
import { mealAt } from '../lib/usual';
import { open } from '../nav';
import { ensureFoods, foods, settings, targets, updateSettings } from '../state';

const REACH_LABEL: Record<Reach, FruitKey> = { sweden: 'reachSweden', europe: 'reachEurope', any: 'reachAny' };
/** The goals chosen first: up to three (see defaultGoals); at most eight offered. */
const DEFAULT_GOALS = 3;
const MAX_GOALS = 8;

const fruitName = (f: Fruit) => (lang.value === 'sv' || lang.value === 'da' ? f.sv : f.en);
const nutrient = (key: string) => nutrientName(NUTRIENTS[NUTRIENT_INDEX[key]]);

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames([locale()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code; // older browsers without Intl.DisplayNames
  }
}

/** "svensk", "mest från Spanien", "längre ifrån" — or "" when there's nothing to say. */
function originText(f: Fruit, month: number): string {
  const o = mainOrigin(f, month);
  return o === 'SE' ? tf('fruitFromSweden') : o ? tf('fruitFrom').replace('{country}', countryName(o)) : tf('fruitFromFar');
}

/**
 * Fruit in season (M40, opt-in): the fruit plentiful this month from the chosen origins, and a week's
 * worth of it, in whole portions, for the gaps the user picks (most important first).
 */
export default function FruitCard({ low, amounts }: { low: Gap[]; amounts: number[] }) {
  const month = new Date().getMonth();
  const reach = settings.value.fruitReach ?? 'europe';
  const season = useMemo(() => FRUITS.filter((f) => inSeason(f, month, reach)), [month, reach]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    setLoaded(false);
    void ensureFoods(season.map((f) => f.food)).then(() => live && setLoaded(true));
    return () => void (live = false);
  }, [season]);
  const costsOn = !!settings.value.costs;
  useEffect(() => void (costsOn && ensurePriceBook()), [costsOn]);

  const list = useMemo(
    () => (loaded ? season.flatMap((fruit) => (foods.value.get(fruit.food) ? [{ fruit, food: foods.value.get(fruit.food) as Food }] : [])) : []),
    [loaded, season, foods.value],
  );
  const needs = useMemo(
    () => fruitNeeds(low, amounts, targets.value, list.map((x) => ({ food: x.food, grams: x.fruit.unit[1] }))).slice(0, MAX_GOALS),
    [low, amounts, targets.value, list],
  );
  // Goals: the user's picks among the current needs; until they pick, the most important ones fruit can close.
  const defaults = useMemo(() => defaultGoals(needs, list, DEFAULT_GOALS).map((n) => n.key), [needs, list]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const chosen = needs.filter((n) => (picked ?? defaults).includes(n.key));
  const toggle = (key: string) => {
    const now = chosen.map((n) => n.key);
    setPicked(now.includes(key) ? now.filter((k) => k !== key) : [...now, key]);
  };
  const plan = useMemo(() => (chosen.length ? weekPlan(chosen, list) : null), [chosen.map((n) => n.key).join(), list]);
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
      {!loaded ? (
        <p class="muted small" role="status">{tf('fruitLoading')}</p>
      ) : !season.length ? (
        <p class="muted small">{tf('fruitNoneInSeason')}</p>
      ) : !needs.length ? (
        <p class="muted small">{tf('fruitNoNeeds')}</p>
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
          {!plan ? (
            <p class="muted small">{tf('fruitNoGoal')}</p>
          ) : (
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
              {chosen.map((n) => (
                <p key={n.key} class="small">
                  {tf('fruitCovers').replace('{name}', nutrient(n.key)).replace('{pct}', fmt(Math.round(plan.covers[n.key] * 100)))}
                </p>
              ))}
              {plan.capped && <p class="muted small">{tf('fruitCapped')}</p>}
              {book && cost && book.shown(cost) && <p class="small">{tf('fruitCost').replace('{kr}', book.text(cost))}</p>}
            </>
          )}
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
