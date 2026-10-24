import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/lib/store',()=>({useApp:()=>{throw new Error('Provider not rendered by pure tests');}}));
import { DEFAULT_PREFERENCES, normalizePreferences, preferencesCacheKey } from '../src/lib/preferences';
import { formatI18nCurrency, formatI18nDate, getLanguage, getLocale, registerEnglishMessages, setLanguage, translate } from '../src/lib/i18n';
import { birthdayLabel } from '../src/components/BirthdayField';

beforeEach(()=>setLanguage('ko'));
describe('personal preferences and translations',()=>{
  it('defaults to Korean and system theme and accepts only supported values',()=>{expect(normalizePreferences(null)).toEqual(DEFAULT_PREFERENCES);expect(normalizePreferences({language:'fr',theme:'automatic'})).toEqual({language:'ko',theme:'system'});expect(normalizePreferences({language:'en',theme:'dark',phone:'ignored'})).toEqual({language:'en',theme:'dark'});expect(preferencesCacheKey('first-user')).not.toBe(preferencesCacheKey('second-user'));});
  it('translates real labels and interpolates numbered values without altering member data',()=>{registerEnglishMessages({'가능 {0}명':'{0} available'});setLanguage('en');expect(getLanguage()).toBe('en');expect(getLocale()).toBe('en-US');expect(translate('내 정보')).toBe('My profile');expect(translate('가능 {0}명','en',{'0':4})).toBe('4 available');expect(translate('김민서')).toBe('김민서');setLanguage('ko');expect(translate('내 정보')).toBe('내 정보');});
  it('formats English dates in the meeting timezone and keeps Korean-won currency',()=>{expect(formatI18nDate('2026-10-24T23:30:00Z','en',{year:'numeric',month:'long',day:'numeric'})).toBe('October 25, 2026');expect(formatI18nCurrency(10000,'en')).toContain('10,000');expect(formatI18nCurrency(10000,'en')).not.toContain('$');});
  it('updates recurring birthday labels with the selected language and preserves leap day',()=>{expect(birthdayLabel('10-24')).toBe('10월 24일');setLanguage('en');expect(birthdayLabel('10-24')).toBe('October 24');expect(birthdayLabel('02-29')).toBe('February 29');setLanguage('ko');expect(birthdayLabel('02-29')).toBe('2월 29일');});
});
