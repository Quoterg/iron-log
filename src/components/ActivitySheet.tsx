import { useState } from 'preact/hooks';
import { burnedKcal, DEFAULT_WEIGHT_KG } from '../lib/activity';
import { ACTIVITIES } from '../lib/activity-types';
import { fmt, lang, parseNum, t } from '../lib/i18n';
import { back } from '../nav';
import { addActivity, settings } from '../state';
import { Sheet } from './Sheet';

const QUICK_MIN = [15, 30, 45, 60];

/** Log exercise for the selected day. Loaded lazily. */
export default function ActivitySheet() {
  const [type, setType] = useState(ACTIVITIES[0].id);
  const [minutesText, setMinutesText] = useState('30');
  const [busy, setBusy] = useState(false);
  const a = ACTIVITIES.find((x) => x.id === type)!;
  const minutes = parseNum(minutesText);
  const valid = minutes > 0 && minutes <= 1440;
  const weight = settings.value.profile.weightKg;
  const kcal = valid ? burnedKcal(a.met, weight ?? DEFAULT_WEIGHT_KG, minutes) : 0;

  return (
    <Sheet title={t('addActivity')}>
      <form
        class="pad form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || busy) return;
          setBusy(true);
          await addActivity(a.id, a.met, Math.round(minutes));
          back();
        }}
      >
        <label>
          {t('activityType')}
          <select aria-label={t('activityType')} value={type} onChange={(e) => setType((e.currentTarget as HTMLSelectElement).value)}>
            {ACTIVITIES.map((x) => (
              <option key={x.id} value={x.id}>
                {x[lang.value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('minutes')}
          <input
            type="text"
            inputMode="numeric"
            value={minutesText}
            aria-invalid={!valid}
            onInput={(e) => setMinutesText((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <div class="chips">
          {QUICK_MIN.map((m) => (
            <button type="button" key={m} class="chip" onClick={() => setMinutesText(String(m))}>
              {m} min
            </button>
          ))}
        </div>
        <p class="num preview">≈ {fmt(kcal)} kcal</p>
        <p class="muted small">{weight ? t('activityNote') : t('activityNoWeight').replace('{kg}', String(DEFAULT_WEIGHT_KG))}</p>
        <div class="actions">
          <button type="submit" class="btn primary" disabled={!valid || busy}>
            {t('add')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
