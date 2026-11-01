import { devices, expect, test } from '@playwright/test';

for (const browserName of ['chromium', 'webkit'] as const) {
  test(`mobile calendar exposes the agenda and opens a day sheet on ${browserName}`, async ({ playwright, baseURL }) => {
    const browser = await playwright[browserName].launch({ channel: browserName === 'chromium' ? 'chrome' : undefined });
    const context = await browser.newContext({ ...devices['iPhone 13'], baseURL, timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    try {
      await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
      await page.goto('/calendar');
      await expect(page.locator('.calendar-main')).toBeVisible();
      expect((await page.locator('.calendar-main').boundingBox())!.height).toBeLessThan(415);
      const event = page.locator('.event-agenda-card').filter({ hasText: '커피 한 잔, 함께해요' });
      const day = page.locator('.calendar-main [data-date="2026-10-31"]');
      const date = '2026-10-27';
      await expect(page.locator(`.calendar-main [data-date="${date}"]`)).toHaveClass(/has-events/);
      await page.locator(`.calendar-main [data-date="${date}"]`).tap();
      const sheet = page.getByRole('dialog');
      await expect(sheet).toHaveClass(/calendar-day-sheet/);
      await expect(sheet.locator('.event-agenda-card')).toContainText('14:00–16:00');
      await expect(sheet.locator('.event-agenda-card')).toContainText('연남동 · 카페 레이어드');
      const box = (await sheet.boundingBox())!;
      expect(Math.abs(box.y + box.height - await page.evaluate(() => innerHeight))).toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await sheet.locator('.event-agenda-card').tap();
      await expect(page.getByRole('dialog')).toHaveAccessibleName('커피 한 잔, 함께해요');
      await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).last().tap();
      await expect(event).toBeVisible();
      await page.locator('.calendar-main [data-date="2026-10-01"]').tap();
      await expect(page.getByRole('dialog')).toContainText('등록된 일정이 없어요');
      await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).tap();
      await day.tap();
      await expect(page.getByRole('dialog')).toHaveClass(/calendar-day-sheet/);
    } finally { await browser.close(); }
  });
}
