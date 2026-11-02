import { expect, test, devices } from '@playwright/test';

for (const engine of ['chromium', 'webkit'] as const) {
  test(`monthly poll menu supports cancel, edit, closing and deletion on ${engine}`, async ({ playwright, baseURL }) => {
    const browser = await playwright[engine].launch({ channel: engine === 'chromium' ? 'chrome' : undefined });
    const page = await browser.newPage({ ...(engine === 'webkit' ? devices['iPhone 13'] : { viewport: { width: 1440, height: 900 } }), baseURL });
    const activate = (locator: ReturnType<typeof page.getByRole>) => engine === 'webkit' ? locator.tap() : locator.click();
    try {
      await page.clock.setFixedTime(new Date('2026-11-02T10:15:00+09:00'));
      await page.goto('/profile');
      await page.getByRole('button', { name: '저장하기', exact: true }).click();
      const before = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
        return { polls: data.polls, votes: data.votes };
      });
      await page.goto('/polls?create=1');
      let dialog = page.getByRole('dialog');
      await expect(dialog.getByLabel('투표 제목')).toHaveValue('2026년 12월 일정 취합');
      await activate(dialog.getByRole('button', { name: '투표 만들기', exact: true }));
      await expect(page.getByRole('dialog')).toHaveAccessibleName('2026년 12월 일정 취합');
      const trigger = page.getByRole('button', { name: '투표 메뉴', exact: true });
      await trigger.focus();
      await page.keyboard.press('ArrowDown');
      await expect(page.getByRole('menuitem', { name: '투표 수정', exact: true })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(trigger).toBeFocused();

      await activate(trigger);
      await activate(page.getByRole('menuitem', { name: '투표 삭제', exact: true }));
      dialog = page.getByRole('dialog', { name: '투표를 삭제할까요?', exact: true });
      await expect(dialog).toContainText('2026년 12월 일정 취합');
      await activate(dialog.getByRole('button', { name: '취소', exact: true }));
      const card = page.locator('.poll-card').filter({ hasText: '2026년 12월 일정 취합' });
      await expect(card).toHaveCount(1);

      await activate(card);
      await activate(trigger);
      await activate(page.getByRole('menuitem', { name: '투표 수정', exact: true }));
      dialog = page.getByRole('dialog', { name: '투표 수정', exact: true });
      await expect(dialog.getByLabel('투표 제목')).toHaveValue('2026년 12월 일정 취합');
      await activate(dialog.getByRole('button', { name: '취소', exact: true }));

      await activate(card);
      await activate(trigger);
      await activate(page.getByRole('menuitem', { name: '투표 마감', exact: true }));
      await expect(page.locator('.toast').last()).toHaveText('투표를 마감했어요.');
      await activate(trigger);
      await activate(page.getByRole('menuitem', { name: '투표 삭제', exact: true }));
      dialog = page.getByRole('dialog', { name: '투표를 삭제할까요?', exact: true });
      await activate(dialog.getByRole('button', { name: '삭제하기', exact: true }));
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page.locator('.toast').last()).toHaveText('투표를 삭제했어요.');
      await page.reload();
      await expect(card).toHaveCount(0);
      const after = await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
        return { polls: data.polls, votes: data.votes };
      });
      expect(after).toEqual(before);
    } finally { await browser.close(); }
  });
}
