import { addDays, isoDate } from './lib/db';
import { lang, t } from './lib/i18n';
import { Diary } from './components/Diary';
import { FoodDetail } from './components/FoodDetail';
import { FoodEditor } from './components/FoodEditor';
import { FoodSearch } from './components/FoodSearch';
import { Nutrients } from './components/Nutrients';
import { Settings } from './components/Settings';
import { stack, top, type Screen } from './nav';
import { date, loadDay, view, type View } from './state';

const TABS: View[] = ['diary', 'nutrients', 'settings'];

export function App() {
  const s = top.value;
  return (
    <>
      {/* Stays rendered under the full-screen sheet so its scroll position survives. */}
      <div aria-hidden={!!s}>
        <header class="top">{view.value === 'settings' ? <h1>{t('settings')}</h1> : <DateNav />}</header>
        <main>
          {view.value === 'diary' && <Diary />}
          {view.value === 'nutrients' && <Nutrients />}
          {view.value === 'settings' && <Settings />}
        </main>
        <nav class="tabs">
          {TABS.map((v) => (
            <button key={v} class={view.value === v ? 'active' : ''} onClick={() => (view.value = v)}>
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
      return <FoodSearch meal={s.meal} replaceEntryId={s.replaceEntryId} />;
    case 'food':
      return <FoodDetail foodRef={s.ref} meal={s.meal} entryId={s.entryId} />;
    case 'editFood':
      return <FoodEditor foodRef={s.ref} name={s.name} meal={s.meal} />;
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
