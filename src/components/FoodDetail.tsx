import { useRef, useState } from 'preact/hooks';
import { offProductUrl, reportUrl } from '../lib/contribute';
import { MEALS, type Meal } from '../lib/db';
import { fmt, fmtAmount, lang, parseNum, t, unitLabel } from '../lib/i18n';
import { GRAMS, initialAmount, servingsFor, toGrams } from '../lib/servings';
import { foodName, NUTRIENT_INDEX, value } from '../lib/nutrients';
import { scale } from '../lib/totals';
import { back, backTo, closeAll, open } from '../nav';
import { entryVector } from '../lib/db';
import {
  addEntry,
  addServing,
  date as currentDate,
  entries,
  foods,
  recipeDraft,
  removeEntry,
  toggleFavourite,
  updateEntry,
  usage,
  userServings,
} from '../state';
import { NutrientGroups } from './NutrientGroups';
import { Sheet } from './Sheet';

const QUICK_GRAMS = [25, 50, 100, 150, 200, 300];
const QUICK_QTY = [0.5, 1, 2, 3];

const numText = (n: number) => String(n).replace('.', lang.value === 'sv' ? ',' : '.');

/**
 * A food with all its nutrients for the chosen amount. Adds a new entry (`meal`)
 * or edits an existing one (`entryId`): amount, meal, date, or swap the food.
 */
