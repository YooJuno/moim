import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({ auth: { authStateReady: vi.fn(), currentUser: null as null | { uid: string; getIdToken: ReturnType<typeof vi.fn> } } }));
vi.mock('../src/lib/firebase', () => ({ auth: sdk.auth }));
import { isPlaceSearchReady, parsePlaces, searchPlaces } from '../src/lib/place-search';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const place = { id: 'naver-place', name: '농구장 & 코트', address: '서울 지번 1', roadAddress: '서울 도로 1' };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); vi.stubEnv('VITE_AUTH_API_URL', 'https://auth.example.test/');
  sdk.auth.authStateReady.mockReset().mockResolvedValue(undefined);
  sdk.auth.currentUser = { uid: 'member', getIdToken: vi.fn().mockResolvedValue('id-token') };
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('NAVER place search', () => {
  it('keeps an absent backend disabled without making a request and checks only an explicit readiness boolean', async () => {
    vi.stubEnv('VITE_AUTH_API_URL', ''); expect(await isPlaceSearchReady()).toBe(false); expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv('VITE_AUTH_API_URL', 'https://auth.example.test/');
    fetcher.mockResolvedValueOnce(json({ places: { naver: 'true' } })).mockResolvedValueOnce(json({ places: { naver: true } }));
    expect(await isPlaceSearchReady()).toBe(false); expect(await isPlaceSearchReady()).toBe(true);
    expect(fetcher.mock.calls.every(([, options]) => !options.headers && options.credentials === 'omit')).toBe(true);
  });
  it('validates a query before network access, then sends an encoded query with the current Firebase token', async () => {
    for (const query of ['', ' ', 'x'.repeat(121)]) await expect(searchPlaces(query)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled(); fetcher.mockResolvedValue(json({ places: [place] }));
    expect(await searchPlaces('  코트 & 식당  ')).toEqual([place]);
    const [url, options] = fetcher.mock.calls[0]; expect(new URL(url).pathname).toBe('/places/search'); expect(new URL(url).searchParams.get('q')).toBe('코트 & 식당');
    expect(options.headers).toEqual({ Authorization: 'Bearer id-token' }); expect(options.cache).toBe('no-store');
  });
  it('rejects signed-out or changed accounts before exposing results', async () => {
    const user = sdk.auth.currentUser!;
    user.getIdToken.mockImplementation(async () => { sdk.auth.currentUser = null; return 'old-token'; });
    await expect(searchPlaces('코트')).rejects.toThrow('로그인 계정이 변경'); expect(fetcher).not.toHaveBeenCalled();
    await expect(searchPlaces('코트')).rejects.toThrow('로그인이 필요');
    sdk.auth.currentUser = user; user.getIdToken.mockResolvedValue('id-token');
    fetcher.mockImplementation(async () => { sdk.auth.currentUser = null; return json({ places: [place] }); });
    await expect(searchPlaces('코트')).rejects.toThrow('로그인 계정이 변경');
  });
  it('discards cancelled searches and presents a local error for provider outages', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(searchPlaces('코트', controller.signal)).rejects.toMatchObject({ name: 'AbortError' }); expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValue(json({ error: 'private-server-detail' }, 502));
    await expect(searchPlaces('코트')).rejects.toThrow('장소를 검색하지 못했어요.');
  });
  it('bounds and validates results while preserving plain text and rejecting duplicate keys or missing addresses', () => {
    expect(parsePlaces({ places: [place] })).toEqual([place]);
    for (const value of [null, {}, { places: Array(6).fill(place) }, { places: [place, place] }, { places: [{ ...place, name: '' }] }, { places: [{ ...place, address: '', roadAddress: '' }] }, { places: [{ ...place, name: 'bad\u0000' }] }]) expect(() => parsePlaces(value)).toThrow();
  });
});
