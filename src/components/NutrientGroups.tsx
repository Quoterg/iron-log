import { nutrientName, t } from '../lib/i18n';
import { NUTRIENTS, type NutrientGroup } from '../lib/nutrients';
import { targets } from '../state';
import { Bar } from './Bar';

type Title = 'macros' | 'carbsDetail' | 'lipids' | 'vitamins' | 'minerals' | 'aminoAcids' | 'other';

const GROUPS: { group: NutrientGroup[]; title: Title }[] = [
  { group: ['energy', 'macro'], title: 'macros' },
  { group: ['carb'], title: 'carbsDetail' },
  { group: ['lipid'], title: 'lipids' },
  { group: ['vitamin'], title: 'vitamins' },
  { group: ['mineral'], title: 'minerals' },
  { group: ['amino'], title: 'aminoAcids' },
  { group: ['other'], title: 'other' },
];

/**
 * Every tracked nutrient, grouped, against the user's daily targets. `amounts` is in
 * NUTRIENTS order; `known[i] === false` shows the nutrient as unknown instead of 0.
 *
 * `compact` (Näringsämnen, M43): the macros stay open, the other groups fold away behind a line
 * saying how many are under target or over a limit, and nutrients no logged food reports are left
 * out — named once at the end instead of a column of "–".
 */
export function NutrientGroups(props: { amounts: number[]; known?: boolean[]; onSelect?: (key: string) => void; compact?: boolean }) {
  const { amounts, known, onSelect, compact } = props;
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
    const all = NUTRIENTS.map((n, i) => (group.includes(n.group) ? i : -1)).filter((i) => i >= 0);
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
      missing.push(t(title).toLowerCase());
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
    const under = shown.filter((i) => {
      const min = tg[NUTRIENTS[i].key]?.min;
      return min != null && amounts[i] < min;
    }).length;
    const over = shown.filter((i) => {
      const max = tg[NUTRIENTS[i].key]?.max;
      return max != null && amounts[i] > max;
    }).length;
    const status = [under && t('groupUnder').replace('{n}', String(under)), over && t('groupOver').replace('{n}', String(over))].filter(Boolean).join(' · ');
    return (
      <section class="card group" key={title}>
        <details>
          <summary>
            <h2>{t(title)}</h2>
            {status && <span class={over ? 'small warn' : 'small muted'}>{status}</span>}
          </summary>
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
