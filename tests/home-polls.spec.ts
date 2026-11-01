import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00')); });
for (const width of [390, 1440]) {
  test(`home prioritizes unanswered polls and updates after responding at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const alert = page.getByRole('region', { name: '응답할 투표', exact: true });
    await expect(alert).toContainText('다음 모임, 언제 만날까요?');
    const positions = await page.evaluate(() => ({ poll: document.querySelector('.home-vote-alert')!.getBoundingClientRect().top, event: document.querySelector('.next-meeting')!.getBoundingClientRect().top }));
    expect(positions.poll).toBeLessThan(positions.event);
    await alert.getByRole('link').filter({ hasText: '다음 모임, 언제 만날까요?' }).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
    await page.locator('.poll-time-cell').first().click();
    await page.getByRole('button', { name: '선택 저장하기', exact: true }).click();
    await page.goto('/');
    await expect(page.locator('.home-poll').filter({hasText:'다음 모임, 언제 만날까요?'})).toContainText('참여 완료');
    await expect(alert).not.toContainText('다음 모임, 언제 만날까요?');
    await expect(alert).toContainText('전시 보러 갈 사람?');
    await expect(page.getByRole('heading',{name:'최근 게시글',exact:true})).toHaveCount(0);
  });
}
