import { releasesSince } from '../changelog';
import { lang, locale, t } from '../lib/i18n';
import { back } from '../nav';
import { Sheet } from './Sheet';

/** What's new (M32): releases newer than `since` (shown once after an update), else the latest ones. */
export default function WhatsNew({ since }: { since?: string | null }) {
  const date = (iso: string) => new Date(`${iso}T12:00`).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Sheet title={t('whatsNew')}>
      <div class="pad">
        {releasesSince(since ?? null).map((r) => (
          <section class="card" key={r.version}>
            <h3>{t('whatsNewIn').replace('{v}', r.version)}</h3>
            <p class="muted small">{date(r.date)}</p>
            <ul class="news">
              {r.notes[lang.value].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        ))}
        <button class="btn primary" onClick={back}>
          {t('ok')}
        </button>
      </div>
    </Sheet>
  );
}
