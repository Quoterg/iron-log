import { fmtAmount } from '../lib/i18n';
import type { Target } from '../lib/targets';

interface Props {
  label: string;
  amount: number;
  unit: string;
  target?: Target;
  /** The value isn't known for this food (not analysed / not entered). */
  unknown?: boolean;
}

/** Progress bar of an amount against a target (min) or a limit (max). */
export function Bar({ label, amount, unit, target, unknown }: Props) {
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
