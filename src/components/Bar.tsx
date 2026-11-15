import { fmtAmount } from '../lib/i18n';
import { leftText as left } from '../lib/totals';
import type { Target } from '../lib/targets';

interface Props {
  label: string;
  amount: number;
  unit: string;
  target?: Target;
  /** The value isn't known for this food (not analysed / not entered). */
  unknown?: boolean;
  /** The headline figure (energy on the diary): a big number. */
  hero?: boolean;
}

/** Progress bar of an amount against a target (min) or a limit (max). */
export function Bar({ label, amount, unit, target, unknown, hero }: Props) {
  if (unknown) {
    return (
      <div class="bar">
        <div class="bar-head">
          <span>{label}</span>
          <span class="num muted">– {unit}</span>
        </div>
      </div>
    );
  }
  const goal = target?.min ?? target?.max ?? null;
  const pct = goal ? (amount / goal) * 100 : 0;
  const over = target?.max != null && amount > target.max;
  const reached = target?.min != null && amount >= target.min;
  const cls = over ? 'bar over' : reached ? 'bar ok' : 'bar';
  if (hero) {
    // The diary's energy: a big number, the target and % beside it.
    return (
      <div class={`${cls} hero`}>
        <div class="hero-head">
          <span>{label}</span>
          {goal ? <span class="num">{Math.round(pct)} %</span> : null}
        </div>
        <div class="hero-num num">
          {fmtAmount(amount)}
          <small>
            {goal ? ` / ${fmtAmount(goal)}` : ''} {unit}
          </small>
        </div>
        {goal ? (
          <div class="track">
            <div class="fill" style={{ transform: `scaleX(${Math.min(pct, 100) / 100})` }} />
          </div>
        ) : null}
        {/* What is left of the day (M63), in plain words: no alarm colour when it's passed. */}
        {goal ? <p class="hero-left num">{left(goal - amount, unit)}</p> : null}
      </div>
    );
  }
  return (
    <div class={cls}>
      <div class="bar-head">
        <span>{label}</span>
        <span class="num">
          {fmtAmount(amount)}
          {goal ? ` / ${fmtAmount(goal)}` : ''} {unit}
          {goal ? <b> {Math.round(pct)}%</b> : null}
        </span>
      </div>
      {goal ? (
        <div class="track">
          <div class="fill" style={{ transform: `scaleX(${Math.min(pct, 100) / 100})` }} />
        </div>
      ) : null}
    </div>
  );
}

