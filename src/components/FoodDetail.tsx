import { useRef, useState } from 'preact/hooks';
import { MEALS, type Meal } from '../lib/db';
import { fmt, fmtAmount, lang, parseNum, t } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, value } from '../lib/nutrients';
import { scale } from '../lib/totals';
import { back, closeAll, open } from '../nav';
import {
  addEntry,
  date as currentDate,
  entries,
  foods,
  removeEntry,
  toggleFavourite,
  updateEntry,
  usage,
} from '../state';
import { NutrientGroups } from './NutrientGroups';
import { Sheet } from './Sheet';

const QUICK_GRAMS = [25, 50, 100, 150, 200, 300];

/**
 * A food with all its nutrients for the chosen amount. Adds a new entry (`meal`)
 * or edits an existing one (`entryId`): amount, meal, date, or swap the food.
 */
export function FoodDetail(props: { foodRef: string; meal?: Meal; entryId?: string }) {
  const entry = props.entryId ? entries.value.find((e) => e.id === props.entryId) : undefined;
  const ref = entry?.foodRef ?? props.foodRef;
  const food = foods.value.get(ref);

  const used = usage.value.get(ref);
  // New entries start from the amount you used last time for this food.
  const [grams, setGrams] = useState(
    String(entry?.grams ?? used?.lastGrams ?? 100).replace('.', lang.value === 'sv' ? ',' : '.'),
  );
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? props.meal ?? 'breakfast');
  const [day, setDay] = useState(entry?.date ?? currentDate.value);
  // Synchronous guard: a double tap on a slow phone must not log the food twice.
  const busy = useRef(false);

  if (!food) return <Sheet title="">{null}</Sheet>;
  const g = parseNum(grams);
  const valid = g > 0 && g < 100000;
  const amounts = scale(food.per100g, valid ? g : 0);
  const isCustom = ref.startsWith('custom:');

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!valid || busy.current) return;
    busy.current = true;
    if (entry) {
      await updateEntry(entry.id, { grams: g, meal, date: day });
      back();
    } else {
      await addEntry(meal, food, g);
      closeAll();
    }
  };

  return (
    <Sheet title={entry ? t(entry.meal) : t(meal)}>
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
        <label>
          {t('amount')}
          <span class="amount-row">
            <input
              type="text"
              inputMode="decimal"
              value={grams}
              aria-invalid={!valid}
              onInput={(e) => setGrams((e.currentTarget as HTMLInputElement).value)}
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
        <div class="row">
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
          {fmt(amounts[NUTRIENT_INDEX.kcal])} kcal · {fmt(value(food.per100g, 'kcal'))} kcal / 100 g
        </p>
        <div class="actions">
          <button type="submit" class="btn primary" disabled={!valid}>
            {entry ? t('save') : t('add')}
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
      </form>

      <div class="pad">
        <h3>
          {t('nutrientsForAmount')} ({fmtAmount(valid ? g : 0)} g)
        </h3>
        <NutrientGroups amounts={amounts} known={food.per100g.map((v) => v != null)} />
        <p class="muted small">{isCustom ? t('sourceCustom') : t('sourceSlv')}</p>
      </div>
    </Sheet>
  );
}
