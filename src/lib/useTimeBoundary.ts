import { useEffect, useMemo, useState } from 'react';

/** Refresh time-dependent views at their next boundary, and after returning to the tab. */
export function useTimeBoundary(boundaries: number[]): number {
  const [revision, setRevision] = useState(0);
  const now = useMemo(() => Date.now(), [boundaries, revision]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    const visible = () => { if (!document.hidden) refresh(); };
    const day = 86400000, koreaOffset = 9 * 3600000;
    const midnight = (Math.floor((now + koreaOffset) / day) + 1) * day - koreaOffset;
    const next = boundaries.reduce((next, value) => Number.isFinite(value) && value > now ? Math.min(next, value) : next, midnight);
    const timer = Number.isFinite(next) ? setTimeout(refresh, Math.min(Math.max(0, next - Date.now()), 2147483647)) : undefined;
    document.addEventListener('visibilitychange', visible);
    window.addEventListener('focus', refresh);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', visible); window.removeEventListener('focus', refresh); };
  }, [boundaries, now]);
  return now;
}
