import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { searchFoods } from '../lib/foods';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, value, type Food } from '../lib/nutrients';
import { back, open } from '../nav';
import { foods, updateEntry } from '../state';
import { Sheet } from './Sheet';

/** Search foods to add to a meal, or to swap the food of an existing entry. */
export function FoodSearch({ meal, replaceEntryId }: { meal: Meal; replaceEntryId?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

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

  const pick = (f: Food) => {
    foods.value = new Map(foods.value).set(f.ref, f);
    if (replaceEntryId) {
      void updateEntry(replaceEntryId, { foodRef: f.ref });
      back();
    } else {
      open({ kind: 'food', ref: f.ref, meal });
    }
  };

  return (
    <Sheet title={replaceEntryId ? t('changeFood') : t(meal)}>
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
      <ul class="results">
        {results?.map((f) => (
          <li key={f.ref}>
            <button class="result" onClick={() => pick(f)}>
              <span class="entry-name">
                {foodName(f, lang.value)}
                {f.ref.startsWith('custom:') && <span class="badge">{t('customBadge')}</span>}
              </span>
              <span class="num muted">
                {fmt(value(f.per100g, 'kcal'))} kcal · P {fmtAmount(value(f.per100g, 'protein'))} ·{' '}
                {lang.value === 'sv' ? 'K' : 'C'} {fmtAmount(value(f.per100g, 'carbs'))} · F{' '}
                {fmtAmount(value(f.per100g, 'fat'))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!replaceEntryId && (
        <div class="pad">
          <button class="btn wide" onClick={() => open({ kind: 'editFood', name: query.trim(), meal })}>
            + {t('createFood')}
          </button>
        </div>
      )}
    </Sheet>
  );
}
