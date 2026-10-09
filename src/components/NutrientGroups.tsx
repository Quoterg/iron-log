import { lang, t } from '../lib/i18n';
import { NUTRIENTS, type NutrientGroup } from '../lib/nutrients';
import { targets } from '../state';
import { Bar } from './Bar';

type Title = 'macros' | 'carbsDetail' | 'lipids' | 'vitamins' | 'minerals' | 'other';

const GROUPS: { group: NutrientGroup[]; title: Title }[] = [
  { group: ['energy', 'macro'], title: 'macros' },
  { group: ['carb'], title: 'carbsDetail' },
  { group: ['lipid'], title: 'lipids' },
  { group: ['vitamin'], title: 'vitamins' },
  { group: ['mineral'], title: 'minerals' },
  { group: ['other'], title: 'other' },
];

/**
 * Every tracked nutrient, grouped, against the user's daily targets. `amounts` is in
 * NUTRIENTS order; `known[i] === false` shows the nutrient as unknown instead of 0.
 */
export function NutrientGroups({ amounts, known }: { amounts: number[]; known?: boolean[] }) {
  const tg = targets.value;
  return (
    <>
      {GROUPS.map(({ group, title }) => (
        <section class="card" key={title}>
          <h2>{t(title)}</h2>
          {NUTRIENTS.map((n, i) =>
            group.includes(n.group) ? (
              <Bar
                key={n.key}
                label={n[lang.value]}
                amount={amounts[i]}
                unit={n.unit}
                target={tg[n.key]}
                unknown={known?.[i] === false}
              />
            ) : null,
          )}
        </section>
      ))}
    </>
  );
}
