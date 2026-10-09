import { useState } from 'preact/hooks';
import { fmt, fmtAmount, inputNum, nutrientName, parseNum, t } from '../lib/i18n';
import { NUTRIENTS, type NutrientGroup } from '../lib/nutrients';
import {
  computeTargets,
  macroRanges,
  nnrMacroPct,
  overrideConflicts,
  TARGET_MAX,
  type MacroKey,
  type MacroPct,
  type MacroPreset,
  type TargetOverride,
} from '../lib/targets';
import { settings, targets, updateSettings } from '../state';
import { Sheet } from './Sheet';

const MACROS: MacroKey[] = ['protein', 'carbs', 'fat'];
const PRESETS: MacroPreset[] = ['nnr', 'highProtein', 'lowCarb', 'keto', 'custom'];
const GROUPS: NutrientGroup[] = ['energy', 'macro', 'carb', 'lipid', 'vitamin', 'mineral', 'other'];
const label = (key: string) => nutrientName(NUTRIENTS.find((n) => n.key === key)!);

/** Adjust targets: macro preset / custom E% ranges, and min/max for any nutrient. */
export default function TargetEditor() {
  const s = settings.value;
  const preset = s.macroPreset ?? 'nnr';
  // "Default" for a nutrient = what applies without the user's own override (preset included).
  const defaults = computeTargets({ ...s, targetOverrides: {} });
  const effective = targets.value;
  const overrides = s.targetOverrides;
  // The E% ranges shown: the preset's, or (for NNR / a fresh custom) the NNR ones from the profile.
  const shown: MacroPct = macroRanges(s) ?? nnrMacroPct(s.profile.age);
  const conflicts = overrideConflicts(s);
  // Feedback for rejected input (otherwise the value would just vanish).
  const [error, setError] = useState<{ key: string; text: string } | null>(null);

  const setPreset = (p: MacroPreset) =>
    void updateSettings({ macroPreset: p, macroPct: p === 'custom' ? (s.macroPct ?? shown) : s.macroPct });

  const setPct = (key: MacroKey, i: 0 | 1, text: string, el: HTMLInputElement) => {
    const v = parseNum(text);
    const next: MacroPct = { ...shown, [key]: [...shown[key]] as [number, number] };
    next[key][i] = v;
    if (!(v >= 0 && v <= 100 && next[key][0] <= next[key][1])) {
      el.value = inputNum(shown[key][i]);
      return setError({ key: `${key}-pct`, text: t('invalidPct').replace('{name}', label(key)) });
    }
    setError(null);
    void updateSettings({ macroPreset: 'custom', macroPct: next });
  };

  const setBound = (key: string, bound: 'min' | 'max', text: string, el: HTMLInputElement) => {
    const o: TargetOverride = { ...overrides[key] };
    if (text.trim() === '') delete o[bound];
    else {
      const v = parseNum(text);
      const other = bound === 'min' ? (o.max ?? effective[key]?.max) : (o.min ?? effective[key]?.min);
      const ordered = other == null || (bound === 'min' ? v <= other : v >= other);
      if (!(v >= 0 && v < TARGET_MAX && ordered)) {
        el.value = o[bound] == null ? '' : inputNum(o[bound]!);
        return setError({ key, text: t('invalidTarget').replace('{name}', label(key)) });
      }
      o[bound] = v;
    }
    setError(null);
    const next = { ...overrides };
    if (o.min === undefined && o.max === undefined) delete next[key];
    else next[key] = o;
    void updateSettings({ targetOverrides: next });
  };

  const resetAll = () => {
    if (confirm(t('resetTargetsConfirm'))) void updateSettings({ targetOverrides: {}, macroPreset: 'nnr' });
  };

  const sumMin = MACROS.reduce((a, k) => a + shown[k][0], 0);
  const sumMax = MACROS.reduce((a, k) => a + shown[k][1], 0);

  return (
    <Sheet title={t('adjustTargets')}>
      <div class="pad form">
        <h3>{t('macroDistribution')}</h3>
        <label>
          {t('preset')}
          <select value={preset} onChange={(e) => setPreset((e.currentTarget as HTMLSelectElement).value as MacroPreset)}>
            {PRESETS.map((p) => (
              <option key={p} value={p}>
                {t(`preset_${p}` as 'preset_nnr')}
              </option>
            ))}
          </select>
        </label>
        <table class="targets">
          <thead>
            <tr>
              <th />
              <th>{t('minPct')}</th>
              <th>{t('maxPct')}</th>
              <th>g</th>
            </tr>
          </thead>
          <tbody>
            {MACROS.map((k) => (
              <tr key={k}>
                <th scope="row">{label(k)}</th>
                {([0, 1] as const).map((i) => (
                  <td key={i}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`${label(k)} ${i === 0 ? t('minPct') : t('maxPct')}`}
                      value={inputNum(shown[k][i])}
                      aria-invalid={error?.key === `${k}-pct`}
                      readOnly={preset !== 'custom'}
                      onChange={(e) => setPct(k, i, (e.currentTarget as HTMLInputElement).value, e.currentTarget as HTMLInputElement)}
                    />
                  </td>
                ))}
                <td class="num muted">
                  {fmt(effective[k]?.min ?? 0)}–{fmt(effective[k]?.max ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {preset !== 'custom' && <p class="muted small">{t('customHint')}</p>}
        {(sumMin > 100 || sumMax < 100) && <p class="small warn">{t('pctSumWarning')}</p>}
        {error?.key.endsWith('-pct') && (
          <p class="small warn" role="alert">
            {error.text}
          </p>
        )}

        <h3>{t('perNutrient')}</h3>
        <p class="muted small">{t('perNutrientHint')}</p>
        {error && !error.key.endsWith('-pct') && (
          <p class="small warn" role="alert">
            {error.text}
          </p>
        )}
        <table class="targets">
          <thead>
            <tr>
              <th />
              <th>{t('target')}</th>
              <th>{t('limit')}</th>
            </tr>
          </thead>
          <tbody>
            {/* Energy is set in the profile, so it isn't listed here. */}
            {GROUPS.flatMap((g) => NUTRIENTS.filter((n) => n.group === g && n.key !== 'kcal')).map((n) => {
              const o = overrides[n.key] ?? {};
              const d = defaults[n.key];
              return (
                <tr key={n.key} class={overrides[n.key] ? 'changed' : ''}>
                  <th scope="row">
                    {nutrientName(n)} <span class="muted">({n.unit})</span>
                    {conflicts.has(n.key) && <span class="small warn block">{t('conflictNote')}</span>}
                  </th>
                  {(['min', 'max'] as const).map((b) => (
                    <td key={b}>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${nutrientName(n)} ${b === 'min' ? t('target') : t('limit')}`}
                        value={o[b] == null ? '' : inputNum(o[b]!)}
                        aria-invalid={error?.key === n.key || conflicts.has(n.key)}
                        placeholder={d?.[b] == null ? '–' : fmtAmount(d[b]!)}
                        onChange={(e) => setBound(n.key, b, (e.currentTarget as HTMLInputElement).value, e.currentTarget as HTMLInputElement)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        <button class="btn wide danger" onClick={resetAll}>
          {t('resetTargets')}
        </button>
      </div>
    </Sheet>
  );
}
