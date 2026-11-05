import type { ComponentChildren } from 'preact';
import { fmt, type Lang, lang, LANGS, t } from '../lib/i18n';
import { NUTRIENT_INDEX, value } from '../lib/nutrients';
import { open, type SettingsPageKind } from '../nav';
import { activeSources, customFoods, deleteRecipe, recipes, settings, templates, updateSettings } from '../state';
import { ts } from '../lib/strings-sync';
import { setTheme, themeChoice } from '../lib/theme';
import { tg } from '../lib/strings-suggest';
import { tf } from '../lib/strings-fruit';
import FRUIT_PERIOD from '../lib/fruit-period.json';
import { tc } from '../lib/strings-checkin';
import { tsh } from '../lib/strings-shop';
import { te } from '../lib/strings-energy';
import { goalText } from '../lib/strings-energy';
import { fmtMonth, TYPICAL_COLLECTED, TYPICAL_MONTH } from '../lib/typical-prices';
import { ensurePriceBook } from '../lib/cost';
import { APP_VERSION } from '../lib/version';
import { paceFor } from '../lib/targets';

/**
 * Settings, short (M44): five entries with a one-line summary each, every one opening its own page
 * (SettingsPage.tsx, a sheet, so the back button works as elsewhere). Loaded lazily (see app.tsx).
 */
