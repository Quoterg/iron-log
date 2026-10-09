import { t } from '../lib/i18n';
import { dayTotals } from '../state';
import { NutrientGroups } from './NutrientGroups';

/** Every tracked nutrient for the day against its NNR target. */
export function Nutrients() {
  return (
    <>
      <NutrientGroups amounts={dayTotals.value} />
      <p class="muted small">{t('targetsNote')}</p>
    </>
  );
}
