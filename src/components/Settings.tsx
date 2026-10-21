import { fmt, type Lang, lang, LANGS, t } from '../lib/i18n';
import { NUTRIENT_INDEX, value } from '../lib/nutrients';
import { open } from '../nav';
import { activeSources, customFoods, recipes, settings, templates, updateSettings } from '../state';
import { ProfileForm } from './ProfileForm';
import { AdaptiveEnergy } from './AdaptiveEnergy';
import { YourData } from './YourData';
import { ts } from '../lib/strings-sync';
import { setTheme, themeChoice } from '../lib/theme';
import { tg } from '../lib/strings-suggest';
import { tf } from '../lib/strings-fruit';
import FRUIT_PERIOD from '../lib/fruit-period.json';
import { tc } from '../lib/strings-checkin';
import { tsh } from '../lib/strings-shop';
import { fmtMonth, TYPICAL_COLLECTED, TYPICAL_MONTH } from '../lib/typical-prices';
import { ensurePriceBook } from '../lib/cost';
import { APP_VERSION } from '../lib/version';

/** Loaded lazily (see app.tsx): not needed for the first screen. */
export default function Settings() {
  return (
    <>
      <ProfileForm />
      <AdaptiveEnergy />
      <MyFoods />
      <MyRecipes />
      <SavedMealsCard />
      <SuggestCard />
      <CheckinCard />
      <CostsCard />
      <General />
      <SyncCard />
      <YourData />
    </>
  );
}

