import { expect, test } from '@playwright/test';

for (const viewport of [{ width: 1440, height: 600 }, { width: 1024, height: 500 }]) {
  test(`높이가 낮은 PC ${viewport.width}×${viewport.height}에서 사이드바 끝까지 스크롤하고 설정과 프로필을 연다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const sidebar = page.locator('.sidebar');
    const settings = sidebar.getByRole('link', { name: '모임 설정', exact: true });
    const profile = sidebar.locator('.sidebar-profile');
    const ledger = sidebar.locator('.desktop-nav').getByRole('link', { name: '회계 장부', exact: true });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const box = (await sidebar.boundingBox())!;
    expect(await sidebar.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 1400);
    await expect.poll(() => sidebar.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    for (const link of [ledger, settings, profile]) await expect(link).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await settings.click();
    await expect(page.getByRole('heading', { name: '모임 설정', exact: true })).toBeVisible();
    await profile.click();
    await expect(page.getByRole('heading', { name: '내 정보', exact: true })).toBeVisible();

    // Keyboard focus must reveal the same lower links after the user scrolls back to the top.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -1400);
    await expect.poll(() => sidebar.evaluate(element => element.scrollTop)).toBe(0);
    const home = sidebar.locator('.desktop-nav').getByRole('link', { name: '모임 홈', exact: true });
    await expect(home).toBeInViewport({ ratio: 1 });
    await home.focus();
    const tabCount = await home.evaluate(anchor => {
      const links = [...anchor.closest('aside')!.querySelectorAll('a')];
      return links.indexOf(anchor.closest('aside')!.querySelector<HTMLAnchorElement>('.sidebar-profile')!) - links.indexOf(anchor as HTMLAnchorElement);
    });
    for (let index = 0; index < tabCount; index++) await page.keyboard.press('Tab');
    await expect(profile).toBeFocused();
    await expect(profile).toBeInViewport({ ratio: 1 });
    expect(await sidebar.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('일반 높이 PC에서는 메뉴와 하단 프로필이 처음부터 보인다', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const sidebar = page.locator('.sidebar');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  for (const link of await sidebar.locator('.desktop-nav>a').all()) await expect(link).toBeInViewport({ ratio: 1 });
  await expect(sidebar.getByRole('link', { name: '모임 설정', exact: true })).toBeInViewport({ ratio: 1 });
  await expect(sidebar.locator('.sidebar-profile')).toBeInViewport({ ratio: 1 });
  expect(await sidebar.evaluate(element => element.scrollTop)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('모바일은 하단 탐색과 더보기에서 설정 및 내 정보를 계속 연다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.getByRole('navigation', { name: '주 탐색', exact: true })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await page.locator('.mobile-more').getByRole('link', { name: '모임 설정', exact: true }).click();
  await expect(page.getByRole('heading', { name: '모임 설정', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await page.locator('.mobile-more').getByRole('link', { name: '내 정보', exact: true }).click();
  await expect(page.getByRole('heading', { name: '내 정보', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
