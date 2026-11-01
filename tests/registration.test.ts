import { describe, expect, it } from 'vitest';
import { registrationComplete, validSignupBirthday, validSignupPhone } from '../src/lib/registration';

describe('required registration details', () => {
  const profile = { phone: '010-1234-5678', area: '서울 중랑구', birthday: '02-29' };
  it('requires all four fields and accepts a leap-day birthday without birth year', () => {
    expect(registrationComplete('박성진', profile)).toBe(true);
    expect(registrationComplete('새 멤버', profile)).toBe(false);
    for (const field of ['phone', 'area', 'birthday']) expect(registrationComplete('박성진', { ...profile, [field]: '' })).toBe(false);
    expect(registrationComplete('박성진', undefined)).toBe(false);
    expect(registrationComplete('박성진', { ...profile, area: '   ' })).toBe(false);
  });
  it('rejects invalid mobile numbers and impossible birthdays', () => {
    for (const phone of ['010', '010-123-4567', '010-abcdefgh', '   ']) expect(validSignupPhone(phone)).toBe(false);
    for (const phone of ['01012345678', '010-1234-5678', '+82 10-1234-5678']) expect(validSignupPhone(phone)).toBe(true);
    for (const birthday of ['', '02-30', '04-31', '13-01']) expect(validSignupBirthday(birthday)).toBe(false);
  });
});
