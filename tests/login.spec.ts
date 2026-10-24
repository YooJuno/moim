import { expect, test, type Page } from '@playwright/test';

async function showLogin(page: Page) {
  await page.goto('/profile');
  await page.getByRole('button', { name:'로그아웃', exact:true }).click();
  await page.getByRole('dialog').getByRole('button', { name:'로그아웃', exact:true }).click();
  await expect(page.getByRole('heading', { name:'로그인', exact:true })).toBeVisible();
}

test('login shows real feature images and concise controls, then returns to demo on explicit login', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await showLogin(page);
  await expect(page.getByText('우리 모임', { exact:true })).toHaveCount(0);
  await expect(page.locator('.auth-symbol')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('heading', { name:'일정 투표', exact:true })).toBeVisible();
  await expect(page.getByRole('button', { name:'데모 둘러보기', exact:true })).toBeVisible();
  for (const title of ['일정 투표','모임 일정','게시판','회계 장부']) {
    await page.getByRole('button', { name:`${title} 보기`, exact:true }).click();
    await expect(page.getByRole('heading', { name:title, exact:true })).toBeVisible();
    await page.waitForFunction(() => { const image = document.querySelector<HTMLImageElement>('.login-preview img'); return image?.complete && image.naturalWidth > 0; });
    expect(await page.locator('.login-preview img').getAttribute('alt')).toBeTruthy();
  }
  await page.getByRole('button', { name:'이전 기능', exact:true }).click();
  await expect(page.getByRole('heading', { name:'게시판', exact:true })).toBeVisible();
  await page.getByRole('region', { name:'주요 기능 미리보기', exact:true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name:'회계 장부', exact:true })).toBeVisible();
  await page.getByRole('button', { name:'데모 둘러보기', exact:true }).click();
  await expect(page.getByRole('heading', { name:'내 정보', exact:true })).toBeVisible();
});

test('feature rotation pauses on hover, manual pause and reduced motion', async ({ page }) => {
  await page.clock.install({ time:new Date('2026-10-24T12:00:00+09:00') });
  await showLogin(page);
  await page.mouse.move(5,5);
  await page.clock.runFor(5100);
  await expect(page.getByRole('heading', { name:'모임 일정', exact:true })).toBeVisible();
  const carousel = page.getByRole('region', { name:'주요 기능 미리보기', exact:true });
  await carousel.hover();
  await page.clock.runFor(10100);
  await expect(page.getByRole('heading', { name:'모임 일정', exact:true })).toBeVisible();
  await page.mouse.move(5,5);
  await page.clock.runFor(5100);
  await expect(page.getByRole('heading', { name:'게시판', exact:true })).toBeVisible();
  await page.getByRole('button', { name:'자동 넘김 일시정지', exact:true }).click();
  await page.getByRole('button', { name:'자동 넘김 재생', exact:true }).evaluate(element => element.blur());
  await page.mouse.move(5,5);
  await page.clock.runFor(10100);
  await expect(page.getByRole('heading', { name:'게시판', exact:true })).toBeVisible();
  await page.getByRole('button', { name:'자동 넘김 재생', exact:true }).click();
  await page.getByRole('button', { name:'자동 넘김 일시정지', exact:true }).evaluate(element => element.blur());
  await page.mouse.move(5,5);
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.clock.runFor(10100);
  await expect(page.getByRole('heading', { name:'게시판', exact:true })).toBeVisible();
});

test.describe('mobile login', () => {
  test.use({ viewport:{ width:390,height:844 }, hasTouch:true, isMobile:true });
  test('swiping changes feature images and keeps login controls inside the screen', async ({ page }) => {
    await page.emulateMedia({ reducedMotion:'reduce' });
    await showLogin(page);
    const stage = await page.locator('.login-preview-stage').boundingBox();
    const button = await page.getByRole('button', { name:'데모 둘러보기', exact:true }).boundingBox();
    if (!stage || !button) throw new Error('로그인 화면을 찾을 수 없어요.');
    expect(button.y).toBeGreaterThan(stage.y + stage.height);
    const session = await page.context().newCDPSession(page);
    const y = stage.y + stage.height / 2; const startX = stage.x + stage.width - 35; const endX = stage.x + 35;
    await session.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x:startX,y,id:1 }] });
    for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x:startX + (endX - startX) * step / 8,y,id:1 }] });
    await session.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
    await expect(page.getByRole('heading', { name:'모임 일정', exact:true })).toBeVisible();
    await page.getByRole('button', { name:'게시판 보기', exact:true }).tap();
    await expect(page.getByRole('heading', { name:'게시판', exact:true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name:'데모 둘러보기', exact:true })).toBeInViewport();
    await session.detach();
  });
});
