import { useEffect, useState } from 'preact/hooks';
import { goalTarget, minIntake, type Estimate } from '../lib/adaptive';
import { loadEstimate } from '../lib/adaptive-load';
import { fmt } from '../lib/i18n';
import { goalText, te } from '../lib/strings-energy';
import { energyNeed, noGoal as noGoalFor, paceFor } from '../lib/targets';
import { FOLLOW_STEP, followDue, followStep } from '../lib/adaptive';
import { isoWeek } from '../lib/checkin';
import { addDays, isoDate } from '../lib/db';
import EnergyWhy, { expenditureLines } from './EnergyWhy';
import { runFollow } from '../lib/follow';
import { settings, updateSettings } from '../state';

export { GOAL_LABEL } from '../lib/strings-energy';

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
  // Following: where the next weekly step goes (this week if not yet taken, else next week; M41).
  const today = isoDate(new Date());
  const stepWeek = followDue(s, isoWeek(today).key) ? isoWeek(today) : isoWeek(addDays(today, 7));
  const next = s.adaptiveFollow && target ? followStep(p.kcal, target.kcal, minIntake(p)) : null;
  const change = s.energyChange;
  // Turned on: it alone sets the target from now (the profile's formula stops, M41); the first step
  // happens now if there is enough data (then once a week).
  const follow = async (on: boolean) => {
    await updateSettings(on ? { adaptiveFollow: true, profile: { ...settings.value.profile, kcalAuto: false } } : { adaptiveFollow: false });
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
              {/* The arithmetic behind it (M41b): intake of the days that count + the weight trend's energy. */}
              <ol class="why small muted">
                {expenditureLines({ kcal: est.kcal, intake: est.intake, days: est.days, skipped: est.skipped, weighIns: est.weighIns, trend: est.kgPerWeek }).map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ol>
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
                <p class="muted small" role="status">{te(s.adaptiveFollow ? 'followOnTarget' : 'adaptiveIsTarget')}</p>
              ) : (
                <button type="button" class="btn wide" onClick={() => void updateSettings({ profile: { ...p, kcal: target.kcal, kcalAuto: false } })}>
                  {te('adaptiveApply')}
                </button>
              )}
            </>
          )}
          {s.adaptiveFollow && next != null && next !== p.kcal && (
            <p class="small">
              {te('followNext')
                .replace('{week}', String(Number(stepWeek.key.slice(-2))))
                .replace('{from}', fmt(p.kcal))
                .replace('{to}', fmt(next))
                .replace('{want}', fmt(target!.kcal))}
            </p>
          )}
          {change && (
            <div class="why-last">
              <p class="small">{te('whyLast').replace('{date}', change.date)}</p>
              <EnergyWhy change={change} />
            </div>
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
