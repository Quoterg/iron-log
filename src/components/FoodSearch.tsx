import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { searchFoods, unavailableSources } from '../lib/foods';
import { fmt, fmtAmount, lang, t, unitLabel } from '../lib/i18n';
import { foodName, value, type Food } from '../lib/nutrients';
import { back, closeAll, open, replaceTop } from '../nav';
import { addEntries, ensureFoods, favourites, foods, logTemplate, offFoods, recent, supplementRefs, templates, templateUse, updateEntry, usage, userServings, type Amount } from '../state';
import { GRAMS, initialAmount, servingsFor, toGrams } from '../lib/servings';
import { sortTemplates, type MealTemplate } from '../lib/templates';
import type { Usage } from '../lib/db';
import { Sheet } from './Sheet';

/** Search foods to add to a meal, or to swap the food of an existing entry. */
export default function FoodSearch(props: { meal: Meal; replaceEntryId?: string; pickIngredient?: boolean }) {
  const { meal, replaceEntryId, pickIngredient } = props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // "Välj flera" (M48): tapping a row picks it at its usual amount; one button logs them all.
  const [multi, setMulti] = useState(false);
  const [picked, setPicked] = useState<Map<string, { food: Food; amount: Amount }>>(new Map());
  const busy = useRef(false);

  useEffect(() => inputRef.current?.focus(), []);

  // Before typing: saved meals, favourites and recent foods (resolved from the worker/custom foods).
  const quick = [...favourites.value, ...recent.value];
  const saved = useMemo(
    () => (replaceEntryId || pickIngredient ? [] : sortTemplates(templates.value, templateUse.value, lang.value)),
    [templates.value, templateUse.value, lang.value],
  );
  // Saved meals show only before typing: resolve their foods only then.
  const refs = [...quick.map((u) => u.foodRef), ...(query.trim() ? [] : saved.flatMap((m) => m.items.map((i) => i.foodRef)))];
  useEffect(() => {
    void ensureFoods(refs);
  }, [refs.join()]);

  // Debounce lightly: search is fast, but avoid queueing work on every keypress on slow phones.
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    let live = true;
    setLoading(true);
    const h = setTimeout(async () => {
      // Ingredients can't be recipes (avoids stale nested recipes and cycles).
      const r = await searchFoods(query, lang.value, pickIngredient ? 'recipe:' : undefined);
      if (live) {
        setResults(r);
        setLoading(false);
      }
    }, 80);
    return () => {
      live = false;
      clearTimeout(h);
    };
  }, [query]);

  // Ingredients can't be recipes (the worker already excludes them; quick lists are filtered here).
  const allowed = (f: Food) => !(pickIngredient && f.ref.startsWith('recipe:'));

  const pick = (f: Food) => {
    // Copying the whole map re-runs everything that reads it: only when the food is new (M54).
    if (foods.value.get(f.ref) !== f) foods.value = new Map(foods.value).set(f.ref, f);
    if (multi) {
      const next = new Map(picked);
      if (next.has(f.ref)) next.delete(f.ref);
      else next.set(f.ref, { food: f, amount: usualAmountOf(f) });
      setPicked(next);
    } else if (pickIngredient) {
      open({ kind: 'food', ref: f.ref, ingredient: true });
    } else if (replaceEntryId) {
      void updateEntry(replaceEntryId, { foodRef: f.ref });
      back();
    } else {
      open({ kind: 'food', ref: f.ref, meal });
    }
  };

  const sel: Sel = (ref) => (multi ? picked.has(ref) : undefined);
  const pickedKcal = [...picked.values()].reduce((s, p) => s + (value(p.food.per100g, 'kcal') * p.amount.grams) / 100, 0);

  return (
    <Sheet title={pickIngredient ? t('addIngredient') : replaceEntryId ? t('changeFood') : t(meal)}>
      {!replaceEntryId && !pickIngredient && (
        <div class="pad scan-row">
          <button class="btn wide" onClick={() => open({ kind: 'scan', meal })}>
            ▥ {t('scanBarcode')}
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        class="search"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder={t('searchPlaceholder')}
        value={query}
        onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
      />
      {loading && !results && <p class="muted center">{t('loadingFoods')}</p>}
      {results && unavailableSources.value.length > 0 && (
        <p class="small warn pad" role="status">
          {t('sourcesUnavailable').replace('{list}', unavailableSources.value.map((s) => (s === 'usda' ? 'USDA' : 'Livsmedelsverket')).join(', '))}
        </p>
      )}
      {!replaceEntryId && !pickIngredient && (
        <div class="pad multi-row">
          <button class={multi ? 'chip on' : 'chip'} aria-pressed={multi} onClick={() => (setMulti(!multi), setPicked(new Map()))}>
            {t('pickSeveral')}
          </button>
          {multi && <span class="muted small">{t('pickSeveralNote')}</span>}
        </div>
      )}
      {results && results.length === 0 && <p class="muted center">{t('noResults')}</p>}
      {results ? (
        <ul class="results">{results.filter(allowed).map((f) => row(f, pick, sel))}</ul>
      ) : query.trim() ? null : (
        <>
          {!multi && <SavedMeals list={saved} meal={meal} />}
          <QuickList title={t('favourites')} list={favourites.value.filter((u) => !(pickIngredient && u.foodRef.startsWith('recipe:')))} pick={pick} sel={sel} />
          <QuickList title={t('recent')} list={recent.value.filter((u) => !(pickIngredient && u.foodRef.startsWith('recipe:')))} pick={pick} sel={sel} />
          <ScannedList pick={pick} sel={sel} />
          {quick.length === 0 && saved.length === 0 && <p class="muted center small pad">{t('searchHint')}</p>}
        </>
      )}
      {multi && picked.size > 0 && (
        <div class="multi-bar">
          <button
            class="btn primary wide"
            onClick={async () => {
              if (busy.current) return;
              busy.current = true;
              try {
                await addEntries(meal, [...picked.values()]);
                closeAll();
              } finally {
                busy.current = false; // a failed write (e.g. storage full) must not leave the button dead
              }
            }}
          >
            {t('addPicked').replace('{n}', String(picked.size)).replace('{kcal}', fmt(pickedKcal))}
          </button>
        </div>
      )}
      {!multi && !replaceEntryId && !pickIngredient && (
        <div class="pad">
          {/* Eating out (M47): energy and macros without a food; replaces the search, so saving returns to the diary. */}
          <button class="btn wide" onClick={() => replaceTop({ kind: 'quick', meal, name: query.trim() })}>
            + {t('quickAdd')}
          </button>
          <button class="btn wide" onClick={() => open({ kind: 'editFood', name: query.trim(), meal })}>
            + {t('createFood')}
          </button>
          <button class="btn wide" onClick={() => open({ kind: 'recipe', meal })}>
            + {t('createRecipe')}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Saved meals: one tap logs all their foods into the meal. */
function SavedMeals({ list, meal }: { list: MealTemplate[]; meal: Meal }) {
  // Synchronous guard: a double tap on a slow phone must not log the meal twice.
  const busy = useRef(false);
  const [parts, setParts] = useState<{ id: string; off: Set<number> } | null>(null);
  const kcal = useMemo(() => {
    const out = new Map<string, number>();
    for (const m of list) {
      out.set(m.id, m.items.reduce((s, i) => {
        const f = foods.value.get(i.foodRef);
        return s + (f ? (value(f.per100g, 'kcal') * i.grams) / 100 : 0);
      }, 0));
    }
    return out;
  }, [list, foods.value]);
  if (!list.length) return null;
  return (
    <>
      <h3 class="list-title">{t('savedMeals')}</h3>
      <ul class="results">
        {list.map((m) => (
          <li key={m.id}>
            <button
              class="result"
              onClick={async () => {
                if (busy.current) return;
                busy.current = true;
                if (await logTemplate(meal, m)) closeAll();
                else busy.current = false;
              }}
            >
              <span class="entry-name">{m.name}</span>
              <span class="num muted">
                {t('foodsCount').replace('{n}', String(m.items.length))} · {fmt(kcal.get(m.id) ?? 0)} kcal
              </span>
            </button>
            {m.items.length > 1 && (
              <button
                class="link small"
                aria-expanded={parts?.id === m.id}
                onClick={() => setParts(parts?.id === m.id ? null : { id: m.id, off: new Set() })}
              >
                {t('pickParts')}
              </button>
            )}
            {/* Some of a saved meal (M50): all ticked, untick what isn't eaten this time. */}
            {parts?.id === m.id && (
              <div class="parts">
                {m.items.map((i, n) => {
                  const f = foods.value.get(i.foodRef);
                  return (
                    <label class="check" key={n}>
                      <input
                        type="checkbox"
                        checked={!parts.off.has(n)}
                        onChange={() => {
                          const off = new Set(parts.off);
                          if (!off.delete(n)) off.add(n);
                          setParts({ id: m.id, off });
                        }}
                      />
                      <span>
                        {f ? foodName(f, lang.value) : '…'}{' '}
                        <span class="muted small">{i.unit && i.qty ? `${fmtAmount(i.qty)} ${unitLabel(i.unit)}` : `${fmtAmount(i.grams)} g`}</span>
                      </span>
                    </label>
                  );
                })}
                <button
                  class="btn primary"
                  disabled={parts.off.size === m.items.length}
                  onClick={async () => {
                    if (busy.current) return;
                    busy.current = true;
                    const items = m.items.filter((_, n) => !parts.off.has(n));
                    if (await logTemplate(meal, { ...m, items })) closeAll();
                    else busy.current = false;
                  }}
                >
                  {t('addParts').replace('{n}', String(m.items.length - parts.off.size)).replace('{m}', String(m.items.length))}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Every scanned product (M36), most recently used first: found again without typing its name, even
 * long after it dropped out of "Senaste". Collapsed until asked for.
 */
const SCANNED_PAGE = 30;

function ScannedList({ pick, sel }: { pick: (f: Food) => void; sel: Sel }) {
  const [shown, setShown] = useState(0); // rows shown; 0 = collapsed
  const list = offFoods.value;
  const sorted = useMemo(() => {
    if (!shown) return [];
    const used = new Map(list.map((f) => [f.ref, usage.value.get(f.ref)?.lastUsed ?? 0]));
    return [...list].sort((a, b) => used.get(b.ref)! - used.get(a.ref)! || b.fetchedAt - a.fetchedAt);
  }, [list, usage.value, shown > 0]);
  if (!list.length) return null;
  return (
    <>
      <button class="link list-title" aria-expanded={shown > 0} onClick={() => setShown(shown ? 0 : SCANNED_PAGE)}>
        {shown ? '▾' : '▸'} {t('scannedFoods').replace('{n}', String(list.length))}
      </button>
      {shown > 0 && <ul class="results">{sorted.slice(0, shown).map((f) => row(foods.value.get(f.ref) ?? f, pick, sel))}</ul>}
      {shown > 0 && sorted.length > shown && (
        <button class="link" onClick={() => setShown(shown + SCANNED_PAGE)}>
          {t('showMore')}
        </button>
      )}
    </>
  );
}

/** In "Välj flera": whether a row is picked (undefined outside it). */
type Sel = (ref: string) => boolean | undefined;

/** The amount the food screen would open with: the usual one, else 1 of its first measure, else 100 g. */
function usualAmountOf(f: Food): Amount {
  const servings = servingsFor(f, userServings.value.get(f.ref));
  const a = initialAmount(servings, undefined, usage.value.get(f.ref));
  const grams = toGrams(a.unit, a.qty, servings);
  return a.unit === GRAMS || !(grams > 0) ? { grams: grams > 0 ? grams : 100 } : { grams, unit: a.unit, qty: a.qty };
}

function QuickList({ title, list, pick, sel }: { title: string; list: Usage[]; pick: (f: Food) => void; sel: Sel }) {
  const items = list.map((u) => foods.value.get(u.foodRef)).filter((f): f is Food => !!f);
  if (!items.length) return null;
  return (
    <>
      <h3 class="list-title">{title}</h3>
      <ul class="results">{items.map((f) => row(f, pick, sel))}</ul>
    </>
  );
}

function row(f: Food, pick: (f: Food) => void, sel: Sel) {
  const on = sel(f.ref);
  return (
    <li key={f.ref}>
      <button class={on ? 'result on' : 'result'} aria-pressed={on} onClick={() => pick(f)}>
        <span class="entry-name">
          {on && '✓ '}
          {foodName(f, lang.value)}
          {f.ref.startsWith('custom:') && (
            <span class="badge">{supplementRefs.value.has(f.ref) ? t('supplementBadge') : t('customBadge')}</span>
          )}
          {f.ref.startsWith('off:') && <span class="badge">{t('barcodeBadge')}</span>}
          {f.ref.startsWith('recipe:') && <span class="badge">{t('recipeBadge')}</span>}
          {f.ref.startsWith('usda:') && <span class="badge">USDA</span>}
        </span>
        <span class="num muted">
          {fmt(value(f.per100g, 'kcal'))} kcal · P {fmtAmount(value(f.per100g, 'protein'))} ·{' '}
          {t('carbsAbbr')} {fmtAmount(value(f.per100g, 'carbs'))} · F{' '}
          {fmtAmount(value(f.per100g, 'fat'))}
        </span>
      </button>
    </li>
  );
}
