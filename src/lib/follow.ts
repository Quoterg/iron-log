// Follow the estimate (M35, opt-in): once a week the energy target moves toward the adaptive
// suggestion (expenditure ± the goal's pace), at most FOLLOW_STEP kcal at a time, so one noisy week
// can't swing it. Loaded when the app is idle after start, and when the setting is turned on.
import { followDue, followStep } from './adaptive';
import { loadEstimate } from './adaptive-load';
import { isoWeek } from './checkin';
import { isoDate } from './db';
import { goalTarget, minIntake, noGoal, paceFor } from './targets';
import { settings, updateSettings } from '../state';


/** Once per ISO week: moves the target and notes the change for the diary. Synced, so once per user. */
export async function runFollow(): Promise<void> {
  const s = settings.value;
  if (!s.adaptive || !s.adaptiveFollow) return;
  const week = isoWeek(isoDate(new Date())).key;
  if (!followDue(s, week)) return;
  const est = await loadEstimate();
  // Too little data yet (or pregnant/breastfeeding): try again at the next start this week.
  if (!est.ok || noGoal(s.profile)) return;
  const p = settings.value.profile; // fresh: the estimate took a moment
  const goal = settings.value.goal ?? 'maintain';
  const floor = minIntake(p);
  const want = goalTarget(est.kcal, goal, paceFor({ ...p, weightKg: est.weightKg }, settings.value.pace), floor).kcal;
  const next = followStep(p.kcal, want, floor);
  await updateSettings(
    next === p.kcal
      ? { followWeek: week }
      : { followWeek: week, followNote: { week, from: p.kcal, to: next }, profile: { ...p, kcal: next, kcalAuto: false } },
  );
}
