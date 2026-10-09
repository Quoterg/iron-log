// Code-splitting without preact/compat: a component that loads its module on first render.
// `prefetch()` loads it ahead of time (e.g. when idle) so the service worker caches the chunk
// and the screen also opens instantly offline.
import { signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import { t } from './lib/i18n';

export function lazyView<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  const comp = signal<ComponentType<P> | null>(null);
  const failed = signal(false);
  let pending: Promise<void> | undefined;
  const prefetch = () =>
    (pending ??= load().then(
      (m) => {
        failed.value = false;
        comp.value = m.default;
      },
      () => {
        pending = undefined; // allow a retry, e.g. after coming back online
        failed.value = true;
      },
    ));
  function Lazy(props: P) {
    const C = comp.value;
    if (C) return <C {...props} />;
    if (failed.value) {
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
