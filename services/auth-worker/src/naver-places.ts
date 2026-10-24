import { sha256 } from './crypto';
import { HttpError } from './types';
import type { Env } from './types';

export interface NaverPlace {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  latitude?: number;
  longitude?: number;
  naverUrl: string;
}

export const NAVER_SEARCH_URL = 'https://naverapihub.apigw.ntruss.com/search/v1/local';
export const NAVER_LEGACY_SEARCH_URL = 'https://openapi.naver.com/v1/search/local.json';
const validApi = (env: Env) => !env.NAVER_SEARCH_API || ['hub', 'legacy'].includes(env.NAVER_SEARCH_API);

export const naverSearchConfigured = (env: Env) => env.NAVER_SEARCH_ENABLED === 'true'
  && validApi(env) && !!env.NAVER_SEARCH_CLIENT_ID?.trim() && !!env.NAVER_SEARCH_CLIENT_SECRET?.trim()
  && !!env.FIREBASE_PROJECT_ID && !!env.FIREBASE_CLIENT_EMAIL && !!env.FIREBASE_PRIVATE_KEY;

const entities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…',
};

/** Provider text stays plain text: this function never creates DOM or renders HTML. */
export function naverPlainText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  let text = value.slice(0, 10000);
  for (let pass = 0; pass < 2; pass++) {
    text = text.replace(/<[^>]*>/g, '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (!name.startsWith('#')) return entities[name.toLowerCase()] ?? entity;
      const code = name[1].toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
    });
  }
  return text.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function coordinates(item: Record<string, unknown>): { latitude: number; longitude: number } | undefined {
  // The local API returns WGS84 longitude/latitude multiplied by 10^7.
  // Reject legacy KATECH, already-decimal, incomplete, or out-of-Korea coordinates.
  const scaled = (value: unknown) => {
    const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
    return typeof text === 'string' && /^\d{8,10}$/.test(text) ? Number(text) / 1e7 : NaN;
  };
  const longitude = scaled(item.mapx), latitude = scaled(item.mapy);
  return latitude >= 31.43 && latitude <= 44.35 && longitude >= 122.37 && longitude <= 132
    ? { latitude, longitude } : undefined;
}

export function validatePlaceQuery(value: string | null): string {
  const query = value?.trim() ?? '';
  if (!query || query.length > 120 || /[\u0000-\u001f\u007f]/.test(query)) throw new HttpError(400, 'invalid_place_query');
  return query;
}

export async function searchNaverPlaces(query: string, env: Env): Promise<NaverPlace[]> {
  if (!naverSearchConfigured(env)) throw new HttpError(503, 'naver_search_not_configured');
  query = validatePlaceQuery(query);
  const legacy = env.NAVER_SEARCH_API === 'legacy';
  const url = new URL(legacy ? NAVER_LEGACY_SEARCH_URL : NAVER_SEARCH_URL);
  url.search = new URLSearchParams({ query, display: '5', start: '1', sort: 'random', ...(!legacy ? { format: 'json' } : {}) }).toString();
  const headers = new Headers({ Accept: 'application/json', 'Cache-Control': 'no-store' });
  headers.set(legacy ? 'X-Naver-Client-Id' : 'X-NCP-APIGW-API-KEY-ID', env.NAVER_SEARCH_CLIENT_ID!);
  headers.set(legacy ? 'X-Naver-Client-Secret' : 'X-NCP-APIGW-API-KEY', env.NAVER_SEARCH_CLIENT_SECRET!);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url.href, { headers, signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502, response.status === 429 ? 'naver_search_rate_limited' : 'naver_search_failed');
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray((data as { items?: unknown }).items)) throw new HttpError(502, 'naver_search_failed');
    const places: NaverPlace[] = [];
    for (const value of (data as { items: unknown[] }).items.slice(0, 5)) {
      if (!value || typeof value !== 'object') continue;
      const item = value as Record<string, unknown>;
      const name = naverPlainText(item.title, 200), address = naverPlainText(item.address, 300), roadAddress = naverPlainText(item.roadAddress, 300);
      if (!name || !(address || roadAddress)) continue;
      // `item.link` may be an unrelated business website, so never trust it as a map URL.
      const mapQuery = `${name} ${roadAddress || address}`;
      const place = { name, address, roadAddress, ...coordinates(item) };
      places.push({ id: `naver-${(await sha256(JSON.stringify(place))).slice(0, 24)}`, ...place, naverUrl: `https://map.naver.com/p/search/${encodeURIComponent(mapQuery)}` });
    }
    return places;
  } catch (error) {
    if (controller.signal.aborted) throw new HttpError(504, 'naver_search_timeout');
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, 'naver_search_failed');
  } finally {
    clearTimeout(timer);
  }
}
