import { describe, expect, it } from 'vitest';
import { formatPostcodeAddress, POSTCODE_SCRIPT_URL } from '../src/lib/address-search';

describe('postcode selection', () => {
  it('keeps the chosen road address and building name', () => {
    expect(formatPostcodeAddress({userSelectedType:'R',roadAddress:'서울 마포구 월드컵로 1',jibunAddress:'서울 마포구 합정동 1',buildingName:'모임빌딩'})).toBe('서울 마포구 월드컵로 1 (모임빌딩)');
  });
  it('respects the chosen lot-number address and never duplicates a building already present', () => {
    expect(formatPostcodeAddress({userSelectedType:'J',roadAddress:'도로명',jibunAddress:'서울 합정동 1 (모임빌딩)',buildingName:'모임빌딩'})).toBe('서울 합정동 1 (모임빌딩)');
    expect(formatPostcodeAddress({userSelectedType:'J',address:'서울 합정동 1',buildingName:''})).toBe('서울 합정동 1');
  });
  it('uses supplied addresses only and handles missing selection data', () => {
    expect(formatPostcodeAddress({address:' 부산 해운대구 우동 1 '})).toBe('부산 해운대구 우동 1');
    expect(formatPostcodeAddress({buildingName:'건물명만'})).toBe('');
    expect(POSTCODE_SCRIPT_URL).toBe('https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js');
  });
});
