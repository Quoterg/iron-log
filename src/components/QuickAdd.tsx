import { useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { parseNum, t } from '../lib/i18n';
import { back } from '../nav';
import { addQuickEntry } from '../state';
import { Sheet } from './Sheet';

const MACROS = [
  ['protein', 'quickProtein'],
  ['carbs', 'quickCarbs'],
  ['fat', 'quickFat'],
] as const;

/**
 * Log energy and macros without a food (M47), e.g. eating out: one portion with what the user knows.
 * Only energy is needed; the rest stays unknown rather than 0.
 */
export default function QuickAdd({ meal, name: initial = '' }: { meal: Meal; name?: string }) {
  const [name, setName] = useState(initial);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [tried, setTried] = useState(false);
  const busy = useRef(false); // a double tap on a slow phone must not log it twice
  const num = (k: string) => (vals[k]?.trim() ? parseNum(vals[k]) : undefined);
  const kcal = num('kcal');
  const kcalOk = kcal != null && kcal > 0 && kcal <= 10000;
  const macroOk = (k: string) => {
    const v = num(k);
    return v === undefined || (v >= 0 && v <= 1000);
  };
  const ok = kcalOk && MACROS.every(([k]) => macroOk(k));
  const field = (k: string, label: string, error?: string) => (
    <label key={k}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={vals[k] ?? ''}
        aria-invalid={tried && !!error}
        onInput={(e) => setVals({ ...vals, [k]: (e.currentTarget as HTMLInputElement).value })}
      />
      {tried && error && <span class="small warn">{error}</span>}
    </label>
  );
  return (
    <Sheet title={t('quickTitle')}>
      <form
        class="pad form"
        onSubmit={async (e) => {
          e.preventDefault();
          setTried(true);
          if (!ok || busy.current) return;
          busy.current = true;
          const macro = (k: 'protein' | 'carbs' | 'fat') => num(k);
          await addQuickEntry(meal, {
            name: name.trim() || t('quickDefaultName'),
            kcal: kcal!,
            protein: macro('protein'),
            carbs: macro('carbs'),
            fat: macro('fat'),
          });
          back();
        }}
      >
        <p class="muted small">{t('quickNote')}</p>
        <label>
          {t('quickName')}
          <input type="text" value={name} placeholder={t('quickDefaultName')} maxLength={80} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        {field('kcal', t('quickKcal'), kcalOk ? undefined : t('quickKcalError'))}
        <div class="grid3">{MACROS.map(([k, label]) => field(k, t(label), macroOk(k) ? undefined : t('quickMacroError')))}</div>
        <div class="actions">
          <button type="submit" class="btn primary">
            {t('quickAdd')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
