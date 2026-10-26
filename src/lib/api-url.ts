export function getAuthAPIURL(value?: string): string | null {
  const configured = value ?? import.meta.env.VITE_AUTH_API_URL;
  if (typeof configured !== 'string' || !configured.trim()) return null;
  try {
    const url = new URL(configured);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url.href;
  } catch { return null; }
}
