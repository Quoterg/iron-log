import { useRef } from 'preact/hooks';
import { fmt, parseNum, t } from '../lib/i18n';
import {
  defaultKcal,
  DEFAULT_PAL,
  allowedPaces,
  energyNeed,
  goalTarget,
  GOALS,
  minIntake,
  noGoal,
  paceFor,
  PAL_LEVELS,
  profileUpdate,
  withEnergy,
  type Goal,
  type Profile,
  type Sex,
  type Status,
} from '../lib/targets';
import { lang as langSignal } from '../lib/i18n';
import { settings, updateSettings } from '../state';
import { te } from '../lib/strings-energy';
import { FOLLOW_STEP, goalShift } from '../lib/adaptive';
import { isoDate } from '../lib/db';
import { GOAL_LABEL } from './AdaptiveEnergy';
import { open } from '../nav';

const lang = () => langSignal.value;

const PAL_LABEL: Record<number, 'palSedentary' | 'palLight' | 'palModerate' | 'palHeavy' | 'palAthlete'> = {
  1.2: 'palSedentary',
  1.375: 'palLight',
  1.55: 'palModerate',
  1.725: 'palHeavy',
  1.9: 'palAthlete',
};

type NumKey = 'age' | 'weightKg' | 'heightCm' | 'bodyFatPct';
/** The profile's number fields: their ranges (as the backup's validation) and whether decimals are allowed. */
const NUM: Record<NumKey, { min: number; max: number; decimals: boolean }> = {
  age: { min: 18, max: 110, decimals: false },
  weightKg: { min: 30, max: 300, decimals: true },
  heightCm: { min: 120, max: 230, decimals: false },
  bodyFatPct: { min: 3, max: 70, decimals: true },
};

/** A typed number for a field: the value (undefined: cleared), or null when it isn't valid. */
export function checkNum(key: NumKey, text: string): number | undefined | null {
  const { min, max, decimals } = NUM[key];
  if (text.trim() === '') return undefined;
  const v = parseNum(text);
  return v >= min && v <= max && (decimals || Number.isInteger(v)) ? Math.round(v * 10) / 10 : null;
}

/** The patch for a field's new value; crossing 51 lets the age-based menstruation default apply again. */
function numPatch(p: Profile, key: NumKey, v: number | undefined): Partial<Profile> {
  const patch: Partial<Profile> = { [key]: v };
  if (key === 'age' && (p.age ?? 0) < 51 !== (v ?? 0) < 51) patch.menstruating = undefined;
  return patch;
}

/**
 * A new goal (M35) sets the automatic target too: the need ± the pace's energy. While the target
 * follows the measured expenditure, a new goal or pace moves it at once by the difference (M41) —
 * not only at the next weekly step — and the change is noted with why. Also used by the Iron Notes
 * import (M53).
 */
export async function changeGoal(g: Goal, pace = settings.value.pace): Promise<void> {
  const s = settings.value;
  const p = s.profile;
  const goal = s.goal ?? 'maintain';
  if (!(s.adaptive && s.adaptiveFollow) || noGoal(p)) return updateSettings({ goal: g, pace, profile: withEnergy(p, g, pace) });
  const from = { goal, pace: paceFor(p, s.pace) };
  const to = { goal: g, pace: paceFor(p, pace) };
  const kcal = goalShift(p.kcal, from, to, minIntake(p));
  await updateSettings({
    goal: g,
    pace,
    profile: { ...p, kcal, kcalAuto: false },
    ...(kcal !== p.kcal ? { energyChange: { date: isoDate(new Date()), from: p.kcal, to: kcal, why: { kind: 'goal' as const, fromGoal: from.goal, fromPace: from.pace, goal: to.goal, pace: to.pace } } } : {}),
  });
}

/**
 * Body data → NNR 2023 targets for age band, pregnancy/lactation, and an energy estimate.
 * `brief` (first start, M45): only what the targets need — no body fat, no link onwards. */
