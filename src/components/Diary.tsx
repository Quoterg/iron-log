import { useState } from 'preact/hooks';
import { MEALS, type Entry } from '../lib/db';
import { fmt, fmtAmount, lang, t } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS, value } from '../lib/nutrients';
import { energySplit } from '../lib/totals';
import { addingTo, dayTotals, entries, foods, removeEntry, targets, updateGrams } from '../state';
import { Bar } from './Bar';

export function Diary() {
  const tot = dayTotals.value;
  const g = (k: string) => tot[NUTRIENT_INDEX[k]];
  const tg = targets.value;
  const split = energySplit(g('protein'), g('carbs'), g('fat'), g('alcohol'));

  return (
    <>
      <section class="card summary">
        <Bar label={t('energy')} amount={g('kcal')} unit="kcal" target={tg.kcal} />
        <div class="macros">
          {(['protein', 'carbs', 'fat'] as const).map((k) => (
            <div class={`macro m-${k}`} key={k}>
              <span class="macro-val num">{fmt(g(k))} g</span>
              <span class="macro-lbl">{NUTRIENTS[NUTRIENT_INDEX[k]][lang.value]}</span>
              <span class="macro-pct num">{Math.round(split[k] * 100)} E%</span>
            </div>
          ))}
        </div>
      </section>

      {MEALS.map((meal) => {
        const list = entries.value.filter((e) => e.meal === meal);
        const kcal = list.reduce((s, e) => s + entryKcal(e), 0);
        return (
          <section class="card meal" key={meal}>
            <header class="meal-head">
              <h2>{t(meal)}</h2>
              <span class="num muted">{list.length ? `${fmt(kcal)} kcal` : ''}</span>
              <button class="btn small" onClick={() => (addingTo.value = meal)}>
                + {t('addFood')}
              </button>
            </header>
            {list.length > 0 && (
              <ul class="entries">
                {list.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {entries.value.length === 0 && <p class="muted center">{t('emptyDay')}</p>}
    </>
  );
}

function entryKcal(e: Entry): number {
  const f = foods.value.get(e.foodRef);
  return f ? (value(f.per100g, 'kcal') * e.grams) / 100 : 0;
}

function EntryRow({ entry }: { entry: Entry }) {
  const [editing, setEditing] = useState(false);
  const food = foods.value.get(entry.foodRef);
  const name = food ? foodName(food, lang.value) : entry.foodRef;

  if (!editing) {
    return (
      <li>
        <button class="entry" onClick={() => setEditing(true)}>
          <span class="entry-name">{name}</span>
          <span class="num muted">{fmtAmount(entry.grams)} g</span>
          <span class="num">{fmt(entryKcal(entry))} kcal</span>
        </button>
      </li>
    );
  }
  return (
    <li class="entry-edit">
      <span class="entry-name">{name}</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        value={entry.grams}
        aria-label={t('amount')}
        onChange={(ev) => {
          const v = parseFloat((ev.currentTarget as HTMLInputElement).value.replace(',', '.'));
          if (v > 0) void updateGrams(entry.id, v);
        }}
      />
      <span>g</span>
      <button class="btn small danger" onClick={() => void removeEntry(entry.id)}>
        {t('remove')}
      </button>
      <button class="btn small" onClick={() => setEditing(false)}>
        {t('close')}
      </button>
    </li>
  );
}
