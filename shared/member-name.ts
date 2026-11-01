/** Old OAuth fallbacks are not a person's name. Preserve names people have saved. */
export function needsMemberName(value: unknown): boolean {
  return typeof value !== 'string' || ['', '새멤버', 'newmember'].includes(value.replace(/\s/g, '').toLowerCase());
}

export function memberDisplayName(...values: unknown[]): string {
  const value = values.find(value => typeof value === 'string' && !needsMemberName(value));
  return typeof value === 'string' ? value.trim().slice(0, 30) : '새 멤버';
}
