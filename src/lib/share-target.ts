/** Rebuild only known deep links; discard tokens, fragments and arbitrary redirects. */
export function sharedDestination(path: string | undefined, search = ''): string | undefined {
  if (!path) return;
  const key = path === '/polls' ? 'poll' : path === '/calendar' ? 'event' : null;
  if (!key) return;
  const params = new URLSearchParams(search);
  const id = params.get(key);
  if (!id || !/^[A-Za-z0-9:_-]{1,128}$/.test(id) || params.getAll(key).length !== 1) return;
  return `${path}?${key}=${encodeURIComponent(id)}`;
}

export function validSharedDestination(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const index = value.indexOf('?');
  return index >= 0 && sharedDestination(value.slice(0, index), value.slice(index)) === value;
}
