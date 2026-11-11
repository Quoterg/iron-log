// Code-splitting without preact/compat: a component that loads its module on first render.
// `prefetch()` loads it ahead of time (e.g. when idle) so the service worker caches the chunk
// and the screen also opens instantly offline.
import { signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import { t } from './lib/i18n';

// A page being left (reload, navigation) aborts in-flight imports: that is not a failure, and must
// never start a second reload of its own (it would abort the one under way; seen in CI, M52a).
let leaving = false;
addEventListener('beforeunload', () => (leaving = true));
addEventListener('pagehide', () => (leaving = true));
addEventListener('pageshow', () => (leaving = false)); // back from the back/forward cache

export function lazyView<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  const comp = signal<ComponentType<P> | null>(null);
  const failed = signal(false);
  let pending: Promise<void> | undefined;
  // The later screens' Swedish strings come with any of them (M39b; one shared chunk).
  const prefetch = () =>
    (pending ??= Promise.all([load(), import('./lib/strings-later')]).then(([m]) => m).then(
      (m) => {
        failed.value = false;
        comp.value = m.default;
      },
      () => {
        pending = undefined; // allow a retry, e.g. after coming back online
        if (!leaving) failed.value = true;
      },
    ));
  function Lazy(props: P) {
    const C = comp.value;
    if (C) return <C {...props} />;
    if (failed.value) {
      // Opened (not just prefetched in the background, which must never reload under the user).
      reloadOnce();
      return (
        <div class="pad center">
          <p class="muted">{t('loadFailed')}</p>
          <button
            class="btn"
            onClick={() => {
              failed.value = false; // show "Laddar…" while retrying
              void prefetch();
            }}
          >
            {t('retry')}
          </button>
        </div>
      );
    }
    void prefetch();
    return <p class="muted center">{t('loading')}</p>;
  }
  return { Lazy, prefetch };
}

/**
 * Online but a screen being opened couldn't load its code: most likely the version running was
 * replaced on the server (its files are gone). Reload once per session, which starts the current
 * version (M39). Offline (or after that one reload): the "couldn't load, retry" message instead.
 */
function reloadOnce() {
  if (!navigator.onLine || leaving) return;
  try {
    if (sessionStorage.getItem('il-reloaded')) return;
    sessionStorage.setItem('il-reloaded', '1');
  } catch {
    return;
  }
  location.reload();
}
