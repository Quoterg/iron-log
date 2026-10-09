import { useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { decimalComma, nutrientName, parseNum, t } from '../lib/i18n';
import { NUTRIENT_INDEX, NUTRIENTS, type NutrientVector } from '../lib/nutrients';
import { estimateKcal } from '../lib/totals';
import { back, replaceTop } from '../nav';
import { customFoods, deleteCustomFood, saveCustomFood } from '../state';
import { Sheet } from './Sheet';

/** Shown first; what a nutrition label (EU format) lists. The rest is behind "show all". */
const MAIN = ['kcal', 'fat', 'satFat', 'carbs', 'sugar', 'fibre', 'protein', 'salt'];

/** Create or edit a custom food (values per 100 g). */
export function FoodEditor(props: { foodRef?: string; name?: string; meal?: Meal }) {
  const existing = props.foodRef ? customFoods.value.find((f) => f.ref === props.foodRef) : undefined;
  const [name, setName] = useState(existing?.sv ?? props.name ?? '');
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(NUTRIENTS.map((n, i) => [n.key, toText(existing?.per100g[i])])),
  );
  const [showAll, setShowAll] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const parsed = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, parseNum(v)]));
  const invalid = (k: string) => vals[k].trim() !== '' && !(parsed[k] >= 0);
  const num = (k: string) => (parsed[k] >= 0 ? parsed[k] : 0);
  const kcalEstimate = estimateKcal(num('protein'), num('carbs'), num('fat'), num('fibre'), num('alcohol'));
  const nameMissing = !name.trim();
  const hasErrors = nameMissing || NUTRIENTS.some((n) => invalid(n.key));

  const save = async (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    const per100g: NutrientVector = NUTRIENTS.map((n) => (vals[n.key].trim() === '' ? null : parsed[n.key]));
    const k = NUTRIENT_INDEX.kcal;
    if (per100g[k] == null) per100g[k] = kcalEstimate;
    const ref = await saveCustomFood({ ref: existing?.ref, name, per100g });
    // Coming from "create" in a meal's search: continue to choosing the amount.
    if (!existing && props.meal) replaceTop({ kind: 'food', ref, meal: props.meal });
    else back();
  };

  const field = (key: string) => {
    const n = NUTRIENTS.find((x) => x.key === key)!;
    return (
      <label key={key} class={invalid(key) ? 'field error' : 'field'}>
        <span>
          {nutrientName(n)} ({n.unit})
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={vals[key]}
          placeholder={key === 'kcal' ? String(kcalEstimate) : ''}
          aria-invalid={invalid(key)}
          onInput={(e) => setVals({ ...vals, [key]: (e.currentTarget as HTMLInputElement).value })}
        />
      </label>
    );
  };

  return (
    <Sheet title={existing ? t('editFood') : t('createFood')}>
      <form class="pad form" onSubmit={save} noValidate>
        <label class={submitted && nameMissing ? 'field error' : 'field'}>
          <span>{t('name')}</span>
          <input
            type="text"
            value={name}
            autoFocus={!name}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        {submitted && nameMissing && <p class="error-text">{t('nameRequired')}</p>}

        <h3>{t('nutrientsPer100g')}</h3>
        <div class="grid2">{MAIN.map(field)}</div>
        <p class="muted small">{t('kcalHint')}</p>

        {showAll ? (
          <div class="grid2">{NUTRIENTS.filter((n) => !MAIN.includes(n.key)).map((n) => field(n.key))}</div>
        ) : (
          <button type="button" class="btn wide" onClick={() => setShowAll(true)}>
            {t('showAllNutrients')}
          </button>
        )}
        {submitted && hasErrors && !nameMissing && <p class="error-text">{t('invalidNumber')}</p>}

        <div class="actions">
          <button type="submit" class="btn primary">
            {t('save')}
          </button>
          {existing && !existing.deleted && (
            <button
              type="button"
              class="btn danger"
              onClick={async () => {
                if (!confirm(t('confirmDeleteFood'))) return;
                await deleteCustomFood(existing.ref);
                back();
              }}
            >
              {t('remove')}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function toText(v: number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  return decimalComma() ? s.replace('.', ',') : s;
}
