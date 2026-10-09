import { addDays, isoDate } from './lib/db';
import { lang, t } from './lib/i18n';
import { CopySheet } from './components/CopySheet';
import { Diary } from './components/Diary';
import { FoodDetail } from './components/FoodDetail';
import { FoodEditor } from './components/FoodEditor';
import { FoodSearch } from './components/FoodSearch';
import { Nutrients } from './components/Nutrients';
import { ScanSheet } from './components/ScanSheet';
import { lazyView } from './lazy';
import { stack, top, type Screen } from './nav';
import { date, loadDay, supplementRefs, view, type View } from './state';

const TABS: View[] = ['diary', 'nutrients', 'body', 'settings'];

// Not needed for the first screen: split out and prefetched when idle (main.tsx).
export const settingsView = lazyView(() => import('./components/Settings'));
export const targetEditorView = lazyView(() => import('./components/TargetEditor'));
export const recipeEditorView = lazyView(() => import('./components/RecipeEditor'));
export const bodyView = lazyView(() => import('./components/BodyView'));

/** Start loading a split-out tab on touch, before the click lands. */
const PREFETCH: Partial<Record<View, () => void>> = {
  settings: () => void settingsView.prefetch(),
  body: () => void bodyView.prefetch(),
};
export const contributorsView = lazyView(() => import('./components/Contributors'));
export const activityView = lazyView(() => import('./components/ActivitySheet'));
export const supplementView = lazyView(() => import('./components/SupplementEditor'));
export const syncView = lazyView(() => import('./components/SyncSheet'));

export function App() {
  const s = top.value;
  return (
    <>
      {/* Stays rendered under the full-screen sheet so its scroll position survives. */}
      <div aria-hidden={!!s}>
        <header class="top">
          {view.value === 'settings' || view.value === 'body' ? <h1>{t(view.value)}</h1> : <DateNav />}
        </header>
        <main>
          {view.value === 'diary' && <Diary />}
          {view.value === 'nutrients' && <Nutrients />}
          {view.value === 'body' && <bodyView.Lazy />}
          {view.value === 'settings' && <settingsView.Lazy />}
        </main>
        <nav class="tabs">
          {TABS.map((v) => (
            <button
              key={v}
              class={view.value === v ? 'active' : ''}
              // Start loading Settings on touch, before the click lands.
              onPointerDown={PREFETCH[v]}
              onClick={() => (view.value = v)}
            >
              {t(v)}
            </button>
          ))}
        </nav>
      </div>
      {/* Every sheet in the stack stays mounted (only the top is shown), so going back
          restores it as it was, e.g. the search query and results. */}
      {stack.value.map((screen, i) => (
        <div key={i} hidden={i !== stack.value.length - 1}>
          <ScreenView screen={screen} />
        </div>
      ))}
    </>
  );
}

function ScreenView({ screen: s }: { screen: Screen }) {
  // replaceTop can turn an editor into a detail screen at the same depth: remount by kind.
  switch (s.kind) {
    case 'search':
      return <FoodSearch meal={s.meal} replaceEntryId={s.replaceEntryId} pickIngredient={s.pickIngredient} />;
    case 'food':
      return (
        <FoodDetail foodRef={s.ref} meal={s.meal} entryId={s.entryId} ingredient={s.ingredient} ingredientIndex={s.ingredientIndex} />
      );
    case 'editFood':
      // Supplements have per-unit values: never edit them as per-100 g foods.
      if (s.ref && supplementRefs.value.has(s.ref)) return <supplementView.Lazy foodRef={s.ref} />;
      return <FoodEditor foodRef={s.ref} name={s.name} meal={s.meal} />;
    case 'copy':
      return <CopySheet meal={s.meal} />;
    case 'scan':
      return <ScanSheet meal={s.meal} />;
    case 'targets':
      return <targetEditorView.Lazy />;
    case 'recipe':
      return <recipeEditorView.Lazy recipeRef={s.ref} meal={s.meal} />;
    case 'contributors':
      return <contributorsView.Lazy nutrient={s.key} from={s.from} to={s.to} />;
    case 'activity':
      return <activityView.Lazy />;
    case 'supplement':
      return <supplementView.Lazy foodRef={s.ref} />;
    case 'sync':
      return <syncView.Lazy />;
  }
}

function DateNav() {
  const d = date.value;
  return (
    <div class="datenav">
      <button class="btn icon" aria-label={t('prevDay')} onClick={() => void loadDay(addDays(d, -1))}>
        ‹
      </button>
      <button class="date" onClick={() => void loadDay(isoDate(new Date()))}>
        {dayLabel(d)}
      </button>
      <button class="btn icon" aria-label={t('nextDay')} onClick={() => void loadDay(addDays(d, 1))}>
        ›
      </button>
    </div>
  );
}

function dayLabel(d: string): string {
  const today = isoDate(new Date());
  if (d === today) return t('today');
  if (d === addDays(today, -1)) return t('yesterday');
  if (d === addDays(today, 1)) return t('tomorrow');
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(lang.value === 'sv' ? 'sv-SE' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
