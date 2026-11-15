import type { Target } from './targets';

/** How a group of nutrients stands against its targets (M43; M66 counts the reached ones too). */
export interface GroupCount {
  /** Nutrients with a target to reach (a minimum). */
  withMin: number;
  /** Of those, how many are still under it. */
  under: number;
  /** Nutrients past their limit (a maximum). */
  over: number;
}

export function groupCount(keys: string[], amounts: number[], targets: Record<string, Target | undefined>): GroupCount {
  let withMin = 0;
  let under = 0;
  let over = 0;
  keys.forEach((key, i) => {
    const t = targets[key];
    if (t?.min != null) {
      withMin++;
      if (amounts[i] < t.min) under++;
    }
    if (t?.max != null && amounts[i] > t.max) over++;
  });
  return { withMin, under, over };
}

/**
 * The words for a folded group, as parts joined by " · ". A finished day or a period says how many
 * are under target; today, still going (`partial`, M66), says how many are reached so far — "10
 * under målet" at breakfast reads as an alarm about a day that isn't over. A limit passed is said
 * either way: that doesn't get better as the day goes on.
 */
export function groupStatus(c: GroupCount, partial: boolean): { kind: 'reached' | 'under' | 'over'; n: number; m?: number }[] {
  const out: { kind: 'reached' | 'under' | 'over'; n: number; m?: number }[] = [];
  if (partial) {
    if (c.withMin) out.push({ kind: 'reached', n: c.withMin - c.under, m: c.withMin });
  } else if (c.under) out.push({ kind: 'under', n: c.under });
  if (c.over) out.push({ kind: 'over', n: c.over });
  return out;
}
