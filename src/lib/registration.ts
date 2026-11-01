import { needsMemberName } from '../../shared/member-name';
import { validSignupBirthday, validSignupPhone } from '../../shared/registration-fields';
export { validSignupBirthday, validSignupPhone } from '../../shared/registration-fields';

export function registrationComplete(name: string, profile: { phone: string; area: string; birthday?: string } | undefined): boolean {
  return !needsMemberName(name) && name.trim().length <= 30 && !!profile && validSignupPhone(profile.phone) && !!profile.area.trim() && validSignupBirthday(profile.birthday ?? '');
}
