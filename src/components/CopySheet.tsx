import { useState } from 'preact/hooks';
import { addDays, isoDate, MEALS, type Meal } from '../lib/db';
import { t } from '../lib/i18n';
import { closeAll } from '../nav';
import { copyEntries, date, loadDay } from '../state';
import { Sheet } from './Sheet';

/** Copy the shown day's entries, or one meal's, to another date (and meal). */
export function CopySheet({ meal }: { meal?: Meal }) {
  const today = isoDate(new Date());
  // Copying today's food usually means "same again tomorrow"; from another day, "to today".
  const [toDate, setToDate] = useState(date.value === today ? addDays(today, 1) : today);
  const [toMeal, setToMeal] = useState<Meal | ''>(meal ?? '');

  const submit = async (e: Event) => {
    e.preventDefault();
    await copyEntries({ fromMeal: meal, toDate, toMeal: toMeal || undefined });
    closeAll();
    await loadDay(toDate); // show the result
  };

  return (
    <Sheet title={meal ? `${t('copyMeal')}: ${t(meal)}` : t('copyDay')}>
      <form class="pad form" onSubmit={submit}>
        <label>
          {t('toDate')}
          <input type="date" value={toDate} required onChange={(e) => setToDate((e.currentTarget as HTMLInputElement).value || toDate)} />
        </label>
        <label>
          {t('toMeal')}
          <select value={toMeal} onChange={(e) => setToMeal((e.currentTarget as HTMLSelectElement).value as Meal | '')}>
            {!meal && <option value="">{t('sameMeal')}</option>}
            {MEALS.map((m) => (
              <option key={m} value={m}>
                {t(m)}
              </option>
            ))}
          </select>
        </label>
        <div class="actions">
          <button type="submit" class="btn primary">
            {t('copy')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
