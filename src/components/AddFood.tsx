import { useEffect, useRef, useState } from 'preact/hooks';
import { searchFoods } from '../lib/foods';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, value, type Food } from '../lib/nutrients';
import { addEntry, addingTo } from '../state';

const QUICK_GRAMS = [25, 50, 100, 150, 200, 300];

/** Full-screen sheet: search → pick food → choose amount → add. */
export function AddFood() {
  const meal = addingTo.value;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [grams, setGrams] = useState('100');
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

  if (!meal) return null;
  const close = () => (addingTo.value = null);
  const g = parseFloat(grams.replace(',', '.'));

  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={t('addFood')}>
      <header class="sheet-head">
        <button class="btn small" onClick={close}>
          {t('cancel')}
        </button>
        <h2>{t(meal)}</h2>
      </header>

      {!picked ? (
        <>
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
                <button class="result" onClick={() => setPicked(f)}>
                  <span class="entry-name">{foodName(f, lang.value)}</span>
                  <span class="num muted">
                    {fmt(value(f.per100g, 'kcal'))} kcal · P {fmtAmount(value(f.per100g, 'protein'))} · {lang.value === 'sv' ? 'K' : 'C'}{' '}
                    {fmtAmount(value(f.per100g, 'carbs'))} · F {fmtAmount(value(f.per100g, 'fat'))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <form
          class="amount"
          onSubmit={(e) => {
            e.preventDefault();
            if (g > 0) {
              void addEntry(meal, picked, g);
              close();
            }
          }}
        >
          <h3>{foodName(picked, lang.value)}</h3>
          <label>
            {t('amount')}
            <span class="amount-row">
              <input
                type="text"
                inputMode="decimal"
                value={grams}
                onInput={(e) => setGrams((e.currentTarget as HTMLInputElement).value)}
                autoFocus
              />
              g
            </span>
          </label>
          <div class="chips">
            {QUICK_GRAMS.map((q) => (
              <button type="button" class="chip" key={q} onClick={() => setGrams(String(q))}>
                {q} g
              </button>
            ))}
          </div>
          {g > 0 && (
            <p class="num preview">
              {fmt((value(picked.per100g, 'kcal') * g) / 100)} kcal · Protein{' '}
              {fmtAmount((value(picked.per100g, 'protein') * g) / 100)} g
            </p>
          )}
          <div class="actions">
            <button type="button" class="btn" onClick={() => setPicked(null)}>
              ←
            </button>
            <button type="submit" class="btn primary" disabled={!(g > 0)}>
              {t('add')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
