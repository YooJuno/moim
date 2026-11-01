import { expect, test, devices, type Locator, type Page } from '@playwright/test';

async function exerciseAllDay(page: Page, touch = false) {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
  await page.goto('/profile');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    // Each date has different hours, including gaps and a slot ending at midnight.
    const slots = [
      { id: 'day-a-08', date: '2026-11-07', start: '08:00', end: '09:00' },
      { id: 'day-a-09', date: '2026-11-07', start: '09:00', end: '10:00' },
      { id: 'day-a-21', date: '2026-11-07', start: '21:00', end: '22:00' },
      { id: 'day-a-23', date: '2026-11-07', start: '23:00', end: '24:00' },
      { id: 'day-b-12', date: '2026-11-08', start: '12:00', end: '13:00' },
      { id: 'day-b-13', date: '2026-11-08', start: '13:00', end: '14:00' },
    ];
    const now = new Date().toISOString();
    data.polls.push({ id: 'all-day-test', title: '날짜별 전체 선택', description: '', slots, slotIds: slots.map(slot => slot.id), deadline: null, status: 'open', creatorId: 'demo-me', createdAt: now, updatedAt: now });
    data.votes.push({ id: 'all-day-test_demo-me', pollId: 'all-day-test', memberId: 'demo-me', slotIds: ['day-a-08', 'day-b-12'], updatedAt: now });
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  });
  await page.goto('/polls?poll=all-day-test');
  const dialog = page.getByRole('dialog');
  const first = dialog.getByRole('button', { name: /11월 7일.*종일/ });
  const second = dialog.getByRole('button', { name: /11월 8일.*종일/ });
  const selected = dialog.locator('.poll-time-cell.is-selected');
  const activate = async (button: Locator) => touch ? button.tap() : button.click();
  await expect(first).toHaveAttribute('aria-pressed', 'mixed');
  await expect(second).toHaveAttribute('aria-pressed', 'mixed');
  await activate(first);
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(selected).toHaveCount(5);
  await activate(first);
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await expect(selected).toHaveCount(1);
  await expect(second).toHaveAttribute('aria-pressed', 'mixed');
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(selected).toHaveCount(5);
  await activate(dialog.locator('[data-slot-id="day-a-23"]'));
  await expect(first).toHaveAttribute('aria-pressed', 'mixed');
  await activate(first);
  await expect(selected).toHaveCount(5);
  await activate(second);
  await expect(selected).toHaveCount(6);
  const unavailable = dialog.getByRole('button', { name: '가능한 시간이 없어요', exact: true });
  await activate(unavailable);
  await expect(selected).toHaveCount(0);
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await activate(first);
  await expect(unavailable).toHaveAttribute('aria-pressed', 'false');
  await expect(selected).toHaveCount(4);
  await dialog.getByRole('button', { name: '선택 수정하기', exact: true }).click();
  await expect(page.locator('.toast').last()).toHaveText('가능한 시간을 저장했어요.');
  await page.reload();
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(second).toHaveAttribute('aria-pressed', 'false');
  await expect(selected).toHaveCount(4);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('moim-demo-v1')!).votes.find((vote: { id: string }) => vote.id === 'all-day-test_demo-me').slotIds);
  expect(saved.slice().sort()).toEqual(['day-a-08', 'day-a-09', 'day-a-21', 'day-a-23']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    data.polls.find((poll: { id: string }) => poll.id === 'all-day-test').status = 'closed';
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  await expect(dialog.locator('.poll-day-toggle')).toHaveCount(0);
  await expect(selected).toHaveCount(4);
  for (const cell of await dialog.locator('.poll-time-cell').all()) await expect(cell).toBeDisabled();
}

for (const width of [390, 1440]) {
  test(`all-day selection preserves other dates, individual choices and saved votes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await exerciseAllDay(page);
  });
}

test('WebKit supports tapping all-day selection and clearing only that date', async ({ playwright, baseURL }) => {
  const browser = await playwright.webkit.launch({ channel: undefined });
  try {
    const page = await browser.newPage({ ...devices['iPhone 13'], baseURL });
    await exerciseAllDay(page, true);
  } finally { await browser.close(); }
});
