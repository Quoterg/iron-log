import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { fmt, fmtAmount, inputNum, lang, parseNum, t, unitLabel } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX } from '../lib/nutrients';
import { recipeNutrition } from '../lib/recipes';
import { scale } from '../lib/totals';
import { back, open, replaceTop } from '../nav';
import { deleteRecipe, ensureFoods, foods, recipeDraft, recipes, saveRecipe, type RecipeDraft } from '../state';
import { NutrientGroups } from './NutrientGroups';
import { Sheet } from './Sheet';

const DRAFT_KEY = 'iron-log:recipeDraft';

/** Unsaved drafts survive closing the editor (Back, swipe) for this browser session. */
function loadStashed(key: string): RecipeDraft | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as { key: string; draft: RecipeDraft } | null;
    return s && s.key === key ? s.draft : null;
  } catch {
    return null;
  }
}

function stash(key: string, draft: RecipeDraft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ key, draft }));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // storage unavailable (private mode): drafts just aren't kept
  }
}

/**
 * Create (no ref) or edit a recipe. The draft lives in `recipeDraft` so that adding an
 * ingredient (search → food screen in ingredient mode) can append to it and come back here.
 */
export default function RecipeEditor({ recipeRef, meal }: { recipeRef?: string; meal?: Meal }) {
  const existing = recipeRef ? recipes.value.find((r) => r.ref === recipeRef) : undefined;
  const key = recipeRef ?? 'new';
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [servingsError, setServingsError] = useState(false);
  const [stashed, setStashed] = useState<RecipeDraft | null>(null);
  const initial = useRef('');
  const saved = useRef(false);

  // A fresh draft when the editor opens. On close, an unsaved, changed draft is stashed for the
  // session and offered next time (the editor stays mounted under the ingredient sheets).
  useEffect(() => {
    const fresh: RecipeDraft = existing
      ? { ref: existing.ref, name: existing.name, ingredients: existing.ingredients, servings: existing.servings, cookedWeightG: existing.cookedWeightG }
      : { name: '', ingredients: [], servings: 1 };
    recipeDraft.value = fresh;
    initial.current = JSON.stringify(fresh);
    setStashed(loadStashed(key));
    return () => {
      const d = recipeDraft.value;
      if (!saved.current && d && JSON.stringify(d) !== initial.current) stash(key, d);
      recipeDraft.value = null;
    };
  }, [recipeRef]);

  const d = recipeDraft.value;
  // Resolve ingredient foods (the food database may still be loading).
  const refsKey = d?.ingredients.map((i) => i.foodRef).join() ?? '';
  useEffect(() => {
    if (d) void ensureFoods(d.ingredients.map((i) => i.foodRef));
  }, [refsKey]);

  // Recomputed only when the recipe's contents change — not on every keystroke in the name field.
  const n = useMemo(
    () => (d ? recipeNutrition(d, foods.value) : null),
    [d?.ingredients, d?.servings, d?.cookedWeightG, foods.value],
  );
  const perPortion = useMemo(() => (n ? scale(n.per100g, n.portionG) : []), [n]);
  const groups = useMemo(
    () => (n ? <NutrientGroups amounts={perPortion} known={n.per100g.map((v) => v != null)} /> : null),
    [perPortion],
  );
  if (!d || !n) return null;

  const set = (patch: Partial<RecipeDraft>) => (recipeDraft.value = { ...d, ...patch });
  const nameMissing = !d.name.trim();
  const noIngredients = d.ingredients.length === 0;
  const missing = n.missing.length > 0;

  const save = async () => {
    setSubmitted(true);
    if (nameMissing || noIngredients || missing || busy) return;
    setBusy(true);
    const ref = await saveRecipe(d);
    saved.current = true;
    stash(key, null);
    // From a meal's search: continue to logging it.
    if (!existing && meal) replaceTop({ kind: 'food', ref, meal });
    else back();
  };

  return (
    <Sheet title={existing ? t('editRecipe') : t('createRecipe')}>
      <div class="pad form">
        {stashed && (
          <div class="notice" role="status">
            <p class="small">{t('draftFound')}</p>
            <button
              type="button"
              class="btn small"
              onClick={() => {
                recipeDraft.value = stashed;
                setStashed(null);
                stash(key, null);
              }}
            >
              {t('restore')}
            </button>
            <button
              type="button"
              class="btn small"
              onClick={() => {
                setStashed(null);
                stash(key, null);
              }}
            >
              {t('discard')}
            </button>
          </div>
        )}
        <label class={submitted && nameMissing ? 'field error' : 'field'}>
          <span>{t('name')}</span>
          <input
            type="text"
            value={d.name}
            maxLength={120}
            onInput={(e) => set({ name: (e.currentTarget as HTMLInputElement).value })}
          />
        </label>
        {submitted && nameMissing && <p class="error-text">{t('nameRequired')}</p>}
        <label>
          {t('servings')}
          <input
            type="text"
            inputMode="decimal"
            value={inputNum(d.servings)}
            aria-invalid={servingsError}
            onChange={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              const v = parseNum(el.value);
              const ok = v >= 0.5 && v <= 1000;
              setServingsError(!ok);
              if (ok) set({ servings: Math.round(v * 10) / 10 });
              else el.value = inputNum(d.servings);
            }}
          />
        </label>
        {servingsError && <p class="error-text">{t('servingsInvalid')}</p>}

        <h3>{t('ingredients')}</h3>
        {noIngredients && <p class={submitted ? 'error-text' : 'muted small'}>{t('noIngredients')}</p>}
        <ul class="entries">
          {d.ingredients.map((ing, i) => {
            const f = foods.value.get(ing.foodRef);
            return (
              <li key={`${ing.foodRef}-${i}`} class="ingredient">
                <button
                  class="entry"
                  onClick={() => open({ kind: 'food', ref: ing.foodRef, ingredient: true, ingredientIndex: i })}
                >
                  <span class="entry-name">{f ? foodName(f, lang.value) : '…'}</span>
                  <span class="num muted">
                    {ing.unit && ing.qty ? `${fmtAmount(ing.qty)} ${unitLabel(ing.unit)}` : `${fmtAmount(ing.grams)} g`}
                  </span>
                </button>
                <button
                  class="btn small"
                  aria-label={`${t('remove')} ${f ? foodName(f, lang.value) : ''}`}
                  onClick={() => set({ ingredients: d.ingredients.filter((_, j) => j !== i) })}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
        <button class="btn wide" onClick={() => open({ kind: 'search', meal: 'breakfast', pickIngredient: true })}>
          + {t('addIngredient')}
        </button>

        <label>
          {t('cookedWeight')}
          <input
            type="text"
            inputMode="decimal"
            value={d.cookedWeightG == null ? '' : inputNum(d.cookedWeightG)}
            placeholder={fmtAmount(n.rawG)}
            onChange={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              if (el.value.trim() === '') return set({ cookedWeightG: undefined });
              const v = parseNum(el.value);
              if (v > 0 && v < 100000) set({ cookedWeightG: Math.round(v * 10) / 10 });
              else el.value = d.cookedWeightG == null ? '' : inputNum(d.cookedWeightG);
            }}
          />
        </label>
        <p class="muted small">{t('cookedWeightHint')}</p>

        {!noIngredients && (
          <>
            <h3>{t('perPortion')}</h3>
            <p class="num preview">
              {fmt(perPortion[NUTRIENT_INDEX.kcal])} kcal · {fmtAmount(n.portionG)} g · Protein{' '}
              {fmtAmount(perPortion[NUTRIENT_INDEX.protein])} g
            </p>
            {missing && (
              <p class="error-text" role="alert">
                {t('ingredientsMissing')}
              </p>
            )}
          </>
        )}
        {existing && <p class="muted small">{t('recipeEditNote')}</p>}

        <div class="actions">
          <button class="btn primary" disabled={busy || missing} onClick={() => void save()}>
            {t('save')}
          </button>
          {existing && !existing.deleted && (
            <button
              class="btn danger"
              onClick={async () => {
                if (!confirm(t('confirmDeleteRecipe'))) return;
                saved.current = true;
                await deleteRecipe(existing.ref);
                back();
              }}
            >
              {t('remove')}
            </button>
          )}
        </div>
      </div>
      {!noIngredients && <div class="pad">{groups}</div>}
    </Sheet>
  );
}
