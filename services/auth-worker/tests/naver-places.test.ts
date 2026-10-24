import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { NAVER_LEGACY_SEARCH_URL, NAVER_SEARCH_URL, naverPlainText, searchNaverPlaces } from '../src/naver-places';
import { HttpError } from '../src/types';
import type { Dependencies, Env, FirebaseIdentity } from '../src/types';

const origin = 'https://app.test';
const env: Env = {
  FIREBASE_PROJECT_ID: 'demo-moim', FIREBASE_CLIENT_EMAIL: 'worker@example.test', FIREBASE_PRIVATE_KEY: 'fake-private-key',
  ALLOWED_ORIGINS: origin, NAVER_SEARCH_ENABLED: 'true', NAVER_SEARCH_API: 'hub',
  NAVER_SEARCH_CLIENT_ID: 'search-test-id', NAVER_SEARCH_CLIENT_SECRET: 'search-test-secret',
};
const item = {
  title: '<b>테스트</b> 코트 &amp; 카페', address: '서울특별시 테스트구 테스트동', roadAddress: '서울특별시 테스트구 테스트로 1',
  mapx: '1269873882', mapy: '375666103', link: 'javascript:alert("not a map")', telephone: 'private-number',
};
const upstream = (items: unknown[] = [item]) => new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json' } });
let nextIp = 0, ip: string, memberStatus: string | undefined, current: FirebaseIdentity | null, deps: Dependencies;
const request = (query = '테스트 코트', token: string | null = 'valid', extra = '') => new Request(`https://worker.test/places/search?q=${encodeURIComponent(query)}${extra}`, {
  headers: { Origin: origin, 'CF-Connecting-IP': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});

beforeEach(() => {
  ip = `192.0.2.${++nextIp}`;
  memberStatus = 'active'; current = { uid: 'user-1', validSince: 100 };
  deps = {
    now: () => 1800000000000,
    store: {
      get: vi.fn(async (path) => path === 'members/user-1' && memberStatus ? { data: { status: memberStatus, phone: 'private-phone', email: 'private-email' }, version: '1' } as any : null),
      commit: vi.fn(async () => { throw new Error('Search must not write data'); }),
    },
    verifyIdToken: vi.fn(async token => { if (token !== 'valid') throw new HttpError(401, 'invalid_firebase_token'); return { uid: 'user-1', authTime: 200 }; }),
    lookupUser: vi.fn(async () => current),
    createUser: vi.fn(), customToken: vi.fn(), providerExchange: vi.fn(),
  };
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('authenticated Naver place search', () => {
  it('publishes only readiness and never enables OAuth with search credentials', async () => {
    const app = createApp(env, deps);
    const response = await app.fetch(new Request('https://worker.test/config', { headers: { Origin: origin } }));
    expect(await response.json()).toEqual({ providers: { kakao: false, naver: false }, calendar: { kakao: false }, notifications: { sms: false }, places: { naver: true } });
    const disabled = createApp({ ...env, NAVER_SEARCH_ENABLED: 'false' }, deps);
    expect((await (await disabled.fetch(new Request('https://worker.test/config'))).json() as any).places.naver).toBe(false);
    const missing = createApp({ ...env, NAVER_SEARCH_CLIENT_SECRET: '' }, deps);
    expect((await (await missing.fetch(new Request('https://worker.test/config'))).json() as any).places.naver).toBe(false);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('authenticates active and pending readers without returning private member fields', async () => {
    const http = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream());
    const app = createApp(env, deps);
    for (const status of ['active', 'pending']) {
      memberStatus = status;
      const response = await app.fetch(request('  테스트 코트 & 카페  ', 'valid', '&url=https://evil.test'));
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.places).toHaveLength(1);
      expect(data.places[0]).toMatchObject({ name: '테스트 코트 & 카페', address: item.address, roadAddress: item.roadAddress, latitude: 37.5666103, longitude: 126.9873882 });
      expect(data.places[0].id).toMatch(/^naver-[A-Za-z0-9_-]{24}$/);
      expect(new URL(data.places[0].naverUrl).origin).toBe('https://map.naver.com');
      expect(JSON.stringify(data)).not.toMatch(/search-test|fake-private|private-|javascript|<b>/);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(origin);
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    }
    const [target, options] = http.mock.calls[0];
    const url = new URL(String(target));
    expect(url.origin + url.pathname).toBe(NAVER_SEARCH_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({ query: '테스트 코트 & 카페', display: '5', start: '1', sort: 'random', format: 'json' });
    const headers = new Headers(options?.headers);
    expect(headers.get('X-NCP-APIGW-API-KEY-ID')).toBe('search-test-id');
    expect(headers.get('X-NCP-APIGW-API-KEY')).toBe('search-test-secret');
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('Origin')).toBe(false);
    expect(options?.redirect).toBe('error');
    expect(deps.store.commit).not.toHaveBeenCalled();
    expect(vi.mocked(deps.store.get).mock.calls.map(call => call[0])).toEqual(['members/user-1', 'members/user-1']);
  });

  it('rejects missing, forged, disabled, deleted, revoked, and rejected users before external HTTP', async () => {
    const http = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream());
    const app = createApp(env, deps);
    expect((await app.fetch(request('장소', null))).status).toBe(401);
    expect((await app.fetch(request('장소', 'forged'))).status).toBe(401);
    current = { uid: 'user-1', disabled: true }; expect((await app.fetch(request())).status).toBe(401);
    current = null; expect((await app.fetch(request())).status).toBe(401);
    current = { uid: 'user-1', validSince: 201 }; expect((await app.fetch(request())).status).toBe(401);
    current = { uid: 'user-1' };
    for (const status of ['rejected', 'removed', undefined]) {
      memberStatus = status;
      expect((await app.fetch(request())).status).toBe(403);
    }
    const foreign = new Request(request(), { headers: { Origin: 'https://evil.test', Authorization: 'Bearer valid' } });
    expect((await app.fetch(foreign)).status).toBe(403);
    expect(http).not.toHaveBeenCalled();
  });

  it('does not call the provider for blank, oversized, or control-character queries or absent configuration', async () => {
    const http = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream());
    const app = createApp(env, deps);
    for (const query of ['', '   ', 'a'.repeat(121), 'hello\nworld']) expect((await app.fetch(request(query))).status).toBe(400);
    for (const changes of [{ NAVER_SEARCH_ENABLED: 'false' }, { NAVER_SEARCH_CLIENT_ID: '' }, { NAVER_SEARCH_CLIENT_SECRET: '' }, { NAVER_SEARCH_API: 'https://evil.test' }]) {
      const response = await createApp({ ...env, ...changes }, deps).fetch(request());
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: 'naver_search_not_configured' });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
    expect((await app.fetch(new Request('https://worker.test/places/search', { method: 'POST' }))).status).toBe(404);
    expect(http).not.toHaveBeenCalled();
  });

  it('returns opaque upstream errors without credentials, query echoes, or response caching', async () => {
    const http = vi.spyOn(globalThis, 'fetch');
    const app = createApp(env, deps);
    const failures: [() => Promise<Response>, number, string][] = [
      [async () => new Response('search-test-secret private-email', { status: 401 }), 502, 'naver_search_failed'],
      [async () => new Response('search-test-secret', { status: 429 }), 429, 'naver_search_rate_limited'],
      [async () => new Response('bad json'), 502, 'naver_search_failed'],
      [async () => new Response('{}'), 502, 'naver_search_failed'],
      [async () => { throw new Error('search-test-secret'); }, 502, 'naver_search_failed'],
    ];
    for (const [handler, status, error] of failures) {
      http.mockImplementationOnce(handler);
      const response = await app.fetch(request());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
    expect(http).toHaveBeenCalledTimes(failures.length);
  });

  it('aborts a stalled upstream request after ten seconds without retrying', async () => {
    vi.useFakeTimers();
    const http = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_target, options) => new Promise((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = createApp(env, deps).fetch(request());
    await vi.advanceTimersByTimeAsync(10000);
    const response = await pending;
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: 'naver_search_timeout' });
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});

describe('Naver local adapter', () => {
  it('also accepts scaled integer coordinates from legacy JSON responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream([{ ...item, mapx: 1269873882, mapy: 375666103 }]));
    const places = await searchNaverPlaces('테스트', { ...env, NAVER_SEARCH_API: 'legacy' });
    expect(places[0]).toMatchObject({ latitude: 37.5666103, longitude: 126.9873882 });
  });

  it('supports only a fixed legacy endpoint and its separate authentication headers', async () => {
    const http = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream());
    const places = await searchNaverPlaces('테스트', { ...env, NAVER_SEARCH_API: 'legacy' });
    const [target, options] = http.mock.calls[0];
    expect(String(target).split('?')[0]).toBe(NAVER_LEGACY_SEARCH_URL);
    const headers = new Headers(options?.headers);
    expect(headers.get('X-Naver-Client-Id')).toBe('search-test-id');
    expect(headers.get('X-Naver-Client-Secret')).toBe('search-test-secret');
    expect(headers.has('X-NCP-APIGW-API-KEY')).toBe(false);
    expect(places[0].name).toBe('테스트 코트 & 카페');
  });

  it('caps results, removes markup, and omits unsupported or incomplete coordinates', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => upstream([
      { ...item, title: '&lt;b&gt;코트&lt;/b&gt; &#x26; &#39;카페&#39;' },
      { ...item, mapx: '311277', mapy: '552097' },
      { ...item, mapx: '126.9873882', mapy: '37.5666103' },
      { ...item, mapx: '9999999999' },
      { ...item, mapy: undefined },
      item,
    ]));
    const places = await searchNaverPlaces('테스트', env);
    expect(places).toHaveLength(5);
    expect(places[0].name).toBe("코트 & '카페'");
    for (const place of places.slice(1)) {
      expect(place).not.toHaveProperty('latitude');
      expect(place).not.toHaveProperty('longitude');
    }
    expect(naverPlainText('&#1114112; &#xD800; <img src=x onerror=alert(1)>카페', 200)).toBe('카페');
  });
});
