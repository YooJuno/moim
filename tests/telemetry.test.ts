import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorCode, errorFrames, makeErrorReport } from '../src/lib/telemetry';

const origin = 'https://moim.example.test';
beforeEach(() => {
  vi.stubGlobal('window', { location: { origin, pathname: '/auth/callback', search: '?code=private-oauth-code&token=private-token' } });
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone) Version/18.0 Mobile Safari/605.1 private-device-info' });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('safe error reports', () => {
  it('retains diagnostic codes and asset line numbers while discarding personal data, OAuth parameters and SDK payloads', () => {
    const error = Object.assign(new Error('private@email.test 01012345678 private-token 서울 중랑구 게시글 본문'), {
      code: 'auth/popup-blocked', customData: { token: 'private-token', email: 'private@email.test' },
      stack: `Error: private@email.test\n at privateName (${origin}/assets/index-AbCd123.js:24:82)\n at secret (https://third-party.test/assets/sdk.js:2:4)\n at secret (${origin}/private-user-id.ts:2:3)\n at secret (${origin}/assets/x.js?token=private-token:2:4)`,
    });
    const report = makeErrorReport(error, { kind: 'auth', context: 'google-signin' });
    expect(report).toMatchObject({ kind: 'auth', code: 'auth/popup-blocked', context: 'google-signin', route: '/auth/callback', browser: 'safari', device: 'mobile', frames: [{ file: 'index-AbCd123.js', line: 24, column: 82 }] });
    expect(JSON.stringify(report)).not.toMatch(/private|01012345678|중랑구|게시글|https:|code=|token=/);
    expect(Object.keys(report)).not.toContain('message');
  });
  it('classifies only known codes and never turns arbitrary messages into fields', () => {
    expect(errorCode(Object.assign(new Error('secret'), { code: 'auth/member-load-timeout' }))).toBe('auth/member-load-timeout');
    expect(errorCode(new Error('Firebase: Error (auth/network-request-failed).'))).toBe('auth/network-request-failed');
    expect(errorCode(new TypeError('private expression'))).toBe('type-error');
    expect(errorCode(new Error('Failed to fetch dynamically imported module: https://private/path'))).toBe('chunk-load-failed');
    expect(errorCode({ code: 'private-code', message: 'private-message', name: 'private-name' })).toBe('unknown-error');
    expect(errorCode('private rejected promise')).toBe('unknown-error');
    window.location.pathname = '/members/private-user-id';
    expect(makeErrorReport(new Error()).route).toBe('unknown');
  });
  it('bounds frames and refuses URL credentials, queries, hashes, private paths or impossible positions', () => {
    const lines = [`${origin}/assets/a.js:1:0`, `${origin}/assets/b.js:10000001:1`, `${origin}/assets/c.js#private:1:1`, `https://private@moim.example.test/assets/d.js:1:1`, ...Array.from({ length: 10 }, (_, index) => `${origin}/assets/file-${index}.js:2:3`)];
    expect(errorFrames({ stack: `Error\n${lines.map(line => ` at ${line}`).join('\n')}` }, origin)).toEqual(Array.from({ length: 5 }, (_, index) => ({ file: `file-${index}.js`, line: 2, column: 3 })));
  });
});

describe('best effort error transport', () => {
  it('does not send demo/development reports, deduplicates real errors, and bounds a production page to five reports per minute', async () => {
    vi.resetModules();
    const { reportError } = await import('../src/lib/telemetry');
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 202 })); vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('VITE_AUTH_API_URL', 'https://errors.example.test/'); vi.stubEnv('PROD', false);
    reportError(new Error('dev')); expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv('PROD', true); vi.stubEnv('VITE_DEMO_MODE', 'true');
    reportError(new Error('demo')); expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv('VITE_DEMO_MODE', 'false');
    const error = Object.assign(new Error('private'), { code: 'auth/popup-blocked' });
    reportError(error, { kind: 'auth', context: 'google-signin' }); reportError(error);
    for (const code of ['type-error', 'reference-error', 'syntax-error', 'range-error', 'network-error', 'application-error']) reportError({ code });
    expect(fetcher).toHaveBeenCalledTimes(5);
    const [url, options] = fetcher.mock.calls[0];
    expect(String(url)).toBe('https://errors.example.test/telemetry/errors');
    expect(options.credentials).toBe('omit'); expect(options.referrerPolicy).toBe('no-referrer');
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(options.body).not.toContain('private');
    await Promise.resolve(); await Promise.resolve();
  });
  it('never throws or retries recursively when the reporting server or error object fails', async () => {
    vi.resetModules(); const { reportError } = await import('../src/lib/telemetry');
    vi.stubEnv('PROD', true); vi.stubEnv('VITE_DEMO_MODE', 'false'); vi.stubEnv('VITE_AUTH_API_URL', 'https://errors.example.test/');
    const fetcher = vi.fn().mockRejectedValue(new TypeError('offline')); vi.stubGlobal('fetch', fetcher);
    expect(() => reportError(new TypeError('private'))).not.toThrow();
    expect(() => reportError(Object.defineProperty({}, 'code', { get() { throw new Error('bad getter'); } }))).not.toThrow();
    await Promise.resolve(); await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
