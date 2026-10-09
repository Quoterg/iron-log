import { useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { lang, nutrientName, parseNum, t } from '../lib/i18n';
import { NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { LABEL, offSession, OffWriteError, uploadProduct } from '../lib/off-write';
import { replaceTop } from '../nav';
import { rememberOffFood } from '../state';
import { to } from '../lib/strings-off';
import { Sheet } from './Sheet';

/**
 * Add (or complete) a product on Open Food Facts from the app: the label's nutrition per 100 g,
 * photos of the front and the nutrition table, the user's OFF login. Afterwards the product is
 * logged like any scanned product. Loaded lazily.
 */
export default function OffUploadSheet({ code, meal }: { code: string; meal: Meal }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const front = useRef<File | undefined>();
  const nutrition = useRef<File | undefined>();
  const [user, setUser] = useState(offSession.login?.user ?? '');
  const [password, setPassword] = useState(offSession.login?.password ?? '');
  const [state, setState] = useState<'edit' | 'sending' | OffWriteError['kind'] | 'invalid'>('edit');

  const parsed = Object.fromEntries(LABEL.map(([k]) => [k, vals[k]?.trim() ? parseNum(vals[k]) : undefined]));
  const badNumber = LABEL.some(([k]) => parsed[k] !== undefined && !(parsed[k]! >= 0));
  const ready = name.trim() && parsed.kcal !== undefined && !badNumber && user.trim() && password;

  const send = async (e: Event) => {
    e.preventDefault();
    if (!ready) return setState('invalid');
    setState('sending');
    const login = { user: user.trim(), password };
    try {
      const food = await uploadProduct(
        { code, name, brand, lang: lang.value, values: parsed },
        login,
        { front: front.current, nutrition: nutrition.current },
      );
      offSession.login = login; // for this app session only (memory), so a second product needn't ask again
      await rememberOffFood(food);
      replaceTop({ kind: 'food', ref: food.ref, meal });
    } catch (err) {
      setState(err instanceof OffWriteError ? err.kind : 'rejected');
    }
  };

  const error: Partial<Record<typeof state, string>> = {
    login: to('offUploadLogin'),
    network: to('offUploadNetwork'),
    rejected: to('offUploadRejected'),
    invalid: to('offUploadInvalid'),
  };

  return (
    <Sheet title={to('offUploadTitle')}>
      <form class="pad form" onSubmit={send} noValidate>
        <p class="muted small">
          {t('barcode')}: <span class="num">{code}</span>
        </p>
        <label class="field">
          <span>{t('name')}</span>
          <input type="text" value={name} autoFocus onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>{to('offBrand')}</span>
          <input type="text" value={brand} onInput={(e) => setBrand((e.currentTarget as HTMLInputElement).value)} />
        </label>

        <h3>{t('nutrientsPer100g')}</h3>
        <div class="grid2">
          {LABEL.map(([key]) => {
            const n = NUTRIENTS[NUTRIENT_INDEX[key]];
            return (
              <label key={key} class="field">
                <span>
                  {nutrientName(n)} ({n.unit})
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={vals[key] ?? ''}
                  onInput={(e) => setVals({ ...vals, [key]: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
            );
          })}
        </div>

        <h3>{to('offPhotos')}</h3>
        <label class="field">
          <span>{to('offPhotoFront')}</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => (front.current = (e.currentTarget as HTMLInputElement).files?.[0])} />
        </label>
        <label class="field">
          <span>{to('offPhotoNutrition')}</span>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => (nutrition.current = (e.currentTarget as HTMLInputElement).files?.[0])} />
        </label>

        <h3>{to('offAccount')}</h3>
        <label class="field">
          <span>{to('offUser')}</span>
          <input type="text" autoComplete="username" value={user} onInput={(e) => setUser((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>{to('offPassword')}</span>
          <input type="password" autoComplete="current-password" value={password} onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <p class="muted small">
          {to('offLoginNote')}{' '}
          <a href="https://world.openfoodfacts.org/cgi/user.pl" target="_blank" rel="noopener noreferrer">
            {to('offCreateAccount')}
          </a>
        </p>
        <p class="muted small">{to('offPublishNote')}</p>

        {error[state] && (
          <p class="error-text" role="alert">
            {error[state]}
          </p>
        )}
        <div class="actions">
          <button type="submit" class="btn primary" disabled={state === 'sending'}>
            {state === 'sending' ? to('offUploading') : to('offUploadSend')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
