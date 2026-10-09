import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { searchFoods } from '../lib/foods';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, value, type Food } from '../lib/nutrients';
import { back, open } from '../nav';
import { ensureFoods, favourites, foods, recent, recipeDraft, updateEntry } from '../state';
import type { Usage } from '../lib/db';
import { Sheet } from './Sheet';

/** Search foods to add to a meal, or to swap the food of an existing entry. */
export function FoodSearch(props: { meal: Meal; replaceEntryId?: string; pickIngredient?: boolean }) {
  const { meal, replaceEntryId, pickIngredient } = props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Before typing: favourites and recent foods (resolved from the worker/custom foods).
  const quick = [...favourites.value, ...recent.value];
  useEffect(() => {
    void ensureFoods(quick.map((u) => u.foodRef));
  }, [quick.map((u) => u.foodRef).join()]);

  // Debounce lightly: search is fast, but avoid queueing work on every keypress on slow phones.
  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    let live = true;
    setLoading(true);
    const h = setTimeout(async () => {
      const r = await searchFoods(query, lang.value);
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

  // A recipe can't contain itself.
  const allowed = (f: Food) => !(pickIngredient && f.ref === recipeDraft.value?.ref);

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
      {results && results.length === 0 && <p class="muted center">{t('noResults')}</p>}
      {results ? (
        <ul class="results">{results.filter(allowed).map((f) => row(f, pick))}</ul>
      ) : query.trim() ? null : (
        <>
          <QuickList title={t('favourites')} list={favourites.value} pick={pick} />
          <QuickList title={t('recent')} list={recent.value} pick={pick} />
          {quick.length === 0 && <p class="muted center small pad">{t('searchHint')}</p>}
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
          {f.ref.startsWith('custom:') && <span class="badge">{t('customBadge')}</span>}
          {f.ref.startsWith('off:') && <span class="badge">{t('barcodeBadge')}</span>}
          {f.ref.startsWith('recipe:') && <span class="badge">{t('recipeBadge')}</span>}
        </span>
        <span class="num muted">
          {fmt(value(f.per100g, 'kcal'))} kcal · P {fmtAmount(value(f.per100g, 'protein'))} ·{' '}
          {lang.value === 'sv' ? 'K' : 'C'} {fmtAmount(value(f.per100g, 'carbs'))} · F{' '}
          {fmtAmount(value(f.per100g, 'fat'))}
        </span>
      </button>
    </li>
  );
}
