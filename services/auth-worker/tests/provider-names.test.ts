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
});
