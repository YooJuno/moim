import { describe, expect, it } from 'vitest';
import { externalBrowserURL, isKakaoInAppBrowser, safeLoginURL } from '../src/lib/external-browser';

const androidKakao = 'Mozilla/5.0 (Linux; Android 15; SM-S931N) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36 KAKAOTALK/26.2.1 (INAPP)';
const iosKakao = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK/26.2.1';

describe('Kakao external browser recovery', () => {
  it('recognizes the Kakao app marker without treating normal browsers or similar words as Kakao', () => {
    expect(isKakaoInAppBrowser(androidKakao)).toBe(true);
    expect(isKakaoInAppBrowser(iosKakao.toLowerCase())).toBe(true);
    expect(isKakaoInAppBrowser(androidKakao.replace('KAKAOTALK/26.2.1 (INAPP)', ''))).toBe(false);
    expect(isKakaoInAppBrowser('Mozilla/5.0 NotKAKAOTALKApp Android')).toBe(false);
  });

  it.each([
    'https://moim-juno.web.app/auth/callback?code=private-code&state=private-state#access_token=private-token',
    'https://moim-juno.web.app/calendar?event=event-private&invite=private-invite',
    'https://moim-juno.web.app/?redirect=https%3A%2F%2Fevil.example%2F&token=private-token',
  ])('copies only the site root and discards every path, query and fragment from %s', source => {
    expect(safeLoginURL(source)).toBe('https://moim-juno.web.app/');
    const intent = externalBrowserURL(source, androidKakao)!;
    expect(intent).toBe('intent://moim-juno.web.app/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fmoim-juno.web.app%2F;end');
    expect(intent).not.toMatch(/private|callback|event|invite|redirect|token|state/);
  });

  it('preserves the current deployment origin and a local development port', () => {
    expect(safeLoginURL('https://moim-juno--review-example.web.app/board?post=secret')).toBe('https://moim-juno--review-example.web.app/');
    expect(safeLoginURL('http://localhost:5173/auth/callback?code=secret')).toBe('http://localhost:5173/');
    expect(externalBrowserURL('http://127.0.0.1:5173/calendar', androidKakao)).toBe('intent://127.0.0.1:5173/#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=http%3A%2F%2F127.0.0.1%3A5173%2F;end');
    expect(safeLoginURL('http://[::1]:5173/?token=secret')).toBe('http://[::1]:5173/');
  });

  it.each([
    'javascript:alert(1)', 'data:text/html,secret', 'file:///private/token', '//evil.example/',
    'http://unsecured.example/', 'https://user:password@moim-juno.web.app/',
    'https://moim-juno.web.app;package=com.evil.app/', 'not a URL',
  ])('rejects unsafe destinations and credentials: %s', source => {
    expect(safeLoginURL(source)).toBeNull();
    expect(externalBrowserURL(source, androidKakao)).toBeNull();
  });

  it('provides no undocumented Safari, Kakao or automatic new-window link for iOS and other browsers', () => {
    const site = 'https://moim-juno.web.app/';
    expect(externalBrowserURL(site, iosKakao)).toBeNull();
    expect(externalBrowserURL(site, 'Mozilla/5.0 (Macintosh) KAKAOTALK/26.2.1')).toBeNull();
    expect(externalBrowserURL(site, androidKakao.replace('KAKAOTALK', 'SamsungBrowser'))).toBeNull();
    expect(externalBrowserURL(site, `${iosKakao} Android`)).toBeNull();
  });
});
