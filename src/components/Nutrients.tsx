import { lang, t } from '../lib/i18n';
import { NUTRIENTS, type NutrientGroup } from '../lib/nutrients';
import { dayTotals, targets } from '../state';
import { Bar } from './Bar';

const GROUPS: { group: NutrientGroup[]; title: 'macros' | 'carbsDetail' | 'lipids' | 'vitamins' | 'minerals' | 'other' }[] = [
  { group: ['energy', 'macro'], title: 'macros' },
  { group: ['carb'], title: 'carbsDetail' },
  { group: ['lipid'], title: 'lipids' },
  { group: ['vitamin'], title: 'vitamins' },
  { group: ['mineral'], title: 'minerals' },
  { group: ['other'], title: 'other' },
];

/** Every tracked nutrient for the day against its NNR target. */
export function Nutrients() {
  const tot = dayTotals.value;
  const tg = targets.value;
  return (
    <>
      {GROUPS.map(({ group, title }) => (
        <section class="card" key={title}>
          <h2>{t(title)}</h2>
          {NUTRIENTS.map((n, i) =>
            group.includes(n.group) ? (
              <Bar key={n.key} label={n[lang.value]} amount={tot[i]} unit={n.unit} target={tg[n.key]} />
            ) : null,
          )}
        </section>
      ))}
      <p class="muted small">{t('targetsNote')}</p>
    </>
  );
}
