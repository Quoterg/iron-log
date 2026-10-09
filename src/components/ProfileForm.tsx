import { fmt, t } from '../lib/i18n';
import { defaultKcal, energyNeed, PAL_LEVELS, withEnergy, type Profile, type Sex, type Status } from '../lib/targets';
import { settings, updateSettings } from '../state';

const PAL_LABEL: Record<number, 'palLow' | 'palAverage' | 'palActive' | 'palVeryActive'> = {
  1.4: 'palLow',
  1.6: 'palAverage',
  1.8: 'palActive',
  2.0: 'palVeryActive',
};

/** Body data → NNR 2023 targets for age band, pregnancy/lactation, and an energy estimate. */
export function ProfileForm() {
  const p = settings.value.profile;
  const save = (patch: Partial<Profile>) => void updateSettings({ profile: withEnergy({ ...p, ...patch }) });
  const estimate = energyNeed(p);

  /** Number field that commits on change when within range (else reverts). */
  const num = (key: 'age' | 'weightKg' | 'heightCm', label: string, min: number, max: number) => (
    <label>
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={p[key] ?? ''}
        onChange={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          const v = el.value === '' ? undefined : Number(el.value);
          if (v === undefined || (v >= min && v <= max)) save({ [key]: v });
          else el.value = String(p[key] ?? '');
        }}
      />
    </label>
  );

  return (
    <section class="card form">
      <h2>{t('profile')}</h2>
      <label>
        {t('sex')}
        <select
          value={p.sex}
          onChange={(e) => {
            const sex = (e.currentTarget as HTMLSelectElement).value as Sex;
            save({ sex, status: 'none', kcal: p.kcalAuto ? p.kcal : defaultKcal(sex) });
          }}
        >
          <option value="female">{t('female')}</option>
          <option value="male">{t('male')}</option>
        </select>
      </label>
      <div class="grid2">
        {num('age', t('age'), 18, 110)}
        {num('weightKg', t('weightKg'), 30, 300)}
        {num('heightCm', t('heightCm'), 120, 230)}
        <label>
          {t('activity')}
          <select value={String(p.pal ?? 1.6)} onChange={(e) => save({ pal: Number((e.currentTarget as HTMLSelectElement).value) })}>
            {PAL_LEVELS.map((v) => (
              <option key={v} value={String(v)}>
                {t(PAL_LABEL[v])}
              </option>
            ))}
          </select>
        </label>
      </div>
      {p.sex === 'female' && (
        <>
          <label>
            {t('lifeStage')}
            <select value={p.status ?? 'none'} onChange={(e) => save({ status: (e.currentTarget as HTMLSelectElement).value as Status })}>
              <option value="none">{t('statusNone')}</option>
              <option value="pregnant1">{t('pregnant1')}</option>
              <option value="pregnant2">{t('pregnant2')}</option>
              <option value="pregnant3">{t('pregnant3')}</option>
              <option value="lactating">{t('lactating')}</option>
            </select>
          </label>
          {(p.status ?? 'none') === 'none' && (
            <label class="check">
              <input
                type="checkbox"
                checked={p.menstruating ?? (p.age == null || p.age < 51)}
                onChange={(e) => save({ menstruating: (e.currentTarget as HTMLInputElement).checked })}
              />
              {t('menstruating')}
            </label>
          )}
        </>
      )}
      <label class="check">
        <input
          type="checkbox"
          checked={!!p.kcalAuto}
          disabled={!estimate && !p.kcalAuto}
          onChange={(e) => save({ kcalAuto: (e.currentTarget as HTMLInputElement).checked })}
        />
        {t('kcalAuto')}
      </label>
      {!estimate && <p class="muted small">{t('kcalAutoHint')}</p>}
      <label>
        {t('dailyEnergy')}
        <input
          type="number"
          inputMode="numeric"
          min="800"
          max="6000"
          step="50"
          value={p.kcal}
          readOnly={!!p.kcalAuto}
          onChange={(e) => {
            const kcal = parseInt((e.currentTarget as HTMLInputElement).value, 10);
            if (kcal >= 800 && kcal <= 6000) save({ kcal });
          }}
        />
      </label>
      {estimate && !p.kcalAuto && (
        <p class="muted small">
          {t('kcalEstimate')}: {fmt(estimate)} kcal
        </p>
      )}
      <p class="muted small">{t('targetsNote')}</p>
    </section>
  );
}
