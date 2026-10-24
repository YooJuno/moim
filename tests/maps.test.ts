import { describe, expect, it } from 'vitest';
import { mapLinks, mapProviderOptions } from '../src/lib/map-links';

describe('external map links', () => {
  it('encodes a place name and address into Google Maps search and directions URLs without a key', () => {
    const result = mapLinks('서울 마포구 월드컵로 1 (2층)', '모임 & 코트')!;
    const search = new URL(result.search); const directions = new URL(result.directions);
    expect(search.origin).toBe('https://www.google.com'); expect(search.pathname).toBe('/maps/search/');
    expect(search.searchParams.get('api')).toBe('1'); expect(search.searchParams.get('query')).toBe('모임 & 코트, 서울 마포구 월드컵로 1 (2층)');
    expect(directions.pathname).toBe('/maps/dir/'); expect(directions.searchParams.get('destination')).toBe(search.searchParams.get('query'));
    expect(directions.searchParams.has('origin')).toBe(false); expect(search.searchParams.has('key')).toBe(false);
  });
  it('treats URL-like and parameter characters as a query instead of changing its destination', () => {
    const result = mapLinks('javascript:alert(1)?origin=evil#test&key=leak')!;
    const search = new URL(result.search);
    expect(search.origin).toBe('https://www.google.com'); expect(search.hash).toBe('');
    expect([...search.searchParams.keys()]).toEqual(['api','query']);
    expect(search.searchParams.get('query')).toBe('javascript:alert(1)?origin=evil#test&key=leak');
  });
  it('avoids repeating names already in location snapshots and omits empty destinations', () => {
    expect(new URL(mapLinks('시민체육관 · 서울 마포구 모임로 2','시민체육관')!.search).searchParams.get('query')).toBe('시민체육관 · 서울 마포구 모임로 2');
    expect(mapLinks('  ')).toBeNull();
    expect(new URL(mapLinks('', ' 시민체육관 ')!.directions).searchParams.get('destination')).toBe('시민체육관');
  });
  it('does not issue an unsupported oversized URL or truncate the saved location', () => {
    const location = '서울특별시'.repeat(100);
    expect(mapLinks(location)).toBeNull();
    expect(location).toHaveLength(500);
  });
});

describe('map provider choices', () => {
  it('lists Naver first and safely encodes a named place for every provider', () => {
    const location = '서울 마포구 월드컵로 1 (2층)?q=외부&x=#층';
    const name = '모임 & 코트';
    const query = `${name}, ${location}`;
    const options = mapProviderOptions(location, name);
    expect(options.map(option => option.id)).toEqual(['naver', 'kakao', 'google']);
    expect(options.map(option => option.label)).toEqual(['네이버지도', '카카오맵', 'Google 지도']);
    expect(options.map(option => option.selectPlaceFirst)).toEqual([false, false, false]);
    for (const [index, prefix] of ['https://map.naver.com/p/search/', 'https://map.kakao.com/link/search/'].entries()) {
      expect(options[index].href).toBe(`${prefix}${encodeURIComponent(query)}`);
      const url = new URL(options[index].href);
      expect(url.search).toBe(''); expect(url.hash).toBe('');
    }
    expect(new URL(options[2].href).searchParams.get('query')).toBe(query);
  });

  it('opens place search before address-only Naver and Kakao routes and marks that extra step', () => {
    const search = mapProviderOptions('서울 중랑구 모임로 10', '시민체육관', 'map');
    const routes = mapProviderOptions('서울 중랑구 모임로 10', '시민체육관', 'directions');
    expect(routes.slice(0, 2).map(option => option.href)).toEqual(search.slice(0, 2).map(option => option.href));
    expect(routes.map(option => option.selectPlaceFirst)).toEqual([true, true, false]);
    const google = new URL(routes[2].href);
    expect(google.pathname).toBe('/maps/dir/');
    expect(google.searchParams.get('destination')).toBe('시민체육관, 서울 중랑구 모임로 10');
  });

  it('keeps free-form destinations on fixed provider origins without duplicating names', () => {
    const query = '시민체육관 · javascript:alert(1)?origin=evil#test&key=leak';
    const options = mapProviderOptions(`  ${query}  `, ' 시민체육관 ');
    expect(options.map(option => new URL(option.href).origin)).toEqual(['https://map.naver.com', 'https://map.kakao.com', 'https://www.google.com']);
    expect(decodeURIComponent(new URL(options[0].href).pathname.slice('/p/search/'.length))).toBe(query);
    expect(decodeURIComponent(new URL(options[1].href).pathname.slice('/link/search/'.length))).toBe(query);
    expect(new URL(options[2].href).searchParams.get('query')).toBe(query);
  });

  it('offers no provider for empty or oversized destinations and supports a name alone', () => {
    expect(mapProviderOptions('  ', ' ')).toEqual([]);
    expect(mapProviderOptions('서울특별시'.repeat(100))).toEqual([]);
    expect(mapProviderOptions('', ' 시민체육관 ')[0].href).toBe(`https://map.naver.com/p/search/${encodeURIComponent('시민체육관')}`);
  });
});