export function ProfileForm({ brief = false }: { brief?: boolean } = {}) {
  const p = settings.value.profile;
  const s = settings.value;
  const goal = s.goal ?? 'maintain';
  /**
   * Numbers typed but not yet committed (their field hasn't fired "change"). Any other change commits
   * them first, and every save starts from the stored profile, not this render's: a value typed and
   * then a select changed right away was lost (M71, walkthrough s17).
   */
  const pending = useRef(new Map<NumKey, string>());
  const typedPatch = (): Partial<Profile> => {
    const patch: Partial<Profile> = {};
    for (const [key, text] of pending.current) {
      const v = checkNum(key, text);
      if (v !== null) Object.assign(patch, numPatch(settings.value.profile, key, v));
    }
    pending.current.clear();
    return patch;
  };
  const save = async (patch: Partial<Profile>) => {
    const cur = settings.value; // the stored profile now, not this render's
    const following = !!(cur.adaptive && cur.adaptiveFollow);
    const next = profileUpdate(cur.profile, { ...typedPatch(), ...patch }, following);
    await updateSettings({ profile: withEnergy(next, cur.goal ?? 'maintain', cur.pace) });
  };
  const setGoal = async (g: Goal, pace = s.pace) => {
    if (pending.current.size) await save({});
    await changeGoal(g, pace);
  };
  const pace = paceFor(p, s.pace);

  const pregnant = p.sex === 'female' && (p.status ?? 'none').startsWith('pregnant');
  const shown = (key: 'age' | 'weightKg' | 'heightCm' | 'bodyFatPct', decimals: boolean) =>
    p[key] == null ? '' : String(p[key]).replace('.', decimals && lang() === 'sv' ? ',' : '.');

  /**
   * Number field that commits on change when valid (else reverts). Text + inputmode so phones
   * show the right keypad and a decimal comma works for weight.
   */
  const num = (key: NumKey, label: string) => (
    <label>
      {label}
      <input
        type="text"
        inputMode={NUM[key].decimals ? 'decimal' : 'numeric'}
        value={shown(key, NUM[key].decimals)}
        onInput={(e) => pending.current.set(key, (e.currentTarget as HTMLInputElement).value)}
        onChange={(e) => {
          const el = e.currentTarget as HTMLInputElement;
          pending.current.delete(key);
          const v = checkNum(key, el.value);
          if (v === null) {
            el.value = shown(key, NUM[key].decimals); // same formatting as `value` (decimal comma in sv)
            return;
          }
          void save(numPatch(settings.value.profile, key, v));
        }}
      />
    </label>
  );

  return (
    <section class="card form">
      <h2>{t('profile')}</h2>
      {p.standard && !brief && <p class="muted small">{t('standardProfileNote')}</p>}
      <label>
        {t('sex')}
        <select
          value={p.standard ? '' : p.sex}
          onChange={(e) => {
            const sex = (e.currentTarget as HTMLSelectElement).value as Sex;
            // The default target follows the sex; one the user typed (also while on standard targets, M65) stays.
            const typed = p.standard && p.kcal !== defaultKcal('female');
            save({ sex, status: 'none', standard: undefined, kcal: p.kcalAuto || typed ? p.kcal : defaultKcal(sex) });
          }}
        >
          {p.standard && (
            <option value="" disabled>
              {t('sexUnset')}
            </option>
          )}
          <option value="female">{t('female')}</option>
          <option value="male">{t('male')}</option>
        </select>
      </label>
      <div class="grid2">
        {num('age', t('age'))}
        {num('weightKg', pregnant ? t('weightBeforePregnancy') : t('weightKg'))}
        {num('heightCm', t('heightCm'))}
        {!brief && num('bodyFatPct', t('bodyFatPct'))}
      </div>
      <label>
        {t('activity')}
        <select value={String(p.pal ?? DEFAULT_PAL)} onChange={(e) => save({ pal: Number((e.currentTarget as HTMLSelectElement).value) })}>
          {PAL_LEVELS.map((v) => (
            <option key={v} value={String(v)}>
              {t(PAL_LABEL[v])}
            </option>
          ))}
        </select>
      </label>
      {p.sex === 'female' && !p.standard && (
        <>
          <label>
            {t('lifeStage')}
            <select value={p.status ?? 'none'} onChange={(e) => save({ status: (e.currentTarget as HTMLSelectElement).value as Status })}>
              <option value="none">{t('statusNone')}</option>
              <option value="pregnant1">{t('pregnant1')}</option>
              <option value="pregnant2">{t('pregnant2')}</option>
              <option value="pregnant3">{t('pregnant3')}</option>
              <option value="lactating">{t('lactating')}</option>
            </select>
          </label>
          {p.status === 'lactating' && <p class="muted small">{t('lactationNote')}</p>}
          {!brief && (p.status ?? 'none') === 'none' && (
            <label class="check">
              <input
                type="checkbox"
                checked={p.menstruating ?? (p.age == null || p.age < 51)}
                onChange={(e) => save({ menstruating: (e.currentTarget as HTMLInputElement).checked })}
              />
              {t('menstruating')}
            </label>
          )}
        </>
      )}
      {noGoal(p) ? (
        <p class="muted small">{te('adaptiveNoGoal')}</p>
      ) : (
        <div class="grid2">
          <label>
            {te('goal')}
            <select value={goal} onChange={(e) => setGoal((e.currentTarget as HTMLSelectElement).value as Goal)}>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {te(GOAL_LABEL[g])}
                </option>
              ))}
            </select>
          </label>
          {goal !== 'maintain' && (
            <label>
              {te('pace')}
              <select value={String(pace)} onChange={(e) => setGoal(goal, Number((e.currentTarget as HTMLSelectElement).value))}>
                {allowedPaces(p.weightKg).map((x) => (
                  <option key={x} value={String(x)}>
                    {te('paceOption').replace('{kg}', fmt(x, 2))}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {!brief && (
      <button class="entry" onClick={() => open({ kind: 'settings', page: 'energy' })}>
        <span class="entry-name">
          {t('settingsEnergy')}: {fmt(p.kcal)} kcal/{t('perDayShort')}
          <span class="muted small summary">{te(s.adaptive && s.adaptiveFollow ? 'modeFollow' : p.kcalAuto ? 'modeProfile' : 'modeManual')}</span>
        </span>
        <span aria-hidden="true">›</span>
      </button>
      )}
    </section>
  );
}

type Mode = 'manual' | 'profile' | 'follow';

/**
 * The energy target as one choice (M44): typed by the user, calculated from the profile (formula +
 * goal), or following the measured expenditure once a week (M35). Replaces the profile's "Räkna ut
 * automatiskt" box and the separate follow switch, which could fight over the target (M41).
 */
export function EnergyTarget() {
  const s = settings.value;
  const p = s.profile;
  const goal = s.goal ?? 'maintain';
  const save = (patch: Partial<Profile>) => void updateSettings({ profile: withEnergy({ ...p, ...patch }, goal, s.pace) });
  const estimate = energyNeed(p);
  const pace = paceFor(p, s.pace);
  const goalKcal = estimate && goal !== 'maintain' && !noGoal(p) ? goalTarget(estimate, goal, pace, minIntake(p)) : null;
  const mode: Mode = s.adaptive && s.adaptiveFollow ? 'follow' : p.kcalAuto ? 'profile' : 'manual';
  const choose = async (m: Mode) => {
    if (m === 'manual') await updateSettings({ adaptiveFollow: false, profile: { ...p, kcalAuto: false } });
    if (m === 'profile') await updateSettings({ adaptiveFollow: false, profile: withEnergy({ ...p, kcalAuto: true }, goal, s.pace) });
    if (m === 'follow') {
      // It alone sets the target from now; the first step happens now if there is enough data.
      await updateSettings({ adaptive: true, adaptiveFollow: true, profile: { ...p, kcalAuto: false } });
      await (await import('../lib/follow')).runFollow();
    }
  };
  const option = (m: Mode, label: 'modeManual' | 'modeProfile' | 'modeFollow', note: 'modeManualNote' | 'modeProfileNote' | 'modeFollowNote', disabled = false) => (
    <label class="check mode" key={m}>
      <input type="radio" name="energy-mode" checked={mode === m} disabled={disabled} onChange={() => void choose(m)} />
      <span>
        {te(label)}
        <span class="muted small summary">{te(note).replace('{kcal}', String(FOLLOW_STEP))}</span>
      </span>
    </label>
  );
  return (
    <section class="card form">
      {/* The page is called Energimål already (M44): no second heading, the choice is named for screen readers. */}
      <fieldset class="modes">
        <legend class="visually-hidden">{t('settingsEnergy')}</legend>
        {option('manual', 'modeManual', 'modeManualNote')}
        {option('profile', 'modeProfile', 'modeProfileNote', !estimate && mode !== 'profile')}
        {option('follow', 'modeFollow', 'modeFollowNote', noGoal(p) && mode !== 'follow')}
      </fieldset>
      {!estimate && mode !== 'profile' && <p class="muted small">{t('kcalAutoHint')}</p>}
      <label>
        {t('dailyEnergy')}
        <input
          type="number"
          inputMode="numeric"
          min="800"
          max="6000"
          step="1"
          value={p.kcal}
          readOnly={mode !== 'manual'}
          onChange={(e) => {
            const el = e.currentTarget as HTMLInputElement;
            const kcal = parseInt(el.value, 10);
            if (kcal >= 800 && kcal <= 6000) save({ kcal, kcalTyped: true });
            else el.value = String(p.kcal);
          }}
        />
      </label>
      {mode === 'manual' && estimate && (
        <p class="muted small">
          {t('kcalEstimate')}: {fmt(goalKcal?.kcal ?? estimate)} kcal
        </p>
      )}
      {mode === 'profile' && goalKcal && (
        <p class="muted small">
          {te('goalFormula')
            .replace('{need}', fmt(estimate!))
            .replace('{delta}', `${goal === 'lose' ? '−' : '+'}${fmt(Math.round((pace * 7700) / 7))}`)
            .replace('{kg}', fmt(pace, 2))}
        </p>
      )}
      {mode === 'profile' && goalKcal?.floored && <p class="small warn">{te('adaptiveFloored').replace('{kcal}', fmt(goalKcal.kcal))}</p>}
      {mode === 'profile' && estimate && <p class="muted small">{p.bodyFatPct != null && p.weightKg ? t('formulaKatch') : t('formulaMifflin')}</p>}
      <label class="check">
        <input
          type="checkbox"
          checked={!!settings.value.addBurnedToTarget}
          onChange={(e) => void updateSettings({ addBurnedToTarget: (e.currentTarget as HTMLInputElement).checked })}
        />
        {t('addBurnedToTarget')}
      </label>
    </section>
  );
}
