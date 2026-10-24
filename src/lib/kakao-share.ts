// Official SDK 2.8.4 (2026-10-19); URL and SRI verified against Kakao's download page.
const SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js';
const SDK_INTEGRITY = 'sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w';
const key = String(import.meta.env.VITE_KAKAO_JS_KEY ?? '').trim();
export const kakaoShareConfigured = Boolean(key);
interface KakaoShareSdk {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (settings: { objectType: 'text'; text: string; link: { webUrl: string; mobileWebUrl: string }; buttonTitle: string }) => unknown };
}
declare global { interface Window { Kakao?: KakaoShareSdk } }
let loading: Promise<KakaoShareSdk> | undefined;

export function prepareKakaoShare(): Promise<KakaoShareSdk> {
  if (!key) return Promise.reject(new Error('카카오톡 공유 키가 설정되지 않았어요.'));
  const initialize = (sdk: KakaoShareSdk) => { if (!sdk.isInitialized()) sdk.init(key); return sdk; };
  if (window.Kakao) { try { return Promise.resolve(initialize(window.Kakao)); } catch { return Promise.reject(new Error('카카오톡 공유 설정을 확인해 주세요.')); } }
  if (loading) return loading;
  loading = new Promise<KakaoShareSdk>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(), 15000);
    const fail = () => { window.clearTimeout(timeout); script.remove(); loading = undefined; reject(new Error('카카오톡 공유를 불러오지 못했어요. 링크를 복사해 주세요.')); };
    script.id = 'moim-kakao-sdk'; script.src = SDK_URL; script.integrity = SDK_INTEGRITY;
    script.crossOrigin = 'anonymous'; script.async = true; script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.onerror = fail;
    script.onload = () => { window.clearTimeout(timeout); if (!window.Kakao) { fail(); return; } try { resolve(initialize(window.Kakao)); } catch { fail(); } };
    document.head.appendChild(script);
  });
  return loading;
}

export async function shareWithKakao({ title, text, url, event = false }: { title: string; text: string; url: string; event?: boolean }): Promise<void> {
  const sdk = await prepareKakaoShare();
  const link = new URL(url);
  if (!['https:', 'http:'].includes(link.protocol) || link.origin !== window.location.origin) throw new Error('공유할 링크를 확인해 주세요.');
  await sdk.Share.sendDefault({ objectType: 'text', text: [title, text].filter(Boolean).join('\n').slice(0, 200), link: { webUrl: link.href, mobileWebUrl: link.href }, buttonTitle: event ? '일정 보기' : '모임 열기' });
}
