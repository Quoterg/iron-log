import { FOLLOW_STEP, goalDelta } from '../lib/adaptive';
import type { EnergyChange } from '../lib/db';
import { fmt } from '../lib/i18n';
import { goalText, te } from '../lib/strings-energy';

const signed = (n: number) => (Math.round(n) === 0 ? '±0' : `${n > 0 ? '+' : '−'}${fmt(Math.abs(Math.round(n)))}`);

/**
 * How the expenditure is worked out, as arithmetic the user can check (M41b): the average intake of
 * the days that count (and how many logged days didn't), the weight trend and the energy it stands
 * for, and the sum — intake + (expenditure − intake) = expenditure.
 */
export function expenditureLines(e: { kcal: number; intake: number; days: number; skipped: number; weighIns: number; trend: number }): string[] {
  const balance = e.kcal - e.intake;
  const lines = [te('whyIntake').replace('{intake}', fmt(e.intake)).replace('{days}', String(e.days))];
  if (e.skipped > 0) lines.push(te('whySkipped').replace('{n}', String(e.skipped)));
  lines.push(
    te('whyWeight')
      .replace('{trend}', `${e.trend > 0 ? '+' : ''}${fmt(e.trend, 2)}`)
      .replace('{weighIns}', String(e.weighIns))
      .replace('{balance}', signed(balance)),
  );
  lines.push(
    te('whySum')
      .replace('{intake}', fmt(e.intake))
      .replace('{op}', balance < 0 ? '−' : '+')
      .replace('{balance}', fmt(Math.abs(balance)))
      .replace('{kcal}', fmt(e.kcal)),
  );
  return lines;
}

/**
 * Why the energy target changed (M41), step by step: what was measured, what the goal adds, the
 * target that gives, and how far it moved (capped weekly steps, the lowest intake) — or, after a goal
 * change, the difference the new goal makes. Loaded on demand (diary "Varför?", Settings).
 */
export default function EnergyWhy({ change }: { change: EnergyChange }) {
  const { from, to, why } = change;
  const lines: string[] = [];
  if (why.kind === 'week') {
    if (why.intake != null) {
      lines.push(...expenditureLines({ kcal: why.expenditure, intake: why.intake, days: why.days, skipped: why.skipped ?? 0, weighIns: why.weighIns, trend: why.trend }));
    } else {
      // Recorded before M41b: no intake kept, only the result.
      lines.push(
        te('whyMeasured')
          .replace('{kcal}', fmt(why.expenditure))
          .replace('{days}', String(why.days))
          .replace('{weighIns}', String(why.weighIns))
          .replace('{trend}', `${why.trend > 0 ? '+' : ''}${fmt(why.trend, 2)}`),
      );
    }
    lines.push(te('whyGoal').replace('{goal}', goalText(why.goal, why.pace)).replace('{delta}', signed(goalDelta(why.goal, why.pace))));
    lines.push(te('whyWant').replace('{kcal}', fmt(why.want)));
    if (why.floored) lines.push(te('adaptiveFloored').replace('{kcal}', fmt(why.want)));
    lines.push(
      to !== why.want
        ? te('whyCapped').replace('{step}', String(FOLLOW_STEP)).replace('{from}', fmt(from)).replace('{to}', fmt(to)).replace('{want}', fmt(why.want))
        : te('whyReached').replace('{from}', fmt(from)).replace('{to}', fmt(to)),
    );
  } else {
    lines.push(
      te('whyGoalChange')
        .replace('{fromGoal}', goalText(why.fromGoal, why.fromPace))
        .replace('{goal}', goalText(why.goal, why.pace))
        .replace('{delta}', signed(goalDelta(why.goal, why.pace) - goalDelta(why.fromGoal, why.fromPace)))
        .replace('{from}', fmt(from))
        .replace('{to}', fmt(to)),
    );
    lines.push(te('whyGoalNext'));
  }
  return (
    <ol class="why small">
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ol>
  );
}
