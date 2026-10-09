import { render } from 'preact';
import { App } from './app';
import { warmUp } from './lib/foods';
import { lang } from './lib/i18n';
import { date, loadDay, loadSettings } from './state';
import './styles.css';

async function start() {
  await loadSettings();
  document.documentElement.lang = lang.value;
  render(<App />, document.getElementById('app')!);
  await loadDay(date.value);
  // Load the food database in the background once the diary is on screen.
  requestIdleCallbackShim(warmUp);
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
