import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00')); });

test('new monthly poll starts with next month weekends and 08:00–24:00 hourly windows', async ({ page }) => {
  await page.goto('/polls?create=1');
  const editor = page.getByRole('dialog');
  await expect(editor.getByLabel('투표 제목')).toHaveValue('2026년 11월 일정 취합');
  await expect(editor.getByLabel('취합 월', {exact:true})).toHaveValue('2026-11');
  await expect(editor.locator('.poll-date-chips button')).toHaveCount(9);
  await expect(editor.getByLabel('공통 시간 1 시작', {exact:true})).toHaveValue('08:00');
  await expect(editor.getByLabel('공통 시간 1 종료', {exact:true})).toHaveValue('24:00');
  await expect(editor.locator('.poll-editor-summary')).toContainText('144개 시간');
  await editor.getByRole('button', {name:'투표 만들기',exact:true}).click();
  const detail = page.getByRole('dialog');
  await expect(detail).toHaveAccessibleName('2026년 11월 일정 취합');
  await expect(detail.locator('.poll-time-cell')).toHaveCount(144);
  await expect(detail.locator('.poll-time-table tbody tr').last().locator('th')).toHaveText('23:0024:00');
  const saved = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.polls.find((poll:{title:string}) => poll.title === '2026년 11월 일정 취합');
  });
  expect(saved.timeWindows).toHaveLength(9);
  expect(saved.timeWindows.every((window:{start:string;end:string}) => window.start === '08:00' && window.end === '24:00')).toBe(true);
});

test('month preset includes weekday and substitute holidays once and preserves manual choice for unknown years', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-05-01T12:00:00+09:00'));
  await page.goto('/polls?create=1');
  const editor = page.getByRole('dialog');
  await editor.getByLabel('취합 월', {exact:true}).fill('2026-05');
  await editor.getByRole('button', {name:'주말·공휴일 자동 선택',exact:true}).click();
  await expect(editor.getByLabel('투표 제목')).toHaveValue('2026년 5월 일정 취합');
  const chosen = () => editor.locator('.schedule-day[aria-pressed=true]').evaluateAll(elements => elements.map(element => element.getAttribute('data-date')));
  expect(await chosen()).toContain('2026-05-05');
  expect(await chosen()).toContain('2026-05-25');
  expect((await chosen()).filter(date => date === '2026-05-24')).toHaveLength(1);
  await expect(editor.locator('[data-date="2026-05-05"]')).toHaveClass(/is-holiday/);
  const before = await chosen();
  await editor.getByLabel('취합 월', {exact:true}).fill('2028-05');
  await expect(editor.getByRole('button', {name:'주말·공휴일 자동 선택',exact:true})).toBeDisabled();
  await expect(editor.locator('.poll-preset-notice')).toContainText('공휴일 정보가 아직 없어요');
  expect(await chosen()).toEqual(before);
  await editor.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await expect(editor.locator('.poll-date-chips button')).toHaveCount(0);
});

test('editing a midnight poll keeps selected dates, windows and cell identities', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/polls?create=1');
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await dialog.locator('[data-date="2026-11-01"]').click();
  await dialog.getByLabel('투표 제목').fill('자정까지 가능한 시간');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await dialog.getByRole('button', {name:'투표 만들기',exact:true}).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('.poll-time-cell')).toHaveCount(16);
  await dialog.locator('.poll-time-cell').last().click();
  await dialog.getByRole('button', {name:'선택 저장하기',exact:true}).click();
  await expect(dialog.getByRole('button', {name:'선택 수정하기',exact:true})).toBeVisible();
  const original = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.polls.find((poll:{title:string}) => poll.title === '자정까지 가능한 시간');
  });
  await dialog.getByRole('button', {name:'투표 수정',exact:true}).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('.poll-date-chips button')).toHaveCount(1);
  await expect(dialog.getByLabel('공통 시간 1 시작', {exact:true})).toHaveValue('08:00');
  await expect(dialog.getByLabel('공통 시간 1 종료', {exact:true})).toHaveValue('24:00');
  await dialog.getByLabel('투표 제목').fill('자정까지 가능한 시간 수정');
  await dialog.getByRole('button', {name:'수정하고 열기',exact:true}).click();
  await expect(page.getByRole('dialog').locator('.poll-time-cell.is-selected')).toHaveCount(1);
  const revised = await page.evaluate((id:string) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.polls.find((poll:{id:string}) => poll.id === id);
  }, original.id);
  expect(revised.slotIds).toEqual(original.slotIds);
  expect(revised.timeWindows).toEqual(original.timeWindows);
  await page.getByRole('dialog').getByRole('button', {name:'일정 확정',exact:true}).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('시작 시간', {exact:true}).selectOption(original.slots.at(-1).id);
  await expect(dialog.getByLabel('종료 시간', {exact:true}).locator('option:checked')).toHaveText('24:00 · 60분');
  await dialog.locator('input[placeholder="어디서 만날까요?"]').fill('야간 모임 장소');
  await dialog.getByRole('button', {name:'확정하기',exact:true}).click();
  const event = await page.evaluate((pollId:string) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.events.find((event:{pollId?:string}) => event.pollId === pollId);
  }, original.id);
  expect(event.start).toBe('23:00'); expect(event.end).toBe('24:00');
});

test('poll card summarizes the full common time with the most people including its end and duration', async ({ page }) => {
  await page.goto('/polls?create=1');
  const editor = page.getByRole('dialog');
  await editor.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await editor.locator('[data-date="2026-11-01"]').click();
  await editor.getByLabel('투표 제목').fill('공통 시간 전체 요약');
  await editor.getByRole('button', {name:'투표 만들기',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('공통 시간 전체 요약');
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const poll = data.polls.find((poll:{title:string}) => poll.title === '공통 시간 전체 요약');
    const ids = poll.slots.filter((slot:{start:string;end:string}) => slot.start >= '18:00' && slot.end <= '22:00').map((slot:{id:string}) => slot.id);
    data.votes.push(...['m-jun','m-seo','m-do'].map(memberId => ({id:`${poll.id}_${memberId}`,pollId:poll.id,memberId,slotIds:ids,updatedAt:new Date().toISOString()})));
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  });
  await page.goto('/polls');
  const card = page.locator('.poll-card').filter({hasText:'공통 시간 전체 요약'});
  await expect(card.locator('.poll-best')).toContainText('18:00–22:00');
  await expect(card.locator('.poll-best')).toContainText('총 4시간');
  await expect(card.locator('.poll-best')).toContainText('3명');
});
