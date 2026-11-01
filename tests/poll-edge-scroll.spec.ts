import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
test('holding a selection at the grid edges scrolls both axes and stops on release', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const slots = Array.from({ length: 12 }, (_, day) => Array.from({ length: 16 }, (_, hour) => ({ id: `edge-${day}-${hour}`, date: `2026-11-${String(day + 1).padStart(2, '0')}`, start: `${String(hour + 8).padStart(2, '0')}:00`, end: `${String(hour + 9).padStart(2, '0')}:00` }))).flat();
    data.polls.push({ id: 'edge-scroll', title: '가장자리 드래그', description: '', slots, slotIds: slots.map(slot => slot.id), deadline: null, status: 'open', creatorId: 'demo-me', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    data.votes.push(...['m-jun','m-seo','m-do'].map(memberId=>({id:`edge-scroll_${memberId}`,pollId:'edge-scroll',memberId,slotIds:slots.map(slot=>slot.id),updatedAt:new Date().toISOString()})));
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  });
  await page.goto('/polls?poll=edge-scroll');
  const grid = page.locator('.poll-time-scroll');
  const first = grid.locator('.poll-time-cell').first();
  await expect(first).toBeVisible();
  const cell = (await first.boundingBox())!, bounds = (await grid.boundingBox())!;
  expect(cell.height).toBeGreaterThanOrEqual(40);
  expect(cell.width).toBeGreaterThanOrEqual(60);
  expect(cell.width).toBeLessThan(77);
  const body = (await page.locator('.poll-detail-modal .modal-body').boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2, id: 1 }] });
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: bounds.x + bounds.width - 4, y: Math.min(bounds.y + bounds.height,body.y + body.height) - 4, id: 1 }] });
  await expect.poll(() => grid.evaluate(element => Math.min(element.scrollTop, element.scrollLeft))).toBeGreaterThan(100);
  await expect.poll(() => grid.locator('.is-selected').count()).toBeGreaterThan(20);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const stopped = await grid.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }));
  await page.waitForTimeout(150);
  expect(await grid.evaluate(element => ({ x: element.scrollLeft, y: element.scrollTop }))).toEqual(stopped);
  // Subsequent gestures remain ordinary scrolling and taps after releasing the hold.
  await grid.evaluate(element => { element.scrollTop = 0; element.scrollLeft = 0; });
  const selected = await grid.locator('.is-selected').count();
  await first.tap();
  await expect(grid.locator('.is-selected')).toHaveCount(selected - 1);
  await cdp.detach();
});
