import { fmt, t, type Lang } from '../lib/i18n';
import { value } from '../lib/nutrients';
import { open } from '../nav';
import { customFoods, settings, updateSettings } from '../state';
import { ProfileForm } from './ProfileForm';
import { YourData } from './YourData';

export function Settings() {
  return (
    <>
      <ProfileForm />
      <MyFoods />
      <General />
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

function General() {
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
      <p class="muted small">{t('privacy')}</p>
      <p class="muted small">{t('attribution')}</p>
      <p class="muted small">{t('attributionOff')}</p>
    </section>
  );
}
