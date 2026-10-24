import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
  test(`profile menu opens beneath the avatar and navigates explicitly ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/calendar');
    const trigger = page.getByRole('button', { name: '내 프로필', exact: true });
    await trigger.click();
    await expect(page).toHaveURL(/\/calendar$/);
    const menu = page.getByRole('menu', { name: '계정 메뉴' });
    await expect(menu.getByRole('menuitem', { name: '내 정보', exact: true })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '로그아웃', exact: true })).toBeVisible();
    const bounds = await menu.boundingBox();
    const avatar = await trigger.boundingBox();
    expect(bounds!.y).toBeGreaterThan(avatar!.y + avatar!.height);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await menu.getByRole('menuitem', { name: '내 정보', exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('button', { name: '화면 안내 다시 보기', exact: true })).toHaveCount(0);
    await trigger.click();
    await menu.getByRole('menuitem', { name: '로그아웃', exact: true }).click();
    await expect(page.getByRole('heading', { name: '로그인', exact: true })).toBeVisible();
  });
}
