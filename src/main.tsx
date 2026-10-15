import { render } from 'preact';
import { App, searchView, bodyView, contributorsView, copyView, foodEditorView, recipeEditorView, scanView, settingsView, targetEditorView, templateView } from './app';
import { captureInstallPrompt } from './lib/install';
import { warmUp } from './lib/foods';
import { lang, lastLang, loadLang } from './lib/i18n';
import { initNav, open, stack } from './nav';
import { addWater, clock, date, enableUsual, loadDay, loadLibrary, loadServings, loadSettings, loadTemplates, loadUsage, settings } from './state';
import { ensurePriceBook } from './lib/cost';
import { getSettings, hasEntries, isoDate } from './lib/db';
import { mealAt } from './lib/usual';
import { applyTheme, watchSystemTheme } from './lib/theme';
import './styles.css';

async function start() {
  initNav();
  applyTheme(); // the boot script already set it; this also sets the bar colour
  watchSystemTheme();
  captureInstallPrompt();
  // Only Swedish is built in; other languages are a small chunk each (cached after first use).
  // Fetch the likely one (last used here, else the browser's) while settings are read, so the
  // pack isn't a second round trip before first paint. If it can't load (offline before it was
  // ever cached), start anyway with the built-in strings.
  const early = loadLang(lastLang() ?? lang.value).catch(() => {});
  await loadSettings();
  await Promise.all([early, loadLang(lang.value).catch(() => {})]);
  document.documentElement.lang = lang.value;
  // Small local tables, loaded before first render so every screen starts with complete data
  // (custom foods are also needed to resolve diary entries, including deleted ones).
  await Promise.all([loadLibrary(), loadUsage(), loadServings()]);
  render(<App />, document.getElementById('app')!);
  await loadDay(date.value);
  runShortcut();
  showWhatsNew().catch(() => {}); // offline and not cached yet: next start
  // Back in the foreground: time-of-day suggestions follow the clock, and a new day shows today.
  let shownToday = isoDate(new Date());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const today = isoDate(new Date());
    if (today !== shownToday && date.value === shownToday) void loadDay(today);
    else clock.value = Date.now();
    shownToday = today;
  });
  void loadTemplates(); // only the add sheet and Settings use them
  // Load the food database in the background once the diary is on screen.
  requestIdleCallbackShim(() => {
    // Food databases first (loaded and indexed in the worker); the split-out screens are small and
    // go a moment later, so the service worker has them for offline use.
    warmUp(lang.value);
    void searchView.prefetch(); // opened by every "Lägg till"
    setTimeout(() => {
      void settingsView.prefetch();
      void targetEditorView.prefetch();
      void recipeEditorView.prefetch();
      void bodyView.prefetch();
      void contributorsView.prefetch();
      void templateView.prefetch();
      void scanView.prefetch();
      void foodEditorView.prefetch();
      void copyView.prefetch();
      if (settings.value.costs) ensurePriceBook(); // food cost (M34): prices for the diary
      if (settings.value.adaptive && settings.value.adaptiveFollow) void import('./lib/follow').then((m) => m.runFollow()).catch(() => {});
      enableUsual(); // after the food data started loading: it competes with nothing on screen
    }, 1500);
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  }
  // Ask the browser not to evict our local data (matters on iOS/low-storage devices).
  void navigator.storage?.persist?.();
}

/** Once after a release (a new version in package.json): what's new since the version last seen. */
async function showWhatsNew() {
  if (stack.value.length) return; // a shortcut opened a sheet: next start instead
  const { markSeen, whatsNewSince } = await import('./lib/version'); // not needed for first paint
  const since = await whatsNewSince(async () => !!(await getSettings()) || (await hasEntries()));
  // The user may have opened a sheet meanwhile (slow storage): then it's shown next start.
  if (since && !stack.value.length) {
    open({ kind: 'whatsnew', since });
    markSeen();
  }
}

/** Home-screen shortcuts (manifest.webmanifest): `?add` opens the add sheet, `?water` adds 2 dl. */
function runShortcut() {
  const q = new URLSearchParams(location.search);
  if (!q.has('add') && !q.has('water')) return;
  // Drop the query first, so a reload doesn't run it again.
  history.replaceState(history.state, '', location.pathname + location.hash);
  // Water goes to today (the diary opens on today; be explicit anyway).
  if (q.has('water')) void loadDay(isoDate(new Date())).then(() => addWater(200));
  else open({ kind: 'search', meal: mealAt(new Date()) });
}

function requestIdleCallbackShim(fn: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 300);
}

void start();
