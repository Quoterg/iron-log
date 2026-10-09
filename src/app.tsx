import { addDays, isoDate } from './lib/db';
import { lang, t } from './lib/i18n';
import { AddFood } from './components/AddFood';
import { Diary } from './components/Diary';
import { Nutrients } from './components/Nutrients';
import { Settings } from './components/Settings';
import { addingTo, date, loadDay, view, type View } from './state';

const TABS: View[] = ['diary', 'nutrients', 'settings'];

export function App() {
  return (
    <>
      <header class="top">
        {view.value === 'settings' ? <h1>{t('settings')}</h1> : <DateNav />}
      </header>
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
      {addingTo.value && <AddFood />}
    </>
  );
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
