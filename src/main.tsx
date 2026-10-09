import { render } from 'preact';
import { App, recipeEditorView, settingsView, targetEditorView } from './app';
import { captureInstallPrompt } from './lib/install';
import { warmUp } from './lib/foods';
import { lang } from './lib/i18n';
import { initNav } from './nav';
import { date, loadDay, loadLibrary, loadServings, loadSettings, loadUsage } from './state';
import './styles.css';

async function start() {
  initNav();
  captureInstallPrompt();
  await loadSettings();
  document.documentElement.lang = lang.value;
  // Small local tables, loaded before first render so every screen starts with complete data
  // (custom foods are also needed to resolve diary entries, including deleted ones).
  await Promise.all([loadLibrary(), loadUsage(), loadServings()]);
  render(<App />, document.getElementById('app')!);
  await loadDay(date.value);
  // Load the food database in the background once the diary is on screen.
  requestIdleCallbackShim(() => {
    // Food database first (search needs it); then the split-out screens, so the service worker
    // has them for offline use without competing with the food download on a slow connection.
    void warmUp()
      .catch(() => {})
      .then(() => {
        void settingsView.prefetch();
        void targetEditorView.prefetch();
        void recipeEditorView.prefetch();
      });
  });
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  }
  // Ask the browser not to evict our local data (matters on iOS/low-storage devices).
  void navigator.storage?.persist?.();
}

function requestIdleCallbackShim(fn: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 300);
}

void start();