export function FoodDetail(props: {
  foodRef: string;
  meal?: Meal;
  entryId?: string;
  /** Choosing an amount for a recipe ingredient (new, or `ingredientIndex` to edit). */
  ingredient?: boolean;
  ingredientIndex?: number;
}) {
  const entry = props.entryId ? entries.value.find((e) => e.id === props.entryId) : undefined;
  const ref = entry?.foodRef ?? props.foodRef;
  const food = foods.value.get(ref);

  const used = usage.value.get(ref);
  const servings = food ? servingsFor(food, userServings.value.get(ref)) : [];
  // Start from the entry being edited, else the amount and measure used last time.
  const editing = props.ingredientIndex != null ? recipeDraft.value?.ingredients[props.ingredientIndex] : undefined;
  const [init] = useState(() =>
    editing
      ? editing.unit && editing.qty
        ? { unit: editing.unit, qty: editing.qty }
        : { unit: 'g', qty: editing.grams }
      : initialAmount(servings, entry, used),
  );
  const [unit, setUnit] = useState(init.unit);
  const [qtyText, setQtyText] = useState(numText(init.qty));
  const [adding, setAdding] = useState(false);
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? props.meal ?? 'breakfast');
  const [day, setDay] = useState(entry?.date ?? currentDate.value);
  // Synchronous guard: a double tap on a slow phone must not log the food twice.
  const busy = useRef(false);

  if (!food) return <Sheet title="">{null}</Sheet>;
  const qty = parseNum(qtyText);
  const g = toGrams(unit, qty, servings);
  const valid = g > 0 && g < 100000;
  const amount = unit === GRAMS ? { grams: g } : { grams: g, unit, qty };
  // An entry shows what was logged (a recipe's values at the time), not the current recipe.
  const per100g = (entry && entryVector(entry, foods.value)) || food.per100g;
  const amounts = scale(per100g, valid ? g : 0);
  const isCustom = ref.startsWith('custom:');

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!valid || busy.current) return;
    busy.current = true;
    if (props.ingredient) {
      const d = recipeDraft.value;
      if (d) {
        const ing = { foodRef: ref, ...amount };
        const list = [...d.ingredients];
        if (props.ingredientIndex != null) list[props.ingredientIndex] = ing;
        else list.push(ing);
        recipeDraft.value = { ...d, ingredients: list };
      }
      // Back to the recipe editor, wherever it is in the stack.
      backTo('recipe');
    } else if (entry) {
      await updateEntry(entry.id, { amount, meal, date: day });
      back();
    } else {
      await addEntry(meal, food, amount);
      closeAll();
    }
  };

  return (
    <Sheet title={props.ingredient ? t('ingredient') : entry ? t(entry.meal) : t(meal)}>
      <form class="amount" onSubmit={submit}>
        <div class="title-row">
          <h3>
            {foodName(food, lang.value)}
            {isCustom && <span class="badge">{t('customBadge')}</span>}
          </h3>
          <button
            type="button"
            class={used?.fav ? 'btn small fav on' : 'btn small fav'}
            aria-pressed={!!used?.fav}
            onClick={() => void toggleFavourite(ref)}
          >
            {used?.fav ? t('isFavourite') : t('addFavourite')}
          </button>
        </div>
        <div class="amount-row">
          <label>
            {t('amount')}
            <input
              type="text"
              inputMode="decimal"
              value={qtyText}
              aria-label={t('amount')}
              aria-invalid={!valid}
              onInput={(e) => setQtyText((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <label>
            {t('unit')}
            <select
              aria-label={t('unit')}
              value={unit}
              onChange={(e) => {
                const u = (e.currentTarget as HTMLSelectElement).value;
                // Keep the same weight when switching to grams; start at 1 for a measure.
                setQtyText(numText(u === GRAMS ? (valid ? g : 100) : 1));
                setUnit(u);
              }}
            >
              <option value={GRAMS}>g</option>
              {servings.map((s) => (
                <option key={s.name} value={s.name}>
                  {unitLabel(s.name)} (≈ {fmtAmount(s.g)} g)
                </option>
              ))}
            </select>
          </label>
        </div>
        <div class="chips">
          {unit === GRAMS
            ? QUICK_GRAMS.map((q) => (
                <button type="button" class="chip" key={q} onClick={() => setQtyText(String(q))}>
                  {q} g
                </button>
              ))
            : QUICK_QTY.map((q) => (
                <button type="button" class="chip" key={q} onClick={() => setQtyText(numText(q))}>
                  {q === 0.5 ? '½' : q} {unitLabel(unit)}
                </button>
              ))}
          <button type="button" class="chip" onClick={() => setAdding(!adding)}>
            {t('addServing')}
          </button>
        </div>
        {adding && (
          <ServingForm
            onSave={async (s) => {
              await addServing(ref, s);
              setUnit(s.name);
              setQtyText('1');
              setAdding(false);
            }}
          />
        )}
        <div class="row" hidden={props.ingredient}>
          <label>
            {t('meal')}
            <select value={meal} onChange={(e) => setMeal((e.currentTarget as HTMLSelectElement).value as Meal)}>
              {MEALS.map((m) => (
                <option key={m} value={m}>
                  {t(m)}
                </option>
              ))}
            </select>
          </label>
          {entry && (
            <label>
              {t('date')}
              <input
                type="date"
                value={day}
                required
                onChange={(e) => setDay((e.currentTarget as HTMLInputElement).value || day)}
              />
            </label>
          )}
        </div>
        <p class="num preview">
          {unit !== GRAMS && valid && `≈ ${fmtAmount(g)} g · `}
          {fmt(amounts[NUTRIENT_INDEX.kcal])} kcal · {fmt(value(per100g, 'kcal'))} kcal / 100 g
        </p>
        <div class="actions">
          <button type="submit" class="btn primary" disabled={!valid}>
            {props.ingredient ? t('addToRecipe') : entry ? t('save') : t('add')}
          </button>
        </div>
        {entry && (
          <div class="actions">
            <button type="button" class="btn" onClick={() => open({ kind: 'search', meal, replaceEntryId: entry.id })}>
              {t('changeFood')}
            </button>
            <button
              type="button"
              class="btn danger"
              onClick={async () => {
                await removeEntry(entry.id);
                back();
              }}
            >
              {t('remove')}
            </button>
          </div>
        )}
        {isCustom && (
          <button type="button" class="btn wide" onClick={() => open({ kind: 'editFood', ref })}>
            {t('editFood')}
          </button>
        )}
        {ref.startsWith('recipe:') && !props.ingredient && (
          <button type="button" class="btn wide" onClick={() => open({ kind: 'recipe', ref })}>
            {t('editRecipe')}
          </button>
        )}
      </form>

      <div class="pad">
        <h3>
          {t('nutrientsForAmount')} ({fmtAmount(valid ? g : 0)} g)
        </h3>
        <NutrientGroups amounts={amounts} known={per100g.map((v) => v != null)} />
        <p class="muted small">
          {isCustom
            ? t('sourceCustom')
            : ref.startsWith('recipe:')
              ? t('sourceRecipe')
              : ref.startsWith('off:')
                ? `${t('sourceOff')} ${ref.slice(4)}.`
                : ref.startsWith('usda:')
                  ? t('sourceUsda')
                  : t('sourceSlv')}
        </p>
        {ref.startsWith('off:') ? (
          <p class="small">
            <a href={offProductUrl(ref.slice(4))} target="_blank" rel="noopener">
              {t('offFix')}
            </a>
          </p>
        ) : !isCustom && !ref.startsWith('recipe:') ? (
          <p class="small">
            <a href={reportUrl(ref, food?.sv ?? ref, ref.startsWith('usda:') ? 'USDA FoodData Central' : 'Livsmedelsverket')} target="_blank" rel="noopener">
              {t('reportError')}
            </a>
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

/** Inline form for a custom measure, e.g. "min skål" = 300 g. Not a <form>: it sits inside one. */
function ServingForm({ onSave }: { onSave: (s: { name: string; g: number }) => void }) {
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const g = parseNum(grams);
  const ok = name.trim() !== '' && name.trim().length <= 50 && g > 0 && g < 100000;
  return (
    <div class="row serving-form">
      <label>
        {t('servingName')}
        <input type="text" value={name} placeholder={t('servingNameHint')} maxLength={50} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <label>
        {t('servingGrams')}
        <input type="text" inputMode="decimal" value={grams} onInput={(e) => setGrams((e.currentTarget as HTMLInputElement).value)} />
      </label>
      <button type="button" class="btn" disabled={!ok} onClick={() => ok && onSave({ name: name.trim(), g })}>
        {t('save')}
      </button>
    </div>
  );
}