function SyncCard() {
  return (
    <section class="card">
      <h2>{ts('syncTitle')}</h2>
      <p class="muted small">{ts('syncCardIntro')}</p>
      <button class="btn wide" onClick={() => open({ kind: 'sync' })}>
        {ts('syncStart')}
      </button>
    </section>
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

/** Saved meals (rename, drop foods, remove; created from a logged meal) and the "your usual" switch. */
function SavedMealsCard() {
  const list = [...templates.value].sort((a, b) => a.name.localeCompare(b.name, lang.value));
  return (
    <section class="card">
      <header class="meal-head">
        <h2>{t('savedMeals')}</h2>
      </header>
      {list.length === 0 ? (
        <p class="muted small">{t('noSavedMeals')}</p>
      ) : (
        <ul class="entries">
          {list.map((m) => (
            <li key={m.id}>
              <button class="entry" onClick={() => open({ kind: 'template', id: m.id })}>
                <span class="entry-name">{m.name}</span>
                <span class="num muted">{t('foodsCount').replace('{n}', String(m.items.length))}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <label class="check">
        <input type="checkbox" checked={!settings.value.usualOff} onChange={(e) => void updateSettings({ usualOff: !(e.currentTarget as HTMLInputElement).checked })} />
        {t('usualSetting')}
      </label>
      <p class="muted small">{t('usualSettingNote')}</p>
    </section>
  );
}

/** Where the fruit in season may come from (M40): Swedish, Sweden + Europe (default), the whole world. */
const FRUIT_REACHES = [['sweden', 'reachSweden'], ['europe', 'reachEurope'], ['any', 'reachAny']] as const;

/** Suggestions (opt-in) and the "what if" preview (on by default). */
function SuggestCard() {
  const s = settings.value;
  return (
    <section class="card form">
      <h2>{tg('suggestTitle')}</h2>
      <label class="check">
        <input type="checkbox" checked={!!s.suggestions} onChange={(e) => void updateSettings({ suggestions: (e.currentTarget as HTMLInputElement).checked })} />
        {tg('suggestToggle')}
      </label>
      <p class="muted small">{tg('suggestNote')}</p>
      <label class="check">
        <input type="checkbox" checked={!!s.fruit} onChange={(e) => void updateSettings({ fruit: (e.currentTarget as HTMLInputElement).checked })} />
        {tf('fruitToggle')}
      </label>
      {s.fruit && (
        <div class="chips" role="group" aria-label={tf('fruitReach')}>
          {FRUIT_REACHES.map(([r, label]) => {
            const on = (s.fruitReach ?? 'europe') === r;
            return (
              <button key={r} class={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => void updateSettings({ fruitReach: r })}>
                {tf(label)}
              </button>
            );
          })}
        </div>
      )}
      <p class="muted small">{tf('fruitNote')}</p>
      <p class="muted small">{tf('fruitSource').replace('{period}', FRUIT_PERIOD.period.split('–').map(fmtMonth).join('–'))}</p>
      <label class="check">
        <input type="checkbox" checked={!s.whatIfOff} onChange={(e) => void updateSettings({ whatIfOff: !(e.currentTarget as HTMLInputElement).checked })} />
        {tg('whatIfToggle')}
      </label>
    </section>
  );
}

/** Weekly check-in (opt-in, M26). */
function CheckinCard() {
  return (
    <section class="card form">
      <h2>{tc('checkinTitle')}</h2>
      <label class="check">
        <input type="checkbox" checked={!!settings.value.checkin} onChange={(e) => void updateSettings({ checkin: (e.currentTarget as HTMLInputElement).checked })} />
        {tc('checkinToggle')}
      </label>
      <p class="muted small">{tc('checkinNote')}</p>
    </section>
  );
}

/** Food costs (opt-in, M33): typical prices where the user typed none. */
function CostsCard() {
  return (
    <section class="card form">
      <h2>{tsh('costsTitle')}</h2>
      <label class="check">
        <input
          type="checkbox"
          checked={!!settings.value.costs}
          onChange={(e) => {
            const on = (e.currentTarget as HTMLInputElement).checked;
            void updateSettings({ costs: on });
            if (on) ensurePriceBook(); // loaded (and cached for offline use) now
          }}
        />
        {tsh('costsToggle')}
      </label>
      <p class="muted small">{tsh('costsNote')}</p>
      <p class="muted small">{tsh('costsSource').replace('{date}', TYPICAL_COLLECTED).replace('{month}', fmtMonth(TYPICAL_MONTH))}</p>
    </section>
  );
}

function General() {
  const s = settings.value;
  return (
    <section class="card form">
      <p class="muted theme-label">{t('appearance')}</p>
      <div class="chips" role="group" aria-label={t('appearance')}>
        {(['auto', 'day', 'night'] as const).map((c) => (
          <button key={c} type="button" class={themeChoice.value === c ? 'chip on' : 'chip'} aria-pressed={themeChoice.value === c} onClick={() => setTheme(c)}>
            {t(c === 'auto' ? 'themeAuto' : c === 'day' ? 'themeDay' : 'themeNight')}
          </button>
        ))}
      </div>
      <label>
        {t('language')}
        <select
          value={s.lang}
          onChange={(e) => {
            const sel = e.currentTarget as HTMLSelectElement;
            // Offline and the language was never loaded: stay on the current one.
            updateSettings({ lang: sel.value as Lang }).catch(() => (sel.value = settings.value.lang));
          }}
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <p class="muted small">
        {t('privacy')} <a href={lang.value === 'sv' ? 'privacy.html' : 'privacy.html#en'}>{t('privacyPolicy')}</a> ·{' '}
        <a href={lang.value === 'sv' ? 'about.html' : 'about.html#en'}>{t('aboutApp')}</a>
      </p>
      <p class="muted small">
        Iron Log {APP_VERSION} ·{' '}
        <button type="button" class="link inline" onClick={() => open({ kind: 'whatsnew' })}>
          {t('whatsNew')}
        </button>
      </p>
      <p class="muted small">{t('attribution')}</p>
      <fieldset class="sources">
        <legend>{t('foodDatabases')}</legend>
        {(['slv', 'usda'] as const).map((src, _, list) => {
          const active = activeSources(s);
          const on = active.includes(src);
          return (
            <label class="check" key={src}>
              <input
                type="checkbox"
                checked={on}
                // At least one database stays on.
                disabled={on && active.length === 1}
                onChange={(e) => {
                  const checked = (e.currentTarget as HTMLInputElement).checked;
                  const next = list.filter((x) => (x === src ? checked : active.includes(x)));
                  void updateSettings({ sources: next });
                }}
              />
              {t(src === 'slv' ? 'sourceNameSlv' : 'sourceNameUsda')}
            </label>
          );
        })}
      </fieldset>
      <p class="muted small">{t('attributionOff')}</p>
      <p class="muted small">{t('attributionUsda')}</p>
    </section>
  );
}
