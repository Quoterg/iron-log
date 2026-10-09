import { t } from '../lib/i18n';
import { open } from '../nav';
import { dayTotals } from '../state';
import { NutrientGroups } from './NutrientGroups';

/** Every tracked nutrient for the day against its NNR target. */
export function Nutrients() {
  return (
    <>
      <NutrientGroups amounts={dayTotals.value} />
      <button class="btn wide" onClick={() => open({ kind: 'targets' })}>
        {t('adjustTargets')}
      </button>
      <p class="muted small">{t('targetsNote')}</p>
    </>
  );
}
