import { t, type Lang } from '../lib/i18n';
import { defaultKcal, type Sex } from '../lib/targets';
import { settings, updateSettings } from '../state';

export function Settings() {
  const s = settings.value;
  return (
    <section class="card form">
      <label>
        {t('language')}
        <select
          value={s.lang}
          onChange={(e) => void updateSettings({ lang: (e.currentTarget as HTMLSelectElement).value as Lang })}
        >
          <option value="sv">Svenska</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        {t('sex')}
        <select
          value={s.profile.sex}
          onChange={(e) => {
            const sex = (e.currentTarget as HTMLSelectElement).value as Sex;
            void updateSettings({ profile: { sex, kcal: defaultKcal(sex) } });
          }}
        >
          <option value="female">{t('female')}</option>
          <option value="male">{t('male')}</option>
        </select>
      </label>
      <label>
        {t('dailyEnergy')}
        <input
          type="number"
          inputMode="numeric"
          min="800"
          max="6000"
          step="50"
          value={s.profile.kcal}
          onChange={(e) => {
            const kcal = parseInt((e.currentTarget as HTMLInputElement).value, 10);
            if (kcal >= 800 && kcal <= 6000) void updateSettings({ profile: { ...s.profile, kcal } });
          }}
        />
      </label>
      <p class="muted small">{t('targetsNote')}</p>
      <p class="muted small">{t('privacy')}</p>
      <p class="muted small">{t('attribution')}</p>
    </section>
  );
}
