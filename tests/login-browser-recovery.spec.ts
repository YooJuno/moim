import { expect, test, type Page } from '@playwright/test';

const android = 'Mozilla/5.0 (Linux; Android 15; SM-S931N) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const privateQuery = '?code=private-auth-code&state=private-auth-state&token=private-token#access_token=private-access-token';
const harness = '/tests/fixtures/login-harness.html';

async function interceptClipboard(page: Page) {
  await page.addInitScript(() => {
    const copied: string[] = [];
    (window as Window & { __copiedLoginURLs?: string[] }).__copiedLoginURLs = copied;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text); } } });
  });
}
async function copiedURLs(page: Page) {
  return page.evaluate(() => (window as Window & { __copiedLoginURLs?: string[] }).__copiedLoginURLs ?? []);
}
async function copyRootURL(page: Page) {
  await page.getByRole('button', { name: '링크 복사', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('링크를 복사했어요. Safari·Chrome에서 열어 주세요.');
  expect(await copiedURLs(page)).toEqual([`${new URL(page.url()).origin}/`]);
}

test.describe('Android Kakao recovery controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: `${android} KAKAOTALK/26.2.1 (INAPP)`, isMobile: true, hasTouch: true });
  test('offers a user-selected Chrome intent and copies only the site root', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await interceptClipboard(page);
    await page.goto(`${harness}${privateQuery}`);
    await expect(page.getByRole('button', { name: 'Google로 로그인', exact: true })).toHaveCount(0);
    const root = `${new URL(page.url()).origin}/`;
    const chrome = page.getByRole('link', { name: 'Chrome에서 열기', exact: true });
    await expect(chrome).toBeVisible();
    await expect(chrome).toHaveAttribute('href', `intent://${new URL(root).host}/#Intent;scheme=http;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(root)};end`);
    const before = page.url();
    await copyRootURL(page);
    await expect(page).toHaveURL(before);
    await expect(page.getByTestId('login-calls')).toHaveText('0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('iOS Kakao recovery controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: `${iphone} KAKAOTALK/26.2.1`, isMobile: true, hasTouch: true });
  test('shows menu guidance and safe copy, then offers manual copying if clipboard access is blocked', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await interceptClipboard(page);
    await page.goto(`${harness}${privateQuery}`);
    await expect(page.getByText('카카오톡 메뉴에서 Safari·Chrome으로 열거나 링크를 복사해 주세요.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Google로 로그인', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Chrome에서 열기', exact: true })).toHaveCount(0);
    await expect(page.locator('a[href^="intent:"],a[href^="kakaotalk:"],a[href^="x-safari:"]')).toHaveCount(0);
    await copyRootURL(page);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Blocked', 'NotAllowedError'); } } });
      document.execCommand = () => false;
    });
    await page.getByRole('button', { name: '링크 복사', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('링크를 길게 눌러 복사해 주세요.');
    const address = page.getByRole('textbox', { name: '로그인 주소', exact: true });
    await expect(address).toHaveValue(`${new URL(page.url()).origin}/`);
    await expect(address).toHaveAttribute('readonly', '');
    await address.click();
    expect(await address.evaluate((input: HTMLInputElement) => input.selectionStart === 0 && input.selectionEnd === input.value.length)).toBe(true);
    expect(await copiedURLs(page)).toEqual([`${new URL(page.url()).origin}/`]);
    await expect(page.getByTestId('login-calls')).toHaveText('0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('normal mobile login controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, userAgent: `${iphone} Version/18.0 Safari/604.1`, isMobile: true, hasTouch: true });
  test('keeps the Google login action without showing Kakao recovery controls', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(harness);
    await expect(page.getByRole('button', { name: '링크 복사', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Chrome에서 열기', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Google로 로그인', exact: true }).click();
    await expect(page.getByTestId('login-calls')).toHaveText('1');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test('a failed app bootstrap displays recovery and reloads the working app after the network recovers', async ({ page }) => {
  const bootstrap = '**/src/bootstrap.tsx*';
  await page.route(bootstrap, route => route.abort());
  await page.goto('/');
  const recovery = page.locator('.app-recovery');
  await expect(recovery.getByRole('heading', { name: '화면을 불러오지 못했어요.', exact: true })).toBeVisible();
  await page.unroute(bootstrap);
  await recovery.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '모임 홈', exact: true })).toBeVisible();
  await expect(recovery).toHaveCount(0);
});
