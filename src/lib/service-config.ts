import { getAuthAPIURL } from './api-url';
import { withRequestDeadline } from './request-deadline';

export interface ServiceConfig {
  providers: { kakao: boolean; naver: boolean };
  calendar: { kakao: boolean };
  notifications: { sms: boolean };
  places: { naver: boolean };
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const failure = () => new Error('서비스 연결 설정을 확인하지 못했어요. 다시 시도해 주세요.');
let cached: { base: string; value: ServiceConfig; expires: number } | undefined;
let pending: { base: string; promise: Promise<ServiceConfig> } | undefined;
export function clearServiceConfigCache() { cached = undefined; pending = undefined; }

function parse(value: unknown): ServiceConfig {
  if (!object(value) || !['providers', 'calendar', 'notifications', 'places'].some(key => object(value[key]))) throw failure();
  const section = (key: string) => object(value[key]) ? value[key] as Record<string, unknown> : {};
  return Object.freeze({
    providers: Object.freeze({ kakao: section('providers').kakao === true, naver: section('providers').naver === true }),
    calendar: Object.freeze({ kakao: section('calendar').kakao === true }),
    notifications: Object.freeze({ sms: section('notifications').sms === true }),
    places: Object.freeze({ naver: section('places').naver === true }),
  });
}

/** Public feature flags only. Concurrent readers share one request for 60 seconds. */
export async function getServiceConfig(signal?: AbortSignal): Promise<ServiceConfig | null> {
  signal?.throwIfAborted();
  const base = getAuthAPIURL();
  if (!base) return null;
  if (cached?.base === base && cached.expires > Date.now()) return cached.value;
  if (pending?.base !== base) {
    const request = { base, promise: undefined as unknown as Promise<ServiceConfig> };
    request.promise = withRequestDeadline(async requestSignal => {
      const response = await fetch(new URL('config', base), { signal: requestSignal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!response.ok) throw failure();
      return parse(await response.json());
    }).then(value => { if (pending === request) cached = { base, value, expires: Date.now() + 60000 }; return value; })
      .catch(() => { throw failure(); })
      .finally(() => { if (pending === request) pending = undefined; });
    pending = request;
  }
  // An unmounted reader must not cancel another screen's shared request.
  const shared = pending!.promise;
  return withRequestDeadline(() => shared, signal);
}
