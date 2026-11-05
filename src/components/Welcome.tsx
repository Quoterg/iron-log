import { useState } from 'preact/hooks';
import { fmt, t } from '../lib/i18n';
import { energyNeed, withEnergy } from '../lib/targets';
import { back } from '../nav';
import { settings, updateSettings } from '../state';
import { ProfileForm } from './ProfileForm';
import { FeatureList } from './Settings';
import { Sheet } from './Sheet';

/**
 * The first start (M45), opened from the diary's card: the few things the targets need, then the
 * optional features as short choices. Either step can be left; everything is in Settings later.
 */
export default function Welcome() {
  const [step, setStep] = useState<1 | 2>(1);
  const s = settings.value;
  const p = s.profile;
  const finish = async () => {
    await updateSettings({ welcomed: true });
    back();
  };
  const next = async () => {
    // With age, weight and height the target comes from the profile (and its goal) from now on.
    if (energyNeed(p) && !(s.adaptive && s.adaptiveFollow)) {
      await updateSettings({ profile: withEnergy({ ...p, kcalAuto: true }, s.goal ?? 'maintain', s.pace) });
    }
    setStep(2);
  };
  return (
    <Sheet title={t('welcomeTitle')}>
      <div class="pad">
        {step === 1 ? (
          <>
            <p class="muted small">{t('welcomeIntro')}</p>
            <ProfileForm brief />
            <div class="row">
              <button class="btn primary" onClick={() => void next()}>
                {t('welcomeNext')}
              </button>
              <button class="btn" onClick={() => void finish()}>
                {t('welcomeSkip')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{t(p.kcalAuto ? 'welcomeTarget' : 'welcomeTargetDefault').replace('{kcal}', fmt(p.kcal))}</p>
            <p class="muted small">{t('welcomeFeatures')}</p>
            <FeatureList />
            <button class="btn primary" onClick={() => void finish()}>
              {t('welcomeDone')}
            </button>
          </>
        )}
      </div>
    </Sheet>
  );
}
