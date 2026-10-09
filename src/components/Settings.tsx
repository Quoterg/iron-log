import { fmt, t, type Lang } from '../lib/i18n';
import { value } from '../lib/nutrients';
import { defaultKcal, type Sex } from '../lib/targets';
import { open } from '../nav';
import { customFoods, settings, updateSettings } from '../state';
import { YourData } from './YourData';

export function Settings() {
  return (
    <>
      <MyFoods />
      <Profile />
      <YourData />
    </>
  );
}

function MyFoods() {
  const list = customFoods.value.filter((f) => !f.deleted).sort((a, b) => a.sv.localeCompare(b.sv, 'sv'));
  return (
    <section class="card">
      <header class="meal-head">
        <h2>{t('myFoods')}</h2>
        <button class="btn small" onClick={() => open({ kind: 'editFood' })}>
          + {t('createFood')}
        </button>
      </header>
      {list.length === 0 ? (
        <p class="muted small">{t('noCustomFoods')}</p>
      ) : (
        <ul class="entries">
          {list.map((f) => (
            <li key={f.ref}>
              <button class="entry" onClick={() => open({ kind: 'editFood', ref: f.ref })}>
                <span class="entry-name">{f.sv}</span>
                <span class="num muted">{fmt(value(f.per100g, 'kcal'))} kcal / 100 g</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Profile() {
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
