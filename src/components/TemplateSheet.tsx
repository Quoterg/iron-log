import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { fmt, fmtAmount, lang, t, unitLabel } from '../lib/i18n';
import { foodName, value } from '../lib/nutrients';
import { itemsFromEntries, MAX_TEMPLATE_NAME, suggestName, type TemplateItem } from '../lib/templates';
import { back } from '../nav';
import { deleteTemplate, ensureFoods, entries, foods, saveTemplate, supplementRefs, templates } from '../state';
import { Sheet } from './Sheet';

/** Save the foods of a logged meal as a saved meal (`meal`), or rename/trim/delete one (`id`). */
export default function TemplateSheet({ meal, id }: { meal?: Meal; id?: string }) {
  const existing = id ? templates.value.find((m) => m.id === id) : undefined;
  const [items, setItems] = useState<TemplateItem[]>(() =>
    existing ? existing.items : itemsFromEntries(entries.value.filter((e) => e.meal === meal && !supplementRefs.value.has(e.foodRef))),
  );
  const nameOf = (ref: string) => {
    const f = foods.value.get(ref);
    return f ? foodName(f, lang.value) : '…';
  };
  const [name, setName] = useState(() => existing?.name ?? suggestName(items.map((i) => nameOf(i.foodRef))));
  const busy = useRef(false);

  useEffect(() => void ensureFoods(items.map((i) => i.foodRef)), []);

  const kcal = items.reduce((s, i) => {
    const f = foods.value.get(i.foodRef);
    return s + (f ? (value(f.per100g, 'kcal') * i.grams) / 100 : 0);
  }, 0);
  const ok = name.trim() !== '' && items.length > 0;

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!ok || busy.current) return;
    busy.current = true;
    await saveTemplate({ id: existing?.id, name, items });
    back();
  };

  if (id && !existing) return <Sheet title={t('savedMeal')}>{null}</Sheet>;
  return (
    <Sheet title={existing ? t('savedMeal') : t('saveAsMeal')}>
      <form class="pad form" onSubmit={submit}>
        <label>
          {t('name')}
          <input type="text" value={name} required maxLength={MAX_TEMPLATE_NAME} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <ul class="entries">
          {items.map((i, n) => (
            <li key={`${i.foodRef}-${n}`} class="ingredient">
              <span class="entry entry-static">
                <span class="entry-name">{nameOf(i.foodRef)}</span>
                <span class="num muted">{i.unit && i.qty ? `${fmtAmount(i.qty)} ${unitLabel(i.unit)}` : `${fmtAmount(i.grams)} g`}</span>
              </span>
              <button
                type="button"
                class="btn small"
                aria-label={`${t('remove')} ${nameOf(i.foodRef)}`}
                onClick={() => setItems(items.filter((_, k) => k !== n))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <p class="num muted">{fmt(kcal)} kcal</p>
        <div class="actions">
          <button type="submit" class="btn primary" disabled={!ok}>
            {t('save')}
          </button>
        </div>
        {existing && (
          <div class="actions">
            <button
              type="button"
              class="btn danger"
              onClick={async () => {
                if (!confirm(t('deleteSavedMealConfirm').replace('{name}', existing.name))) return;
                await deleteTemplate(existing.id);
                back();
              }}
            >
              {t('remove')}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
