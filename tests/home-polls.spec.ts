import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00')); });
for (const width of [390, 1440]) {
  test(`home shows each poll once and prioritizes unanswered polls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const polls = page.getByRole('region', { name: '진행 중인 투표', exact: true });
    const firstPoll = polls.getByRole('link').filter({ hasText: '다음 모임, 언제 만날까요?' });
    await expect(firstPoll).toHaveCount(1);
    await expect(firstPoll).toHaveClass(/needs-response/);
    const positions = await page.evaluate(() => ({ poll: document.querySelector('.home-polls-panel')!.getBoundingClientRect().top, event: document.querySelector('.home-next-event')!.getBoundingClientRect().top }));
    expect(positions.poll).toBeLessThanOrEqual(positions.event);
    await firstPoll.click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
    await page.locator('.poll-time-cell').first().click();
    await page.getByRole('button', { name: '선택 저장하기', exact: true }).click();
    await page.goto('/');
    await expect(firstPoll).toContainText('참여 완료');
    await expect(firstPoll).not.toHaveClass(/needs-response/);
    await expect(polls.locator('.home-poll-row').first()).toContainText('전시 보러 갈 사람?');
    await expect(polls.locator('.home-poll-pending')).toHaveText('응답할 투표 1');
    await expect(page.getByRole('heading',{name:'최근 게시글',exact:true})).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'사진첩',exact:true})).toHaveCount(0);
  });
}
