import { useEffect, useState } from 'preact/hooks';
import { goalTarget, minIntake, type Estimate, type Goal } from '../lib/adaptive';
import { loadEstimate } from '../lib/adaptive-load';
import { fmt } from '../lib/i18n';
import { te } from '../lib/strings-energy';
import { energyNeed, noGoal as noGoalFor, paceFor } from '../lib/targets';
import { FOLLOW_STEP } from '../lib/adaptive';
import { runFollow } from '../lib/follow';
import { settings, updateSettings } from '../state';

export const GOAL_LABEL: Record<Goal, 'goalLose' | 'goalMaintain' | 'goalGain'> = { lose: 'goalLose', maintain: 'goalMaintain', gain: 'goalGain' };

/** "Gå ner i vikt, 0,5 kg/vecka" — the goal as set in the profile. */
export function goalText(goal: Goal, pace: number): string {
  return goal === 'maintain' ? te('goalMaintain') : `${te(GOAL_LABEL[goal])}, ${te('paceOption').replace('{kg}', fmt(pace, 2))}`;
}

/**
 * Adaptive energy expenditure (opt-in, off by default): the estimate, and the target for the goal
 * set in the profile, which the user can apply — or let follow once a week (M35, ±150 kcal).
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
  const noGoal = noGoalFor(p); // pregnant or breastfeeding
  const pace = est?.ok ? paceFor({ ...p, weightKg: est.weightKg }, s.pace) : 0;
  const target = est?.ok && !noGoal ? goalTarget(est.kcal, goal, pace, minIntake(p)) : null;
  // Turned on: the first step happens now (then once a week).
  const follow = async (on: boolean) => {
    await updateSettings({ adaptiveFollow: on });
    if (on) await runFollow();
  };

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
          {target && (
            <>
              <p class="muted small">{te('goalWhere').replace('{goal}', goalText(goal, pace))}</p>
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
          {!noGoal && (
            <>
              <label class="check">
                <input type="checkbox" checked={!!s.adaptiveFollow} onChange={(e) => void follow((e.currentTarget as HTMLInputElement).checked)} />
                {te('followToggle').replace('{kcal}', String(FOLLOW_STEP))}
              </label>
              <p class="muted small">{te('followExplain').replace('{kcal}', String(FOLLOW_STEP))}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
