import { useEffect, useState } from 'preact/hooks';
import { allowedPaces, goalTarget, minIntake, type Estimate } from '../lib/adaptive';
import { previousWeek } from '../lib/checkin';
import { positives, weightChange, type Positive } from '../lib/checkin-report';
import { bodyBetween, entriesBetween, isoDate, addDays } from '../lib/db';
import { fmt, fmtAmount, lang, locale, nutrientName } from '../lib/i18n';
import { foodName, NUTRIENT_INDEX, NUTRIENTS } from '../lib/nutrients';
import { averagePerDay, coverage, dailyTotals, gaps, MIN_COVERAGE } from '../lib/report';
import { tc } from '../lib/strings-checkin';
import { te } from '../lib/strings-energy';
import { unitOf, type Swap } from '../lib/suggest';
import { back } from '../nav';
import { ensureFoods, foods, settings, targets, updateSettings } from '../state';
import { loadEstimate } from '../lib/adaptive-load';
import { Sheet } from './Sheet';
import { buildSuggestions, type GapHelp } from './Suggestions';

interface Week {
  key: string;
  start: string;
  end: string;
  days: number;
  amounts: number[];
  weight: number | null;
  well: Positive[];
  tip: { gap?: GapHelp; swap?: Swap } | null;
  estimate: Estimate | null;
}

async function load(): Promise<Week> {
  const week = previousWeek(isoDate(new Date()));
  // The M25 estimate (last 4 weeks) loads alongside the week's data.
  const estimate = settings.value.adaptive ? loadEstimate() : Promise.resolve(null);
  const [list, body] = await Promise.all([entriesBetween(week.start, week.end), bodyBetween(addDays(week.start, -7), week.end)]);
  await ensureFoods(list.map((e) => e.foodRef));
  const perDay = dailyTotals(list, foods.value);
  const amounts = averagePerDay(perDay);
  const covered = coverage(list, foods.value).map((c) => c >= MIN_COVERAGE);
  const tgt = targets.value;
  const weighIns = body.filter((b) => b.weightKg != null).map((b) => ({ date: b.date, kg: b.weightKg! }));
  // At most one tip: the largest shortfall a food can help with, else a swap (M27's scoring).
  let tip: Week['tip'] = null;
  if (perDay.size) {
    const g = gaps(amounts, tgt, covered);
    const s = await buildSuggestions(g.low, amounts);
    const gap = s.gaps[0];
    tip = gap ? { gap } : s.swaps[0] ? { swap: s.swaps[0] } : null;
  }
  return {
    ...week,
    days: perDay.size,
    amounts,
    weight: weightChange(weighIns, week),
    well: perDay.size ? positives(amounts, tgt, perDay.size, covered) : [],
    tip,
    estimate: await estimate,
  };
}

const name = (ref: string) => {
  const f = foods.value.get(ref);
  return f ? foodName(f, lang.value) : '…';
};
const nutrient = (key: string) => nutrientName(NUTRIENTS[NUTRIENT_INDEX[key]]);
const day = (d: string) => {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
};

function wellText(p: Positive): string {
  if (p.kind === 'logged') return tc('wellLogged').replace('{n}', String(p.days));
  if (p.kind === 'energy') return tc('wellEnergy');
  return tc('wellNutrient').replace('{name}', nutrient(p.key));
}

