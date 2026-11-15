import { nutrientName, t } from '../lib/i18n';
import { NUTRIENTS, type NutrientGroup } from '../lib/nutrients';
import { targets } from '../state';
import { groupCount, groupStatus } from '../lib/group-status';
import { Bar } from './Bar';

type Title = 'macros' | 'dietPattern' | 'carbsDetail' | 'lipids' | 'vitamins' | 'minerals' | 'aminoAcids' | 'other';

const GROUPS: { group: NutrientGroup[]; title: Title }[] = [
  { group: ['energy', 'macro'], title: 'macros' },
  { group: ['carb'], title: 'carbsDetail' },
  // Food-based goals (M52): in Näringsämnen only, wholegrain leaves the carbohydrates group.
  { group: [], title: 'dietPattern' },
  { group: ['lipid'], title: 'lipids' },
  { group: ['vitamin'], title: 'vitamins' },
  { group: ['mineral'], title: 'minerals' },
  { group: ['amino'], title: 'aminoAcids' },
  { group: ['other'], title: 'other' },
];

/** Nutrients shown as food-based goals under "Kostmönster" in Näringsämnen (M52a). */
const PATTERN = ['wholegrain'];
const PATTERN_IDX = new Set(NUTRIENTS.flatMap((n, i) => (PATTERN.includes(n.key) ? [i] : [])));

/** Indices of the nutrients a card shows: the pattern card its own, the others by group without them. */
function indices(group: NutrientGroup[], isPattern: boolean, compact?: boolean): number[] {
  return NUTRIENTS.map((_, i) => i).filter((i) => (isPattern ? PATTERN_IDX.has(i) : group.includes(NUTRIENTS[i].group) && !(compact && PATTERN_IDX.has(i))));
}

/**
 * Every tracked nutrient, grouped, against the user's daily targets. `amounts` is in
 * NUTRIENTS order; `known[i] === false` shows the nutrient as unknown instead of 0.
 *
 * `compact` (Näringsämnen, M43): the macros stay open, the other groups fold away behind a line
 * saying how many are under target or over a limit, and nutrients no logged food reports are left
 * out — named once at the end instead of a column of "–".
 */
/**
 * `empty`: nothing logged — the targets only, no "under målet" (M45). `partial`: today, still going
 * (M66) — a group says how many targets are reached so far, not how many are short; a limit passed
 * is still said.
 */
export function NutrientGroups(props: { amounts: number[]; known?: boolean[]; onSelect?: (key: string) => void; compact?: boolean; empty?: boolean; partial?: boolean }) {
  const { amounts, known, onSelect, compact, empty, partial } = props;
  const tg = targets.value;
  const row = (i: number) => {
    const n = NUTRIENTS[i];
    const bar = (k?: string) => <Bar key={k} label={nutrientName(n)} amount={amounts[i]} unit={n.unit} target={tg[n.key]} unknown={known?.[i] === false} />;
    return onSelect ? (
      <button key={n.key} class="bar-btn" onClick={() => onSelect(n.key)}>
        {bar()}
      </button>
    ) : (
      bar(n.key)
    );
  };
  const missing: string[] = [];
  const cards = GROUPS.map(({ group, title }) => {
    const isPattern = title === 'dietPattern';
    if (isPattern && !compact) return null;
    const all = indices(group, isPattern, compact);
    if (!compact) {
      return (
        <section class="card" key={title}>
          <h2>{t(title)}</h2>
          {all.map(row)}
        </section>
      );
    }
    const shown = all.filter((i) => known?.[i] !== false);
    const unknown = all.filter((i) => known?.[i] === false);
    // A whole group without data is named as a group ("aminosyror"), else nutrient by nutrient.
    if (!shown.length) {
      if (isPattern) missing.push(...unknown.map((i) => nutrientName(NUTRIENTS[i])));
      else missing.push(t(title).toLowerCase());
      return null;
    }
    missing.push(...unknown.map((i) => nutrientName(NUTRIENTS[i])));
    if (title === 'macros') {
      return (
        <section class="card" key={title}>
          <h2>{t(title)}</h2>
          {shown.map(row)}
        </section>
      );
    }
    const count = groupCount(shown.map((i) => NUTRIENTS[i].key), shown.map((i) => amounts[i]), tg);
    const over = count.over;
    const words = { reached: t('groupReached'), under: t('groupUnder'), over: t('groupOver') };
    const status = empty
      ? ''
      : groupStatus(count, !!partial)
          .map((x) => words[x.kind].replace('{n}', String(x.n)).replace('{m}', String(x.m)))
          .join(' · ');
    return (
      <section class="card group" key={title}>
        <details>
          <summary>
            <h2>{t(title)}</h2>
            {status && <span class={over ? 'small warn' : 'small muted'}>{status}</span>}
          </summary>
          {isPattern && <p class="muted small">{t('dietPatternNote')}</p>}
          {shown.map(row)}
        </details>
      </section>
    );
  });
  return (
    <>
      {cards}
      {compact && missing.length > 0 && <p class="muted small">{t('noDataNutrients').replace('{list}', missing.join(', '))}</p>}
    </>
  );
}
