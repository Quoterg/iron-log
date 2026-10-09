import { useEffect, useRef, useState } from 'preact/hooks';
import type { Meal } from '../lib/db';
import { fmt, lang, nutrientName, parseNum, t } from '../lib/i18n';
import type { Food } from '../lib/nutrients';
import { NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { implausible, LABEL, offSession, OffWriteError, shrink, uploadProduct } from '../lib/off-write';
import { to, type OffKey } from '../lib/strings-off';
import { replaceTop } from '../nav';
import { rememberOffFood } from '../state';
import { Sheet } from './Sheet';

type Problem = 'missingName' | 'missingKcal' | 'missingLogin' | 'number' | 'macros' | 'parts' | 'sum' | 'kcal';
const PROBLEM_TEXT: Record<Problem, OffKey> = {
  missingName: 'offMissingName',
  missingKcal: 'offMissingKcal',
  missingLogin: 'offMissingLogin',
  number: 'offUploadInvalid',
  macros: 'offCheckMacros',
  parts: 'offCheckParts',
  sum: 'offCheckSum',
  kcal: 'offCheckKcal',
};
const SEND_ERROR: Record<OffWriteError['kind'], OffKey> = {
  login: 'offUploadLogin',
  network: 'offUploadNetwork',
  rejected: 'offUploadRejected',
};

/**
 * Add (or complete) a product on Open Food Facts from the app: the label's nutrition per 100 g,
 * photos of the front and the nutrition table, the user's OFF login. Afterwards the product is
 * logged like any scanned product. Loaded lazily.
 */
export default function OffUploadSheet({ code, meal }: { code: string; meal: Meal }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  // Photos are shrunk as soon as they're chosen (the cost is hidden while the rest is filled in).
  const photos = useRef<{ front?: Promise<Blob>; nutrition?: Promise<Blob> }>({});
  const [user, setUser] = useState(offSession.user ?? '');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<Problem | OffWriteError['kind'] | null>(null);
  const [done, setDone] = useState<{ food: Food; failed: number } | null>(null);
  const abort = useRef(new AbortController());
  useEffect(() => () => abort.current.abort(), []); // closing the sheet stops the upload

  const parsed = Object.fromEntries(LABEL.map(([k]) => [k, vals[k]?.trim() ? parseNum(vals[k]) : undefined]));

  const check = (): Problem | null => {
    if (!name.trim()) return 'missingName';
    if (parsed.kcal === undefined) return 'missingKcal';
    if (LABEL.some(([k]) => parsed[k] !== undefined && !(parsed[k]! >= 0))) return 'number';
    const why = implausible(parsed);
    if (why) return why;
    if (!user.trim() || !password) return 'missingLogin';
    return null;
  };

  const open = (food: Food) => replaceTop({ kind: 'food', ref: food.ref, meal });

  const send = async (e: Event) => {
    e.preventDefault();
    const p = check();
    setProblem(p);
    if (p) return;
    setSending(true);
    try {
      const [front, nutrition] = await Promise.all([photos.current.front, photos.current.nutrition]);
      const r = await uploadProduct(
        { code, name, brand, lang: lang.value, values: parsed },
        { user: user.trim(), password },
        { front, nutrition },
        { signal: abort.current.signal },
      );
      offSession.user = user.trim(); // the username only, for this app session
      setPassword('');
      await rememberOffFood(r.food);
      if (r.photosFailed.length) setDone({ food: r.food, failed: r.photosFailed.length });
      else open(r.food);
    } catch (err) {
      setProblem(err instanceof OffWriteError ? err.kind : 'rejected');
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <Sheet title={to('offUploadTitle')}>
        <div class="pad">
          <p role="status">{to('offPhotosFailed').replace('{n}', fmt(done.failed))}</p>
          <div class="actions">
            <button class="btn primary" onClick={() => open(done.food)}>
              {to('offContinue')}
            </button>
          </div>
        </div>
      </Sheet>
    );
  }

  const photoInput = (field: 'front' | 'nutrition', label: OffKey) => (
    <label class="field">
      <span>{to(label)}</span>
      {/* No `capture`: the phone offers both the camera and existing photos. */}
      <input
        type="file"
        accept="image/*"
        name={field}
        onChange={(e) => {
          const file = (e.currentTarget as HTMLInputElement).files?.[0];
          photos.current[field] = file ? shrink(file) : undefined;
        }}
      />
    </label>
  );

  const message = problem ? to(problem in PROBLEM_TEXT ? PROBLEM_TEXT[problem as Problem] : SEND_ERROR[problem as OffWriteError['kind']]) : null;

  return (
    <Sheet title={to('offUploadTitle')}>
      <form class="pad form" onSubmit={send} noValidate>
        <p class="muted small">
          {t('barcode')}: <span class="num">{code}</span>
        </p>
        <label class="field">
          <span>{t('name')}</span>
          <input type="text" name="product" value={name} autoFocus onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>{to('offBrand')}</span>
          <input type="text" name="brand" value={brand} onInput={(e) => setBrand((e.currentTarget as HTMLInputElement).value)} />
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
        {photoInput('front', 'offPhotoFront')}
        {photoInput('nutrition', 'offPhotoNutrition')}

        <h3>{to('offAccount')}</h3>
        <label class="field">
          <span>{to('offUser')}</span>
          <input type="text" name="username" autoComplete="username" value={user} onInput={(e) => setUser((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>{to('offPassword')}</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)}
          />
        </label>
        <p class="muted small">
          {to('offLoginNote')}{' '}
          <a href="https://world.openfoodfacts.org/cgi/user.pl" target="_blank" rel="noopener noreferrer">
            {to('offCreateAccount')}
          </a>
        </p>
        <p class="muted small">{to('offPublishNote')}</p>

        {message && (
          <p class="error-text" role="alert">
            {message}
          </p>
        )}
        <div class="actions">
          <button type="submit" class="btn primary" disabled={sending}>
            {sending ? to('offUploading') : to('offUploadSend')}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
