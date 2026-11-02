let pending: Promise<boolean> | undefined;
const key = 'moim-asset-recovery:v1';
const releasePattern = /^[a-f0-9]{7,40}-\d{8}T\d{6}Z$/;

/** Refresh only for a confirmed newer deployment, at most once per minute. */
export function recoverAssetLoad(): Promise<boolean> {
  if (pending) return pending;
  pending = recover().finally(() => { pending = undefined; });
  return pending;
}

async function recover(): Promise<boolean> {
  if (!import.meta.env.PROD || navigator.onLine === false || window.location.pathname === '/auth/callback') return false;
  const path = window.location.pathname, search = window.location.search;
  const release = typeof __APP_RELEASE__ === 'string' ? __APP_RELEASE__ : 'dev';
  if (!releasePattern.test(release)) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const last = Number(window.sessionStorage.getItem(key));
    if (last > 0 && Date.now() - last < 60000) return false;
    const response = await fetch('/version.json', { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (!response.ok) return false;
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object' || !('release' in value) || typeof value.release !== 'string' || !releasePattern.test(value.release) || value.release === release) return false;
    if (window.location.pathname !== path || window.location.search !== search) return false;
    // If storage is unavailable, leave the explicit refresh button available.
    window.sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
    return true;
  } catch { return false; }
  finally { clearTimeout(timer); }
}
