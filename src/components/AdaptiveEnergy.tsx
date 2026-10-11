import { useEffect, useState } from 'preact/hooks';
import { ADAPTIVE, allowedPaces, estimate, goalTarget, GOALS, minIntake, type DayIntake, type Estimate, type Goal } from '../lib/adaptive';
import { addDays, bodyBetween, daysCompleteBetween, entriesBetween, entryVector, isoDate, localChanges } from '../lib/db';
import { fmt } from '../lib/i18n';
import { value } from '../lib/nutrients';
import { te } from '../lib/strings-energy';
import { energyNeed } from '../lib/targets';
import { ensureFoods, foods, settings, updateSettings } from '../state';

const GOAL_LABEL: Record<Goal, 'goalLose' | 'goalMaintain' | 'goalGain'> = { lose: 'goalLose', maintain: 'goalMaintain', gain: 'goalGain' };

/** The last estimate, reused while nothing changed (same day, no writes on this device). */
let cached: { key: string; est: Estimate } | undefined;

/** The last 4 weeks of intake (ending yesterday) and weigh-ins, read from the diary and body log. */
export async function loadEstimate(): Promise<Estimate> {
  const today = isoDate(new Date());
  const key = `${today}|${localChanges}`;
  if (cached?.key === key) return cached.est;
  const from = addDays(today, -ADAPTIVE.windowDays);
  const to = addDays(today, -1);
  const [list, marks, body] = await Promise.all([entriesBetween(from, to), daysCompleteBetween(from, to), bodyBetween(from, today)]);
  await ensureFoods([...new Set(list.map((e) => e.foodRef))]);
  const kcal = new Map<string, number>();
  const unknown = new Set<string>();
  for (const e of list) {
    const v = entryVector(e, foods.value);
    if (v) kcal.set(e.date, (kcal.get(e.date) ?? 0) + (value(v, 'kcal') * e.grams) / 100);
    else unknown.add(e.date);
  }
  const days: DayIntake[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push({ date: d, kcal: kcal.get(d) ?? 0, complete: marks.has(d), unknown: unknown.has(d) });
  const weighIns = body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, kg: b.weightKg! }));
  const est = estimate(days, weighIns);
  cached = { key, est };
  return est;
}

/**
 * Adaptive energy expenditure (opt-in, off by default): the estimate, and a suggested energy target
 * for a goal that the user can choose to apply. Nothing changes by itself.
 */
export function AdaptiveEnergy() {
  const s = settings.value;
  const p = s.profile;
  const [est, setEst] = useState<Estimate | null>(null);
  useEffect(() => {
    if (!s.adaptive) return;
    let live = true;
    setEst(null);
    void loadEstimate().then((e) => live && setEst(e));
    return () => {
      live = false;
    };
  }, [s.adaptive]);

  const formula = energyNeed(p);
  const goal = s.goal ?? 'maintain';
  const noGoal = p.sex === 'female' && (p.status ?? 'none') !== 'none'; // pregnant or breastfeeding
  const paces = est?.ok ? allowedPaces(est.weightKg) : [];
  const pace = paces.includes(s.pace ?? 0) ? s.pace! : paces[0];
  const target = est?.ok && !noGoal && (goal === 'maintain' || pace) ? goalTarget(est.kcal, goal, pace ?? 0, minIntake(p)) : null;

  return (
    <section class="card form">
      <h2>{te('adaptiveTitle')}</h2>
      <label class="check">
        <input type="checkbox" checked={!!s.adaptive} onChange={(e) => void updateSettings({ adaptive: (e.currentTarget as HTMLInputElement).checked })} />
        {te('adaptiveToggle')}
      </label>
      <p class="muted small">{te('adaptiveNote')}</p>
      {s.adaptive && (
        <>
          {!est ? (
            <p class="muted small" role="status">{te('adaptiveLoading')}</p>
          ) : est.ok ? (
            <div role="status">
              <p>
                <strong class="num">
                  {te('adaptiveResult').replace('{kcal}', fmt(est.kcal)).replace('{pm}', fmt(est.plusMinus))}
                </strong>
              </p>
              <p class="muted small">
                {te('adaptiveBasis')
                  .replace('{days}', String(est.days))
                  .replace('{weighIns}', String(est.weighIns))
                  .replace('{trend}', `${est.kgPerWeek > 0 ? '+' : ''}${fmt(est.kgPerWeek, 2)}`)}
              </p>
              {formula && <p class="muted small">{te('adaptiveFormula').replace('{kcal}', fmt(formula))}</p>}
            </div>
          ) : (
            <p class="small" role="status">
              {est.reason === 'data'
                ? te('adaptiveNeedData').replace('{days}', String(est.days)).replace('{weighIns}', String(est.weighIns))
                : te('adaptiveImplausible')}
            </p>
          )}
          <p class="muted small">{te('adaptiveHowTo')}</p>
          {est?.ok && noGoal && <p class="muted small">{te('adaptiveNoGoal')}</p>}
          {est?.ok && !noGoal && (
            <>
              <div class="grid2">
                <label>
                  {te('goal')}
                  <select value={goal} onChange={(e) => void updateSettings({ goal: (e.currentTarget as HTMLSelectElement).value as Goal })}>
                    {GOALS.map((g) => (
                      <option key={g} value={g}>
                        {te(GOAL_LABEL[g])}
                      </option>
                    ))}
                  </select>
                </label>
                {goal !== 'maintain' && paces.length > 0 && (
                  <label>
                    {te('pace')}
                    <select value={String(pace)} onChange={(e) => void updateSettings({ pace: Number((e.currentTarget as HTMLSelectElement).value) })}>
                      {paces.map((x) => (
                        <option key={x} value={String(x)}>
                          {te('paceOption').replace('{kg}', fmt(x, 2))}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {target && (
                <>
                  <p class="num">{te('adaptiveTarget').replace('{kcal}', fmt(target.kcal))}</p>
                  {target.floored && <p class="small warn">{te('adaptiveFloored').replace('{kcal}', fmt(target.kcal))}</p>}
                  {!p.kcalAuto && p.kcal === target.kcal ? (
                    <p class="muted small" role="status">{te('adaptiveIsTarget')}</p>
                  ) : (
                    <button type="button" class="btn wide" onClick={() => void updateSettings({ profile: { ...p, kcal: target.kcal, kcalAuto: false } })}>
                      {te('adaptiveApply')}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
