import { needsMemberName } from '../../shared/member-name';

export function validSignupPhone(value: string): boolean {
  let phone = value.replace(/[\s()+.-]/g, '');
  if (phone.startsWith('0082')) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith('82')) phone = `0${phone.slice(2)}`;
  return /^(?:010\d{8}|01[16789]\d{7,8})$/.test(phone);
}

export function validSignupBirthday(value: string): boolean {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`2000-${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(5, 10) === value;
}

export function registrationComplete(name: string, profile: { phone: string; area: string; birthday?: string } | undefined): boolean {
  return !needsMemberName(name) && name.trim().length <= 30 && !!profile && validSignupPhone(profile.phone) && !!profile.area.trim() && validSignupBirthday(profile.birthday ?? '');
}
