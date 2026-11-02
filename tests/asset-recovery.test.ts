import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const current = 'a85924f-20261102T020000Z', next = 'abcdef0-20261102T030000Z';
let reload: ReturnType<typeof vi.fn>, fetcher: ReturnType<typeof vi.fn>, storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); vi.stubEnv('PROD', true); vi.stubGlobal('__APP_RELEASE__', current);
  reload = vi.fn(); storage = new Map();
  vi.stubGlobal('window', { location: { pathname: '/polls', reload }, sessionStorage: {
    getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value),
  } });
  vi.stubGlobal('navigator', { onLine: true });
  fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ release: next })));
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe('deployment asset recovery', () => {
  it('coalesces asset failures and refreshes the exact existing URL only after confirming a different build', async () => {
    const { recoverAssetLoad } = await import('../src/lib/asset-recovery');
    const one = recoverAssetLoad(), two = recoverAssetLoad(); expect(one).toBe(two);
    await expect(one).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(fetcher.mock.calls[0][0]).toBe('/version.json');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    expect(reload).toHaveBeenCalledTimes(1);
    await expect(recoverAssetLoad()).resolves.toBe(false); expect(reload).toHaveBeenCalledTimes(1);
  });
  it.each([current, 'dev', 'https://private-url', null])('keeps explicit retry available without looping for an unchanged or invalid build %s', async release => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ release })));
    const { recoverAssetLoad } = await import('../src/lib/asset-recovery');
    await expect(recoverAssetLoad()).resolves.toBe(false); expect(reload).not.toHaveBeenCalled();
  });
  it('never restarts a one-use OAuth callback, offline page or development build', async () => {
    const { recoverAssetLoad } = await import('../src/lib/asset-recovery');
    window.location.pathname = '/auth/callback'; await expect(recoverAssetLoad()).resolves.toBe(false);
    window.location.pathname = '/polls'; vi.stubGlobal('navigator', { onLine: false }); await expect(recoverAssetLoad()).resolves.toBe(false);
    vi.stubGlobal('navigator', { onLine: true }); vi.stubEnv('PROD', false); await expect(recoverAssetLoad()).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
  });
  it('does not refresh a different screen the user opened while checking the version', async () => {
    fetcher.mockImplementation(async () => { window.location.pathname = '/board'; return new Response(JSON.stringify({ release: next })); });
    const { recoverAssetLoad } = await import('../src/lib/asset-recovery');
    await expect(recoverAssetLoad()).resolves.toBe(false); expect(reload).not.toHaveBeenCalled();
  });
  it('tolerates failed fetches, SPA fallback HTML and blocked storage without refreshing', async () => {
    const { recoverAssetLoad } = await import('../src/lib/asset-recovery');
    fetcher.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(new Response('<html>fallback</html>')).mockResolvedValueOnce(new Response('{}', { status: 503 }));
    for (let index = 0; index < 3; index++) await expect(recoverAssetLoad()).resolves.toBe(false);
    window.sessionStorage.setItem = () => { throw new DOMException('blocked'); };
    await expect(recoverAssetLoad()).resolves.toBe(false); expect(reload).not.toHaveBeenCalled();
  });
  it('bounds a version check to four seconds and returns control when it times out', async () => {
    vi.useFakeTimers(); fetcher.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const { recoverAssetLoad } = await import('../src/lib/asset-recovery');
    const result = recoverAssetLoad(); await vi.advanceTimersByTimeAsync(4000);
    await expect(result).resolves.toBe(false); expect(reload).not.toHaveBeenCalled();
  });
});
