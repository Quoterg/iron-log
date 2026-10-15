import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { searchFoods, unavailableSources } from '../lib/foods';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, value, type Food } from '../lib/nutrients';
import { back, closeAll, open } from '../nav';
import { ensureFoods, favourites, foods, logTemplate, offFoods, recent, supplementRefs, templates, templateUse, updateEntry, usage } from '../state';
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
    foods.value = new Map(foods.value).set(f.ref, f);
    if (pickIngredient) {
      open({ kind: 'food', ref: f.ref, ingredient: true });
    } else if (replaceEntryId) {
      void updateEntry(replaceEntryId, { foodRef: f.ref });
      back();
    } else {
      open({ kind: 'food', ref: f.ref, meal });
    }
  };

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
      {results && results.length === 0 && <p class="muted center">{t('noResults')}</p>}
      {results ? (
        <ul class="results">{results.filter(allowed).map((f) => row(f, pick))}</ul>
      ) : query.trim() ? null : (
        <>
          <SavedMeals list={saved} meal={meal} />
          <QuickList title={t('favourites')} list={favourites.value.filter((u) => !(pickIngredient && u.foodRef.startsWith('recipe:')))} pick={pick} />
          <QuickList title={t('recent')} list={recent.value.filter((u) => !(pickIngredient && u.foodRef.startsWith('recipe:')))} pick={pick} />
          <ScannedList pick={pick} />
          {quick.length === 0 && saved.length === 0 && <p class="muted center small pad">{t('searchHint')}</p>}
        </>
      )}
      {!replaceEntryId && !pickIngredient && (
        <div class="pad">
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

function ScannedList({ pick }: { pick: (f: Food) => void }) {
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
      {shown > 0 && <ul class="results">{sorted.slice(0, shown).map((f) => row(foods.value.get(f.ref) ?? f, pick))}</ul>}
      {shown > 0 && sorted.length > shown && (
        <button class="link" onClick={() => setShown(shown + SCANNED_PAGE)}>
          {t('showMore')}
        </button>
      )}
    </>
  );
}

function QuickList({ title, list, pick }: { title: string; list: Usage[]; pick: (f: Food) => void }) {
  const items = list.map((u) => foods.value.get(u.foodRef)).filter((f): f is Food => !!f);
  if (!items.length) return null;
  return (
    <>
      <h3 class="list-title">{title}</h3>
      <ul class="results">{items.map((f) => row(f, pick))}</ul>
    </>
  );
}

function row(f: Food, pick: (f: Food) => void) {
  return (
    <li key={f.ref}>
      <button class="result" onClick={() => pick(f)}>
        <span class="entry-name">
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