export default function Settings() {
  const s = settings.value;
  const p = s.profile;
  const goal = s.goal ?? 'maintain';
  const mode = s.adaptive && s.adaptiveFollow ? 'follow' : p.kcalAuto ? 'profile' : 'manual';
  const on = FEATURES.filter((f) => f.on()).length;
  const foods = customFoods.value.filter((f) => !f.deleted).length;
  const recs = recipes.value.filter((r) => !r.deleted).length;
  const entries: [SettingsPageKind, string, string][] = [
    [
      'profile',
      t('settingsProfile'),
      [t(p.sex === 'female' ? 'female' : 'male'), p.age && t('ageYears').replace('{n}', String(p.age)), p.weightKg && `${fmt(p.weightKg, 1)} kg`, goalText(goal, paceFor(p, s.pace))]
        .filter(Boolean)
        .join(' · '),
    ],
    ['energy', t('settingsEnergy'), `${fmt(p.kcal)} kcal/${t('perDayShort')} · ${te(MODE_LABEL[mode])}`],
    ['features', t('settingsFeatures'), t('featuresOn').replace('{n}', String(on)).replace('{m}', String(FEATURES.length))],
    [
      'library',
      t('settingsLibrary'),
      t('librarySummary').replace('{foods}', String(foods)).replace('{recipes}', String(recs)).replace('{meals}', String(templates.value.length)),
    ],
    ['data', t('settingsData'), `${LANGS.find((l) => l.code === s.lang)?.name ?? ''} · ${t('settingsDataSummary')}`],
  ];
  return (
    <>
      {/* One-time notices (energy formula, goal) stay on the first page, not inside a sub-page. */}
      {s.energyNotice && (
        <div class="notice card" role="status">
          <p class="small">{t('energyNotice')}</p>
          <button type="button" class="btn small" onClick={() => void updateSettings({ energyNotice: false })}>
            {t('ok')}
          </button>
        </div>
      )}
      {s.goalNotice && (
        <div class="notice card" role="status">
          <p class="small">{te('goalNotice').replace('{kcal}', fmt(p.kcal))}</p>
          <button type="button" class="btn small" onClick={() => void updateSettings({ goalNotice: false })}>
            {t('ok')}
          </button>
        </div>
      )}
      <section class="card settings-menu">
        <ul class="entries">
          {entries.map(([page, title, summary]) => (
            <li key={page}>
              <button class="entry" onClick={() => open({ kind: 'settings', page })}>
                <span class="entry-name">
                  {title}
                  <span class="muted small summary">{summary}</span>
                </span>
                <span class="muted" aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p class="muted small center">
        Iron Log {APP_VERSION} ·{' '}
        <button type="button" class="link inline" onClick={() => open({ kind: 'whatsnew' })}>
          {t('whatsNew')}
        </button>
      </p>
    </>
  );
}

const MODE_LABEL = { manual: 'modeManual', profile: 'modeProfile', follow: 'modeFollow' } as const;

export function SyncCard() {
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

export function MyFoods() {
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

export function MyRecipes() {
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
            <li key={r.ref} class="ingredient">
              <button class="entry" onClick={() => open({ kind: 'recipe', ref: r.ref })}>
                <span class="entry-name">{r.name}</span>
                <span class="num muted">
                  {fmt(((r.per100g[NUTRIENT_INDEX.kcal] ?? 0) * r.portionG) / 100)} kcal / {t('portionShort')}
                </span>
              </button>
              {/* Delete right in the list (M41): in the editor it sits below the ingredients, easy to miss. */}
              <button
                class="btn small"
                aria-label={`${t('remove')} ${r.name}`}
                onClick={() => confirm(t('confirmDeleteRecipe')) && void deleteRecipe(r.ref)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Saved meals (rename, drop foods, remove; created from a logged meal). "Your usual" is a feature (M44). */
export function SavedMealsCard() {
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
    </section>
  );
}

/** Where the fruit in season may come from (M40): Swedish, Sweden + Europe (default), the whole world. */
const FRUIT_REACHES = [['sweden', 'reachSweden'], ['europe', 'reachEurope'], ['any', 'reachAny']] as const;

/** An optional feature: its switch on one line, the explanation behind "Läs mer" (M44). */
interface Feature {
  id: string;
  label: () => string;
  on: () => boolean;
  set: (on: boolean) => void;
  /** Shown under the switch while on (e.g. the fruit's origin choice). */
  extra?: () => ComponentChildren;
  more: () => ComponentChildren;
}

const FEATURES: Feature[] = [
  {
    id: 'suggestions',
    label: () => tg('suggestToggle'),
    on: () => !!settings.value.suggestions,
    set: (on) => void updateSettings({ suggestions: on }),
    // Foods hidden with "Föreslå inte … igen" (M43) can come back.
    extra: () =>
      !!settings.value.suggestHidden?.length && (
        <button class="btn small" onClick={() => void updateSettings({ suggestHidden: [] })}>
          {tg('suggestUnhide').replace('{n}', String(settings.value.suggestHidden.length))}
        </button>
      ),
    more: () => <p class="muted small">{tg('suggestNote')}</p>,
  },
  {
    id: 'fruit',
    label: () => tf('fruitToggle'),
    on: () => !!settings.value.fruit,
    set: (on) => void updateSettings({ fruit: on }),
    extra: () => (
      <div class="chips" role="group" aria-label={tf('fruitReach')}>
        {FRUIT_REACHES.map(([r, label]) => {
          const on = (settings.value.fruitReach ?? 'europe') === r;
          return (
            <button key={r} class={on ? 'chip on' : 'chip'} aria-pressed={on} onClick={() => void updateSettings({ fruitReach: r })}>
              {tf(label)}
            </button>
          );
        })}
      </div>
    ),
    more: () => (
      <>
        <p class="muted small">{tf('fruitNote')}</p>
        <p class="muted small">{tf('fruitSource').replace('{period}', FRUIT_PERIOD.period.split('–').map(fmtMonth).join('–'))}</p>
      </>
    ),
  },
  {
    id: 'costs',
    label: () => tsh('costsToggle'),
    on: () => !!settings.value.costs,
    set: (on) => {
      void updateSettings({ costs: on });
      if (on) ensurePriceBook(); // loaded (and cached for offline use) now
    },
    more: () => (
      <>
        <p class="muted small">{tsh('costsNote')}</p>
        <p class="muted small">{tsh('costsSource').replace('{date}', TYPICAL_COLLECTED).replace('{month}', fmtMonth(TYPICAL_MONTH))}</p>
      </>
    ),
  },
  {
    id: 'checkin',
    label: () => tc('checkinToggle'),
    on: () => !!settings.value.checkin,
    set: (on) => void updateSettings({ checkin: on }),
    more: () => <p class="muted small">{tc('checkinNote')}</p>,
  },
  {
    id: 'usual',
    label: () => t('usualSetting'),
    on: () => !settings.value.usualOff,
    set: (on) => void updateSettings({ usualOff: !on }),
    more: () => <p class="muted small">{t('usualSettingNote')}</p>,
  },
  {
    id: 'whatIf',
    label: () => tg('whatIfToggle'),
    on: () => !settings.value.whatIfOff,
    set: (on) => void updateSettings({ whatIfOff: !on }),
    more: () => <p class="muted small">{t('whatIfNote')}</p>,
  },
];

/** Every optional feature on one line (M44). */
export function FeatureList() {
  return (
    <section class="card form features">
      {FEATURES.map((f) => (
        <div class="feature" key={f.id}>
          <label class="check">
            <input type="checkbox" checked={f.on()} onChange={(e) => f.set((e.currentTarget as HTMLInputElement).checked)} />
            {f.label()}
          </label>
          {f.on() && f.extra?.()}
          <details class="feature-more">
            <summary class="small">{t('readMore')}</summary>
            {f.more()}
          </details>
        </div>
      ))}
    </section>
  );
}

export function General() {
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
