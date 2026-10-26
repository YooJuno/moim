/** UA detection only changes recovery controls; it never grants access or starts navigation. */
export function isKakaoInAppBrowser(userAgent: string): boolean {
  return /\bKAKAOTALK\b/i.test(userAgent);
}

/** Use the current page URL, never a user-provided return URL. OAuth data stays in this browser. */
export function safeLoginURL(pageURL: string): string | null {
  try {
    const url = new URL(pageURL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) || url.username || url.password) return null;
    // Intent separators must never enter the authority, even if URL() accepts an unusual hostname.
    const domain = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.?$/i;
    const ipv6 = /^\[[0-9a-f:.]+\]$/i;
    if (!domain.test(url.hostname) && !ipv6.test(url.hostname)) return null;
    return `${url.origin}/`;
  } catch { return null; }
}

/** Request Chrome from an explicit Android click. Other platforms use Kakao's menu or link copy. */
export function externalBrowserURL(pageURL: string, userAgent: string): string | null {
  if (!isKakaoInAppBrowser(userAgent) || !/\bAndroid\b/i.test(userAgent) || /\b(?:iPhone|iPad|iPod)\b/i.test(userAgent)) return null;
  const loginURL = safeLoginURL(pageURL);
  if (!loginURL) return null;
  const url = new URL(loginURL);
  // https://developer.chrome.com/docs/android/intents — no auto-launch, timer, or undocumented iOS scheme.
  return `intent://${url.host}/#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(loginURL)};end`;
}
