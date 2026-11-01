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

export interface RegistrationPrefill { phone?: string; birthday?: string }

/** Treat provider fields as optional suggestions, keeping only values this form accepts. */
export function registrationPrefill(phone: unknown, birthday?: unknown): RegistrationPrefill {
  const result: RegistrationPrefill = {};
  if (typeof phone === 'string' && validSignupPhone(phone)) {
    let digits = phone.replace(/[\s()+.-]/g, '');
    if (digits.startsWith('0082')) digits = `0${digits.slice(4)}`;
    else if (digits.startsWith('82')) digits = `0${digits.slice(2)}`;
    result.phone = `${digits.slice(0, 3)}-${digits.slice(3, -4)}-${digits.slice(-4)}`;
  }
  if (typeof birthday === 'string') {
    const date = /^\d{4}$/.test(birthday) ? `${birthday.slice(0, 2)}-${birthday.slice(2)}` : birthday;
    if (validSignupBirthday(date)) result.birthday = date;
  }
  return result;
}

/** Never replace personal details someone has already saved. */
export function missingRegistrationFields(current: Record<string, unknown>, suggested: RegistrationPrefill): RegistrationPrefill {
  // A provider never supplies our area field. Keep it empty until the person confirms
  // the signup form, rather than completing an older profile behind their back.
  if (typeof current.area === 'string' && current.area.trim()) return {};
  return Object.fromEntries(Object.entries(suggested).filter(([key, value]) =>
    value && (current[key] === undefined || current[key] === null || typeof current[key] === 'string' && !current[key].trim())
  ));
}
