import { describe, expect, it } from 'vitest';
import { lang, loadLang } from './i18n';
import { to } from './strings-off';
import { ts } from './strings-sync';

describe('lazy screen strings', () => {
  it('Swedish stays Swedish after English has been loaded', async () => {
    await loadLang('en');
    lang.value = 'en';
    expect(ts('syncStart')).toBe('Sync');
    expect(to('offContinue')).toBe('Continue');
    lang.value = 'sv';
    expect(ts('syncTitle')).toBe('Synka med en annan enhet');
    expect(to('offContinue')).toBe('Fortsätt');
    lang.value = 'en';
    expect(ts('syncStart')).toBe('Sync');
  });
});
