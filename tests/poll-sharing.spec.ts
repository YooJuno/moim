import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
  await page.addInitScript(() => {
    Object.assign(window, { __pollShares: [], __pollCopies: [] });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => (window as any).__pollCopies.push(value) } });
    (window as any).Kakao = { init() {}, isInitialized: () => true, Share: { sendDefault: (data: unknown) => (window as any).__pollShares.push(data) } };
  });
  await page.route('**/src/lib/kakao-share.ts*', async route => {
    const response = await route.fetch(); const source = await response.text();
    expect(source).toContain('import.meta.env.VITE_KAKAO_JS_KEY');
    await route.fulfill({ response, body: source.replaceAll('import.meta.env.VITE_KAKAO_JS_KEY', JSON.stringify('test-share-key')) });
  });
});

for (const width of [390, 1440]) {
  test(`poll sharing opens Kakao only on request and keeps selected times at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/polls?poll=poll-weekend&token=private');
    const poll = page.getByRole('dialog');
    const cell = poll.locator('.poll-time-cell').first();
    await cell.click(); const before = await cell.getAttribute('aria-pressed');
    await poll.getByRole('button', { name: '투표 공유', exact: true }).click();
    const sharing = page.getByRole('dialog', { name: '투표 공유', exact: true });
    await expect(page.getByRole('dialog')).toHaveCount(1);
    const url = `${new URL(page.url()).origin}/polls?poll=poll-weekend`;
    await expect(sharing.getByRole('textbox', { name: '공유 링크' })).toHaveValue(url);
    expect(await page.evaluate(() => (window as any).__pollShares)).toEqual([]);
    await sharing.getByRole('button', { name: '카카오톡 공유', exact: true }).click();
    const messages = await page.evaluate(() => (window as any).__pollShares);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ objectType: 'text', buttonTitle: '투표하기', link: { webUrl: url, mobileWebUrl: url } });
    expect(messages[0].text).toContain('가능한 시간을 선택해 주세요.');
    expect(JSON.stringify(messages)).not.toMatch(/private|memberId|010-/);
    await sharing.getByRole('button', { name: '링크 복사', exact: true }).click();
    expect(await page.evaluate(() => (window as any).__pollCopies)).toEqual([url]);
    await sharing.getByRole('button', { name: '닫기', exact: true }).last().click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
    await expect(page.locator('.poll-time-cell').first()).toHaveAttribute('aria-pressed', before!);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('a logged-out shared poll opens that poll after signing in', async ({ page }) => {
  await page.route('**/src/lib/store.tsx*', async route => {
    const response = await route.fetch(); const source = await response.text();
    expect(source).toContain('useState(true)');
    await route.fulfill({ response, body: source.replace('useState(true)', 'useState(false)') });
  });
  await page.goto('/polls?poll=poll-weekend');
  await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '데모 둘러보기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
  await expect(page.locator('.poll-time-cell').first()).toBeEnabled();
});
