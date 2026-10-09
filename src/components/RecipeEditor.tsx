import { useEffect, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { fmt, fmtAmount, inputNum, lang, parseNum, t, unitLabel } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX } from '../lib/nutrients';
import { recipeNutrition } from '../lib/recipes';
import { scale } from '../lib/totals';
import { back, open, replaceTop } from '../nav';
import { deleteRecipe, ensureFoods, foods, recipeDraft, recipes, saveRecipe } from '../state';
import { NutrientGroups } from './NutrientGroups';
import { Sheet } from './Sheet';

/**
 * Create (no ref) or edit a recipe. The draft lives in `recipeDraft` so that adding an
 * ingredient (search → food screen in ingredient mode) can append to it and come back here.
 */
export default function RecipeEditor({ recipeRef, meal }: { recipeRef?: string; meal?: Meal }) {
  const existing = recipeRef ? recipes.value.find((r) => r.ref === recipeRef) : undefined;
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  // A fresh draft when the editor opens; discarded when it closes (cancel = no changes). The
  // editor stays mounted under the ingredient sheets, so adding ingredients keeps the draft.
  useEffect(() => {
    recipeDraft.value = existing
      ? { ref: existing.ref, name: existing.name, ingredients: existing.ingredients, servings: existing.servings, cookedWeightG: existing.cookedWeightG }
      : { name: '', ingredients: [], servings: 1 };
    return () => void (recipeDraft.value = null);
  }, [recipeRef]);

  const d = recipeDraft.value;
  // Resolve ingredient foods (the food database may still be loading).
  useEffect(() => {
    if (d) void ensureFoods(d.ingredients.map((i) => i.foodRef));
  }, [d?.ingredients.map((i) => i.foodRef).join()]);
  if (!d) return null;

  const set = (patch: Partial<typeof d>) => (recipeDraft.value = { ...d, ...patch });
  const n = recipeNutrition(d, foods.value);
  const perPortion = scale(n.per100g, n.portionG);
  const nameMissing = !d.name.trim();
  const noIngredients = d.ingredients.length === 0;

  const save = async () => {
    setSubmitted(true);
    if (nameMissing || noIngredients || busy) return;
    setBusy(true);
    const ref = await saveRecipe(d);
    recipeDraft.value = null;
    // From a meal's search: continue to logging it.
    if (!existing && meal) replaceTop({ kind: 'food', ref, meal });
    else back();
  };

  return (
    <Sheet title={existing ? t('editRecipe') : t('createRecipe')}>
      <div class="pad form">
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
            inputMode="numeric"
            value={String(d.servings)}
            onChange={(e) => {
              const el = e.currentTarget as HTMLInputElement;
              const v = parseNum(el.value);
              if (Number.isInteger(v) && v >= 1 && v <= 1000) set({ servings: v });
              else el.value = String(d.servings);
            }}
          />
        </label>

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
            {n.missing.length > 0 && <p class="small warn">{t('ingredientsMissing')}</p>}
          </>
        )}

        <div class="actions">
          <button class="btn primary" disabled={busy} onClick={() => void save()}>
            {t('save')}
          </button>
          {existing && !existing.deleted && (
            <button
              class="btn danger"
              onClick={async () => {
                if (!confirm(t('confirmDeleteRecipe'))) return;
                await deleteRecipe(existing.ref);
                recipeDraft.value = null;
                back();
              }}
            >
              {t('remove')}
            </button>
          )}
        </div>
      </div>
      {!noIngredients && (
        <div class="pad">
          <NutrientGroups amounts={perPortion} known={n.per100g.map((v) => v != null)} />
        </div>
      )}
    </Sheet>
  );
}
