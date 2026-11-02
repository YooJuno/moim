import { test, expect } from '@playwright/test';

test('a failed route keeps navigation usable and an explicit refresh recovers it', async ({ page }) => {
  const pollModule = '**/src/pages/Polls.tsx*';
  await page.route(pollModule, route => route.abort());
  await page.goto('/polls?poll=poll-weekend');
  const recovery = page.locator('.app-recovery-inline');
  await expect(recovery.getByRole('heading', { name: '화면을 불러오지 못했어요.', exact: true })).toBeVisible();
  await expect(page.locator('.topbar')).toBeVisible();
  await page.locator('.desktop-nav').getByRole('link', { name: '게시판', exact: true }).click();
  await expect(page.getByRole('heading', { name: '게시판', exact: true })).toBeVisible();
  await expect(recovery).toHaveCount(0);
  await page.unroute(pollModule);
  await page.locator('.desktop-nav').getByRole('link', { name: /일정 투표/ }).click();
  await expect(recovery).toBeVisible();
  await recovery.getByRole('button', { name: '다시 불러오기', exact: true }).click();
  await expect(page.getByRole('heading', { name: '일정 투표', exact: true })).toBeVisible();
  await expect(recovery).toHaveCount(0);
});

test('refreshing a cleaned OAuth callback returns to the app, while an unverified callback is rejected', async ({ page }) => {
  await page.goto('/auth/callback');
  await expect(page).toHaveURL('http://localhost:5173/');
  await expect(page.getByRole('heading', { name: '오후의 모임', exact: true })).toBeVisible();
  await expect(page.getByText('이 브라우저에서 시작한 로그인 요청이 없어요. 다시 시작해 주세요.', { exact: true })).toHaveCount(0);
  await page.goto('/auth/callback?provider=kakao&intent=signin&code=not-a-real-code-1234');
  await expect(page.getByRole('heading', { name: '로그인을 완료하지 못했어요', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('이 브라우저에서 시작한 로그인 요청이 없어요.');
});
