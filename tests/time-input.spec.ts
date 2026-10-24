import { expect, test } from '@playwright/test';

test.use({ locale: 'en-US', timezoneId: 'Asia/Seoul' });

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`24시간제 ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00')); });

    test('일정 시간을 숫자로 입력하고 자정까지 저장·수정한다', async ({ page }) => {
      await page.goto('/calendar?create=1');
      let editor = page.getByRole('dialog');
      await editor.getByLabel('일정 제목').fill('24시간 입력 검증');
      const start = editor.getByLabel(/^시작 시간/);
      const end = editor.getByLabel(/^종료 시간/);
      await expect(start).toHaveAttribute('type', 'text');
      await expect(start).toHaveAttribute('inputmode', 'numeric');
      await start.fill('2215');
      await expect(start).toHaveValue('22:15');
      await end.fill('2345');
      await expect(end).toHaveValue('23:45');
      await editor.getByRole('textbox', { name: /^장소/ }).fill('24시간 테스트 코트');
      await expect(editor.locator('input[type=time], input[type=datetime-local]')).toHaveCount(0);
      await editor.getByRole('button', { name: '일정 만들기', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('22:15–23:45');
      await page.reload();
      await page.getByRole('dialog').getByRole('button', { name: '일정 수정', exact: true }).click();
      editor = page.getByRole('dialog');
      await expect(editor.getByLabel(/^시작 시간/)).toHaveValue('22:15');
      await expect(editor.getByLabel(/^종료 시간/)).toHaveValue('23:45');
      await editor.getByLabel('자정 (24:00)', { exact: true }).check();
      await expect(editor.getByLabel(/^종료 시간/)).toHaveValue('24:00');
      await expect(editor.getByLabel(/^종료 시간/)).toBeDisabled();
      await editor.getByRole('button', { name: '수정하기', exact: true }).click();
      await expect(page.getByRole('dialog')).toContainText('22:15–24:00');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test('시간당 투표와 날짜·24시간 마감 입력을 저장하고 다시 불러온다', async ({ page }) => {
      await page.goto('/polls?create=1');
      let editor = page.getByRole('dialog');
      await editor.getByLabel('투표 제목').fill('24시간 투표 검증');
      await editor.getByRole('button', { name: '선택 초기화', exact: true }).click();
      await editor.locator('[data-date="2026-11-01"]').click();
      const start = editor.getByLabel('공통 시간 1 시작', { exact: true });
      await expect(start).toHaveAttribute('type', 'text');
      await start.fill('18:30');
      await editor.getByRole('button', { name: '투표 만들기', exact: true }).click();
      await expect(editor).toHaveAccessibleName('새 일정 투표');
      expect(await start.evaluate((element: HTMLInputElement) => element.checkValidity())).toBe(false);
      await start.fill('18');
      await start.press('Tab');
      await editor.getByLabel('공통 시간 1 종료', { exact: true }).selectOption('24:00');
      await expect(start).toHaveValue('18:00');
      await editor.getByRole('checkbox', { name: '마감 없음', exact: true }).uncheck();
      await editor.getByLabel('마감 날짜', { exact: true }).fill('2026-10-28');
      await editor.getByLabel('마감 시간', { exact: true }).fill('2350');
      await expect(editor.getByLabel('마감 시간', { exact: true })).toHaveValue('23:50');
      await expect(editor.locator('input[type=time], input[type=datetime-local]')).toHaveCount(0);
      await editor.getByRole('button', { name: '투표 만들기', exact: true }).click();
      const detail = page.getByRole('dialog');
      await expect(detail).toHaveAccessibleName('24시간 투표 검증');
      await expect(detail.locator('.poll-time-cell')).toHaveCount(6);
      await expect(detail.locator('.poll-detail-meta')).toContainText('23:50');
      await expect(detail.locator('.poll-detail-meta')).not.toContainText(/오전|오후|\bAM\b|\bPM\b/);
      await page.reload();
      await page.getByRole('dialog').getByRole('button', { name: '투표 수정', exact: true }).click();
      editor = page.getByRole('dialog');
      await expect(editor.getByLabel('공통 시간 1 시작', { exact: true })).toHaveValue('18:00');
      await expect(editor.getByLabel('공통 시간 1 종료', { exact: true })).toHaveValue('24:00');
      await expect(editor.getByLabel('마감 날짜', { exact: true })).toHaveValue('2026-10-28');
      await expect(editor.getByLabel('마감 시간', { exact: true })).toHaveValue('23:50');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
