import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
  await page.addInitScript(() => {
    const captured = { copied:[] as string[], shared:[] as ShareData[] };
    Object.assign(window, { __inviteCaptured:captured });
    Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{ writeText:async (value:string) => { captured.copied.push(value); } } });
  });
});

test('event sharing copies its own URL and unsupported native sharing falls back to copy', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable:true, value:undefined }));
  await page.goto('/calendar?event=event-coffee&token=must-not-be-shared');
  await page.getByRole('dialog').getByRole('button', { name:'일정 공유', exact:true }).click();
  const dialog = page.getByRole('dialog', { name:'일정 공유', exact:true });
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(dialog).toContainText('커피 한 잔, 함께해요');
  await expect(dialog).toContainText('연남동 · 카페 레이어드');
  await expect(dialog).toContainText('로그인 후 관리자 승인이 필요해요.');
  const url = `${new URL(page.url()).origin}/calendar?event=event-coffee`;
  await expect(dialog.getByRole('textbox', { name:'공유 링크', exact:true })).toHaveValue(url);
  await dialog.getByRole('button', { name:'링크 복사', exact:true }).click();
  await expect(dialog.getByRole('button', { name:'복사됨', exact:true })).toBeVisible();
  await dialog.getByRole('button', { name:'공유하기', exact:true }).click();
  const captured = await page.evaluate(() => (window as Window & { __inviteCaptured:{copied:string[];shared:ShareData[]} }).__inviteCaptured);
  expect(captured.copied).toEqual([url,url]);
  expect(captured.shared).toEqual([]);
  await dialog.getByRole('button', { name:'닫기', exact:true }).last().click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('커피 한 잔, 함께해요');
});

test('native sharing runs only after a click and includes event metadata without member details', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => true });
    Object.defineProperty(navigator, 'share', { configurable:true, value:async (data:ShareData) => { (window as Window & { __inviteCaptured:{shared:ShareData[]} }).__inviteCaptured.shared.push(data); } });
  });
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button', { name:'일정 공유', exact:true }).click();
  expect(await page.evaluate(() => (window as Window & { __inviteCaptured:{shared:ShareData[]} }).__inviteCaptured.shared)).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name:'공유하기', exact:true }).click();
  const captured = await page.evaluate(() => (window as Window & { __inviteCaptured:{copied:string[];shared:ShareData[]} }).__inviteCaptured);
  expect(captured.shared).toHaveLength(1);
  const data = captured.shared[0];
  expect(Object.keys(data).sort()).toEqual(['text','title','url']);
  expect(data.title).toContain('커피 한 잔, 함께해요');
  expect(data.text).toContain('14:00–16:00');
  expect(data.text).toContain('연남동 · 카페 레이어드');
  expect(data.url).toBe(`${new URL(page.url()).origin}/calendar?event=event-coffee`);
  expect(JSON.stringify(data)).not.toMatch(/example\.com|010-|memberId|attendee/);
  expect(captured.copied).toHaveLength(0);
});

test('canceling a native share does not copy or report a completed share', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable:true, value:async () => { throw new DOMException('Canceled','AbortError'); } });
  });
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button', { name:'일정 공유', exact:true }).click();
  await page.getByRole('dialog').getByRole('button', { name:'공유하기', exact:true }).click();
  expect(await page.evaluate(() => (window as Window & { __inviteCaptured:{copied:string[]} }).__inviteCaptured.copied)).toEqual([]);
  await expect(page.getByRole('dialog', { name:'일정 공유', exact:true })).toBeVisible();
});

test('group invitation shares the current group and a clean root URL on mobile', async ({ page }) => {
  await page.setViewportSize({ width:390,height:844 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable:true, value:undefined }));
  await page.goto('/?token=must-not-be-shared#private');
  await page.getByRole('button', { name:'초대', exact:true }).click();
  const dialog = page.getByRole('dialog', { name:'모임 초대', exact:true });
  await expect(dialog).toContainText('오후의 모임');
  const url = `${new URL(page.url()).origin}/`;
  await expect(dialog.getByRole('textbox', { name:'공유 링크', exact:true })).toHaveValue(url);
  await dialog.getByRole('button', { name:'링크 복사', exact:true }).click();
  expect(await page.evaluate(() => (window as Window & { __inviteCaptured:{copied:string[]} }).__inviteCaptured.copied)).toEqual([url]);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
