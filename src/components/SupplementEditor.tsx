import { useRef, useState } from 'preact/hooks';
import { inputNum, locale, nutrientName, parseNum, t } from '../lib/i18n';
import { NUTRIENT_INDEX, NUTRIENTS, type NutrientVector } from '../lib/nutrients';
import { per100gToPerUnit, perUnitToPer100g, SUPPLEMENT_TIMES, type SupplementTime } from '../lib/supplements';
import { estimateKcal } from '../lib/totals';
import { back } from '../nav';
import { customFoods, deleteCustomFood, saveCustomFood } from '../state';
import { Sheet } from './Sheet';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
/** Short weekday name in the UI language (0 = Monday; 2024-01-01 was a Monday). */
const weekdayName = (d: number) => new Date(2024, 0, 1 + d).toLocaleDateString(locale(), { weekday: 'short' });

/** What supplement labels list (vitamins, minerals, EPA/DHA); the rest is behind "show all". */
const isMain = (n: { key: string; group: string }) => n.group === 'vitamin' || n.group === 'mineral' || n.key === 'epa' || n.key === 'dha';

/** Create or edit a supplement: amounts per unit (tablet, capsule…) and a daily dose. Loaded lazily. */
export default function SupplementEditor(props: { foodRef?: string }) {
  const existing = props.foodRef ? customFoods.value.find((f) => f.ref === props.foodRef) : undefined;
  const perUnit = existing ? per100gToPerUnit(existing.per100g) : [];
  const [name, setName] = useState(existing?.sv ?? '');
  const [unit, setUnit] = useState(existing?.supplement?.unit ?? t('supplementUnitDefault'));
  const [perDayText, setPerDayText] = useState(inputNum(existing?.supplement?.perDay ?? 1));
  const [days, setDays] = useState<number[]>(existing?.supplement?.days ?? [0, 1, 2, 3, 4, 5, 6]);
  const [time, setTime] = useState<SupplementTime | ''>(existing?.supplement?.time ?? '');
  // Raw text per nutrient, kept outside state: typing doesn't re-render the ~40 fields.
  const vals = useRef<Record<string, string>>(
    Object.fromEntries(NUTRIENTS.map((n, i) => [n.key, perUnit[i] == null ? '' : inputNum(+perUnit[i]!.toPrecision(6))])),
  );
  /** Fields shown as invalid (checked on blur and on save). */
  const [bad, setBad] = useState<ReadonlySet<string>>(new Set());
  const [showAll, setShowAll] = useState(() => NUTRIENTS.some((n, i) => !isMain(n) && perUnit[i] != null));
  const [submitted, setSubmitted] = useState(false);

  const invalid = (k: string) => vals.current[k].trim() !== '' && !(parseNum(vals.current[k]) >= 0);
  const check = (k: string) => {
    if (invalid(k) === bad.has(k)) return;
    const next = new Set(bad);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setBad(next);
  };
  const perDay = perDayText.trim() === '' ? 0 : parseNum(perDayText);
  const perDayInvalid = !(perDay >= 0 && perDay <= 100);
  const nameMissing = !name.trim();
  const unitMissing = !unit.trim();
  const daysMissing = perDay > 0 && days.length === 0;
  const hasErrors = nameMissing || unitMissing || perDayInvalid || daysMissing || bad.size > 0;

  const save = async (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    const invalidNow = new Set(NUTRIENTS.filter((n) => invalid(n.key)).map((n) => n.key));
    setBad(invalidNow);
    if (nameMissing || unitMissing || perDayInvalid || daysMissing || invalidNow.size) return;
    const unitVals: NutrientVector = NUTRIENTS.map((n) => (vals.current[n.key].trim() === '' ? null : parseNum(vals.current[n.key])));
    const k = NUTRIENT_INDEX.kcal;
    if (unitVals[k] == null) {
      const num = (key: string) => unitVals[NUTRIENT_INDEX[key]] ?? 0;
      unitVals[k] = estimateKcal(num('protein'), num('carbs'), num('fat'), num('fibre'), num('alcohol'));
    }
    await saveCustomFood({
      ref: existing?.ref,
      name,
      per100g: perUnitToPer100g(unitVals),
      supplement: {
        unit: unit.trim(),
        perDay,
        ...(perDay > 0 && days.length < 7 ? { days: [...days].sort() } : {}),
        ...(time ? { time } : {}),
      },
    });
    back();
  };

  const field = (key: string) => {
    const n = NUTRIENTS.find((x) => x.key === key)!;
    return (
      <label key={key} class={bad.has(key) ? 'field error' : 'field'}>
        <span>
          {nutrientName(n)} ({n.unit})
        </span>
        <input
          type="text"
          inputMode="decimal"
          defaultValue={vals.current[key]}
          aria-invalid={bad.has(key)}
          onInput={(e) => void (vals.current[key] = (e.currentTarget as HTMLInputElement).value)}
          onBlur={() => check(key)}
        />
      </label>
    );
  };

  return (
    <Sheet title={existing ? t('editSupplement') : t('newSupplement')}>
      <form class="pad form" onSubmit={save} noValidate>
        <label class={submitted && nameMissing ? 'field error' : 'field'}>
          <span>{t('name')}</span>
          <input type="text" value={name} autoFocus={!name} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <div class="grid2">
          <label class={submitted && unitMissing ? 'field error' : 'field'}>
            <span>{t('supplementUnit')}</span>
            <input type="text" maxLength={30} value={unit} onInput={(e) => setUnit((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class={perDayInvalid ? 'field error' : 'field'}>
            <span>{t('supplementPerDay')}</span>
            <input
              type="text"
              inputMode="decimal"
              value={perDayText}
              aria-invalid={perDayInvalid}
              onInput={(e) => setPerDayText((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
        </div>
        <p class="muted small">{t('supplementPerDayHint')}</p>
        {perDay > 0 && (
          <fieldset class="weekdays">
            <legend>{t('supplementDays')}</legend>
            <div class="chips">
              {WEEKDAYS.map((d) => (
                <button
                  type="button"
                  key={d}
                  class={days.includes(d) ? 'chip on' : 'chip'}
                  aria-pressed={days.includes(d)}
                  onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                >
                  {weekdayName(d)}
                </button>
              ))}
            </div>
            {daysMissing && <p class="error-text">{t('supplementDaysMissing')}</p>}
          </fieldset>
        )}
        <label class="field">
          <span>{t('supplementTime')}</span>
          <select aria-label={t('supplementTime')} value={time} onChange={(e) => setTime((e.currentTarget as HTMLSelectElement).value as SupplementTime | '')}>
            <option value="">{t('time_any')}</option>
            {SUPPLEMENT_TIMES.map((x) => (
              <option key={x} value={x}>
                {t(`time_${x}`)}
              </option>
            ))}
          </select>
        </label>

        <h3>{t('supplementPerUnit').replace('{unit}', unit.trim() || t('supplementUnitDefault'))}</h3>
        <div class="grid2">{NUTRIENTS.filter(isMain).map((n) => field(n.key))}</div>
        {showAll ? (
          <div class="grid2">{NUTRIENTS.filter((n) => !isMain(n)).map((n) => field(n.key))}</div>
        ) : (
          <button type="button" class="btn wide" onClick={() => setShowAll(true)}>
            {t('showAllNutrients')}
          </button>
        )}
        {submitted && (nameMissing || unitMissing) && <p class="error-text">{t('nameRequired')}</p>}
        {submitted && hasErrors && !nameMissing && !unitMissing && <p class="error-text">{t('invalidNumber')}</p>}

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
