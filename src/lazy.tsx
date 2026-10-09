// Code-splitting without preact/compat: a component that loads its module on first render.
// `prefetch()` loads it ahead of time (e.g. when idle) so the service worker caches the chunk
// and the screen also opens instantly offline.
import { signal } from '@preact/signals';
import type { ComponentType } from 'preact';
import { t } from './lib/i18n';

export function lazyView<P extends object>(load: () => Promise<{ default: ComponentType<P> }>) {
  const comp = signal<ComponentType<P> | null>(null);
  let pending: Promise<void> | undefined;
  const prefetch = () =>
    (pending ??= load().then(
      (m) => void (comp.value = m.default),
      () => void (pending = undefined), // allow a retry, e.g. after coming back online
    ));
  function Lazy(props: P) {
    const C = comp.value;
    if (!C) {
      void prefetch();
      return <p class="muted center">{t('loading')}</p>;
    }
    return <C {...props} />;
  }
  return { Lazy, prefetch };
}
