import { t } from '../lib/i18n';
import type { SettingsPageKind } from '../nav';
import { AdaptiveEnergy } from './AdaptiveEnergy';
import { EnergyTarget, ProfileForm } from './ProfileForm';
import { FeatureList, General, MyFoods, MyRecipes, SavedMealsCard, SyncCard } from './Settings';
import { back, stack } from '../nav';
import { YourData } from './YourData';

const TITLE = {
  profile: 'settingsProfile',
  energy: 'settingsEnergy',
  features: 'settingsFeatures',
  library: 'settingsLibrary',
  data: 'settingsData',
} as const;

/** One page of Settings (M44), in the Settings tab; back (button or gesture) returns to the list. */
export default function SettingsPage({ page }: { page: SettingsPageKind }) {
  // Back names where it goes: another page when opened from one (Profil & mål → Energimål).
  const below = stack.value[stack.value.map((x) => x.kind).lastIndexOf('settings') - 1];
  return (
    <>
      <header class="page-head">
        <button class="btn small" onClick={back}>
          ‹ {below?.kind === 'settings' ? t(TITLE[below.page]) : t('settings')}
        </button>
        <h2>{t(TITLE[page])}</h2>
      </header>
      <div>
        {page === 'profile' && <ProfileForm />}
        {page === 'energy' && (
          <>
            <EnergyTarget />
            <AdaptiveEnergy />
          </>
        )}
        {page === 'features' && <FeatureList />}
        {page === 'library' && (
          <>
            <MyFoods />
            <MyRecipes />
            <SavedMealsCard />
          </>
        )}
        {page === 'data' && (
          <>
            <General />
            <SyncCard />
            <YourData />
          </>
        )}
      </div>
    </>
  );
}
