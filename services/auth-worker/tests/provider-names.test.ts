import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeProvider } from '../src/providers';
import type { Env } from '../src/types';

afterEach(() => vi.unstubAllGlobals());
describe('provider names', () => {
  it.each([
    [{ kakao_account: { name: ' 김본명 ', profile: { nickname: '별명' } } }, '김본명'],
    [{ kakao_account: { profile: { nickname: ' 김준호 ' } } }, '김준호'],
    [{ properties: { nickname: '김기존' } }, '김기존'],
    [{ kakao_account: { profile: { nickname: '  ' } }, properties: { nickname: '박성진' } }, '박성진'],
    [{ kakao_account: {} }, '새 멤버'],
  ])('reads available Kakao name fields without inventing an identity', async (profile, name) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ access_token: 'test-token' })).mockResolvedValueOnce(Response.json({ id: 123, ...profile })));
    const identity = await exchangeProvider('kakao', 'code', 'state', 'https://app.test/callback', { KAKAO_CALENDAR_ENABLED: 'false' } as Env);
    expect(identity.name).toBe(name);
  });
  it('keeps only provided valid contact fields and solar birthdays',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({access_token:'test-token'})).mockResolvedValueOnce(Response.json({id:123,kakao_account:{name:'박성진',phone_number:'+82 10-1234-5678',birthday:'0229',birthday_type:'SOLAR'}})));
    expect(await exchangeProvider('kakao','code','state','https://app.test/callback',{KAKAO_CALENDAR_ENABLED:'false'} as Env)).toMatchObject({name:'박성진',phone:'010-1234-5678',birthday:'02-29'});
  });
  it.each(['LUNAR',undefined])('does not silently treat a %s birthday as solar',async birthdayType=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({access_token:'test-token'})).mockResolvedValueOnce(Response.json({id:123,kakao_account:{phone_number:'invalid',birthday:'0220',birthday_type:birthdayType}})));
    const identity=await exchangeProvider('kakao','code','state','https://app.test/callback',{KAKAO_CALENDAR_ENABLED:'false'} as Env);
    expect(identity.phone).toBeUndefined();expect(identity.birthday).toBeUndefined();
  });
  it('does not turn Kakao default nickname guidance into a member name',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(Response.json({access_token:'test-token'})).mockResolvedValueOnce(Response.json({id:123,kakao_account:{profile:{nickname:'닉네임을 등록해주세요',is_default_nickname:true}},properties:{nickname:'닉네임을 등록해주세요'}})));
    expect((await exchangeProvider('kakao','code','state','https://app.test/callback',{KAKAO_CALENDAR_ENABLED:'false'} as Env)).name).toBe('새 멤버');
  });
});
