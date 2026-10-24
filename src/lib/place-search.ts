import { auth } from './firebase';
import { getAuthAPIURL } from './social-auth';

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

async function request(path: string, signal?: AbortSignal, token?: string): Promise<unknown> {
  const base = getAuthAPIURL();
  if (!base) throw new Error('지금은 네이버 장소 검색을 사용할 수 없어요.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 10000);
  try {
    const response = await fetch(new URL(path, base), { signal: controller.signal, credentials: 'omit', cache: 'no-store', ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '로그인 계정을 다시 확인해 주세요.' : '장소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.');
    return await response.json();
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError' && error.name !== 'SyntaxError') throw error;
    throw new Error('장소를 검색하지 못했어요. 잠시 후 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function isPlaceSearchReady(signal?: AbortSignal): Promise<boolean> {
  if (!getAuthAPIURL()) return false;
  const config = await request('config', signal);
  return object(config) && object(config.places) && config.places.naver === true;
}

export function parsePlaces(value: unknown): PlaceSearchResult[] {
  if (!object(value) || !Array.isArray(value.places) || value.places.length > 5) throw new Error('검색 결과를 확인하지 못했어요. 다시 검색해 주세요.');
  const seen = new Set<string>();
  return value.places.map(place => {
    if (!object(place) || !text(place.id, 100) || !place.id || seen.has(place.id) || !text(place.name, 200) || !place.name.trim() || !text(place.address, 500) || !text(place.roadAddress, 500) || !(place.roadAddress || place.address).trim()) throw new Error('검색 결과를 확인하지 못했어요. 다시 검색해 주세요.');
    seen.add(place.id);
    return { id: place.id, name: place.name, address: place.address, roadAddress: place.roadAddress };
  });
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceSearchResult[]> {
  const keyword = query.trim();
  if (!keyword || keyword.length > 120) throw new Error('장소 이름을 120자 이내로 입력해 주세요.');
  if (!auth) throw new Error('로그인이 필요해요.');
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요.');
  const token = await user.getIdToken();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (auth.currentUser?.uid !== user.uid) throw new Error('로그인 계정이 변경됐어요. 다시 시도해 주세요.');
  const result = await request(`places/search?q=${encodeURIComponent(keyword)}`, signal, token);
  if (auth.currentUser?.uid !== user.uid) throw new Error('로그인 계정이 변경됐어요. 다시 시도해 주세요.');
  return parsePlaces(result);
}
