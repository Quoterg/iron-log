import { fmt, t, type Lang } from '../lib/i18n';
import { NUTRIENT_INDEX, value } from '../lib/nutrients';
import { open } from '../nav';
import { customFoods, recipes, settings, updateSettings } from '../state';
import { ProfileForm } from './ProfileForm';
import { YourData } from './YourData';

/** Loaded lazily (see app.tsx): not needed for the first screen. */
export default function Settings() {
  return (
    <>
      <ProfileForm />
      <MyFoods />
      <MyRecipes />
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

function MyRecipes() {
  const list = recipes.value.filter((r) => !r.deleted).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  return (
    <section class="card">
      <header class="meal-head">
        <h2>{t('myRecipes')}</h2>
        <button class="btn small" onClick={() => open({ kind: 'recipe' })}>
          + {t('createRecipe')}
        </button>
      </header>
      {list.length === 0 ? (
        <p class="muted small">{t('noRecipes')}</p>
      ) : (
        <ul class="entries">
          {list.map((r) => (
            <li key={r.ref}>
              <button class="entry" onClick={() => open({ kind: 'recipe', ref: r.ref })}>
                <span class="entry-name">{r.name}</span>
                <span class="num muted">
                  {fmt(((r.per100g[NUTRIENT_INDEX.kcal] ?? 0) * r.portionG) / 100)} kcal / {t('portionShort')}
                </span>
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
