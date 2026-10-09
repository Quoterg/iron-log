import { render } from 'preact';
import { App, bodyView, contributorsView, recipeEditorView, settingsView, targetEditorView } from './app';
import { captureInstallPrompt } from './lib/install';
import { warmUp } from './lib/foods';
import { lang, loadLang } from './lib/i18n';
import { initNav } from './nav';
import { date, loadDay, loadLibrary, loadServings, loadSettings, loadUsage } from './state';
import './styles.css';

async function start() {
  initNav();
  captureInstallPrompt();
  await loadSettings();
  // Only Swedish is built in; other languages are a small chunk each (cached after first use).
  // If it can't load (offline before it was ever cached), start anyway with the built-in strings.
  await loadLang(lang.value).catch(() => {});
  document.documentElement.lang = lang.value;
  // Small local tables, loaded before first render so every screen starts with complete data
  // (custom foods are also needed to resolve diary entries, including deleted ones).
  await Promise.all([loadLibrary(), loadUsage(), loadServings()]);
  render(<App />, document.getElementById('app')!);
  await loadDay(date.value);
  // Load the food database in the background once the diary is on screen.
  requestIdleCallbackShim(() => {
    // Food databases first (loaded and indexed in the worker); the split-out screens are small and
    // go a moment later, so the service worker has them for offline use.
    warmUp(lang.value);
    setTimeout(() => {
      void settingsView.prefetch();
      void targetEditorView.prefetch();
      void recipeEditorView.prefetch();
      void bodyView.prefetch();
      void contributorsView.prefetch();
    }, 1500);
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
