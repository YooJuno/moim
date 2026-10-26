import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ auth: { currentUser: null as null | { uid: string; getIdToken: ReturnType<typeof vi.fn> } } }));
vi.mock('../src/lib/firebase', () => ({ auth: sdk.auth }));
import { getErrorLogs, parseErrorLogs } from '../src/lib/error-logs';

const entry = { id: 'slot-001', source: 'client', kind: 'auth', code: 'auth/popup-blocked', context: 'google-signin', route: '/', release: 'abcdef0-20261026T120000Z', fingerprint: 'a'.repeat(64), count: 2, firstSeenAt: '2026-10-26T12:00:00.000Z', lastSeenAt: '2026-10-26T12:05:00.000Z', frames: [{ file: 'bootstrap-abc.js', line: 2, column: 3 }] };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); vi.stubEnv('VITE_AUTH_API_URL', 'https://errors.example.test/'); sdk.auth.currentUser = { uid: 'admin', getIdToken: vi.fn().mockResolvedValue('private-id-token') }; });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('administrator error logs', () => {
  it('accepts bounded known records and rejects malformed codes, frames, hashes, limits or counters', () => {
    expect(parseErrorLogs({ enabled: true, errors: [entry] }).errors).toEqual([entry]);
    for (const value of [null, {}, { enabled: true, errors: Array(51).fill(entry) }, ...[{ code: 'private-untrusted-message' }, { fingerprint: 'secret' }, { count: 0 }, { release: 'https://private-url' }, { frames: [{ file: '../private.js', line: 1, column: 1 }] }, { httpStatus: 200 }].map(change => ({ enabled: true, errors: [{ ...entry, ...change }] }))]) expect(() => parseErrorLogs(value)).toThrow();
  });
  it('authenticates reads without placing a token in URLs or request bodies and verifies the account after responding', async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ enabled: true, errors: [entry] })));
    expect((await getErrorLogs()).errors).toEqual([entry]);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://errors.example.test/telemetry/errors?limit=50');
    expect(options.headers).toEqual({ Authorization: 'Bearer private-id-token' }); expect(options.body).toBeUndefined(); expect(options.cache).toBe('no-store');
    fetcher.mockImplementation(async () => { sdk.auth.currentUser = null; return new Response(JSON.stringify({ enabled: true, errors: [entry] })); });
    await expect(getErrorLogs()).rejects.toThrow();
  });
  it('does not expose server messages for missing privilege and does not send anonymous administrator queries', async () => {
    sdk.auth.currentUser = null; await expect(getErrorLogs()).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    sdk.auth.currentUser = { uid: 'pending', getIdToken: vi.fn().mockResolvedValue('pending-token') };
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: 'private-server-details' }), { status: 403 }));
    await expect(getErrorLogs()).rejects.toThrow('관리자만 오류 기록을 확인할 수 있어요.');
  });
  it('times out even if token refresh never settles', async () => {
    vi.useFakeTimers(); sdk.auth.currentUser!.getIdToken.mockReturnValue(new Promise(() => {}));
    const pending = expect(getErrorLogs()).rejects.toThrow('오류 기록을 불러오지 못했어요.');
    await vi.advanceTimersByTimeAsync(10000); await pending; expect(fetcher).not.toHaveBeenCalled();
  });
});
