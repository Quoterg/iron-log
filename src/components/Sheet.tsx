import type { ComponentChildren } from 'preact';
import { t } from '../lib/i18n';
import { back } from '../nav';

/** Full-screen layer with a back button; closing goes through history (see nav.ts). */
export function Sheet({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
      <header class="sheet-head">
        <button class="btn small" onClick={back}>
          ‹ {t('back')}
        </button>
        <h2>{title}</h2>
      </header>
      {children}
    </div>
  );
}