/** The week before, in a few calm lines (opt-in). Seen once a week; nothing is changed unless asked. */
export default function CheckIn() {
  const [w, setW] = useState<Week | null>(null);
  const [applied, setApplied] = useState<number | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((x) => live && setW(x));
    return () => void (live = false);
  }, []);

  const s = settings.value;
  const p = s.profile;
  const kcalTarget = targets.value.kcal?.min;
  const est = w?.estimate?.ok ? w.estimate : null;
  const goal = s.goal ?? 'maintain';
  const noGoal = p.sex === 'female' && (p.status ?? 'none') !== 'none';
  const paces = est ? allowedPaces(est.weightKg) : [];
  const pace = paces.includes(s.pace ?? 0) ? s.pace! : paces[0];
  const suggested = est && !noGoal && (goal === 'maintain' || pace) ? goalTarget(est.kcal, goal, pace ?? 0, minIntake(p)).kcal : null;

  const done = async () => {
    if (w) await updateSettings({ checkinSeen: w.key });
    back();
  };

  return (
    <Sheet title={tc('checkinTitle')}>
      <div class="pad checkin">
        {!w ? (
          <p class="muted" role="status">{tc('checkinLoading')}</p>
        ) : (
          <>
            <p class="muted small">
              {tc('checkinWeek').replace('{week}', String(Number(w.key.slice(6)))).replace('{from}', day(w.start)).replace('{to}', day(w.end))}
            </p>
            {w.days === 0 ? (
              <p>{tc('checkinNothing')}</p>
            ) : (
              <section class="card">
                <p class="checkin-days">{tc('checkinDays').replace('{n}', String(w.days))}</p>
                <p class="small">
                  {tc('checkinEnergy').replace('{kcal}', fmt(w.amounts[NUTRIENT_INDEX.kcal])).replace('{target}', kcalTarget ? fmt(kcalTarget) : '–')}
                </p>
                <p class="small muted">
                  {(['protein', 'carbs', 'fat'] as const).map((k) => `${nutrient(k)} ${fmt(w.amounts[NUTRIENT_INDEX[k]])} g`).join(' · ')}
                </p>
                <p class="small">
                  {w.weight == null ? tc('checkinNoWeight') : tc('checkinWeight').replace('{change}', `${w.weight > 0 ? '+' : ''}${fmt(w.weight, 1)}`)}
                </p>
                {est && <p class="small">{tc('checkinExpenditure').replace('{kcal}', fmt(est.kcal))}</p>}
                {suggested && suggested !== p.kcal && applied == null && (
                  <div class="checkin-target">
                    <p class="small">
                      {tc('checkinTarget').replace('{goal}', te(goal === 'lose' ? 'goalLose' : goal === 'gain' ? 'goalGain' : 'goalMaintain').toLowerCase()).replace('{kcal}', fmt(suggested))}
                    </p>
                    <button
                      type="button"
                      class="btn small"
                      onClick={() => {
                        void updateSettings({ profile: { ...p, kcal: suggested, kcalAuto: false } });
                        setApplied(suggested);
                      }}
                    >
                      {tc('checkinApply')}
                    </button>
                  </div>
                )}
                {applied != null && (
                  <p class="small" role="status">
                    {tc('checkinApplied').replace('{kcal}', fmt(applied))}
                  </p>
                )}
              </section>
            )}
            {w.well.length > 0 && (
              <section class="card">
                <h2>{tc('checkinWell')}</h2>
                <ul class="checkin-list">
                  {w.well.map((x, i) => (
                    <li key={i}>{wellText(x)}</li>
                  ))}
                </ul>
              </section>
            )}
            {w.tip && (
              <section class="card usual-card">
                <h2>{tc('checkinTip')}</h2>
                <p class="small">
                  {w.tip.gap
                    ? tc('tipGap')
                        .replace('{name}', nutrient(w.tip.gap.key))
                        .replace('{amount}', fmtAmount(w.tip.gap.amount))
                        .replace('{target}', fmtAmount(w.tip.gap.target))
                        .replace('{unit}', unitOf(w.tip.gap.key))
                        .replace('{food}', name(w.tip.gap.foods[0].ref))
                        .replace('{grams}', fmt(w.tip.gap.foods[0].portionG))
                        .replace('{pct}', fmt(w.tip.gap.foods[0].covers * 100))
                    : tc('tipSwap')
                        .replace('{to}', name(w.tip.swap!.to))
                        .replace('{from}', name(w.tip.swap!.from))
                        .replace('{changes}', w.tip.swap!.changes.map((c) => `${c.delta > 0 ? '+' : '−'}${fmtAmount(Math.abs(c.delta))} ${unitOf(c.key)} ${nutrient(c.key).toLowerCase()}`).join(', '))}
                </p>
              </section>
            )}
            <button type="button" class="btn primary wide" onClick={() => void done()}>
              {tc('checkinDone')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
