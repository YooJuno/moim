import { describe, expect, it } from 'vitest';
import { mapLinks } from '../src/lib/map-links';

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
