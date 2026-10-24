import { expect, test, type Page } from '@playwright/test';

const frozenTime = new Date('2026-10-24T12:00:00+09:00');
test.use({ timezoneId: 'Asia/Seoul' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(frozenTime);
});

async function createHourlyPoll(page: Page, title: string) {
  await page.goto('/polls?create=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await dialog.getByLabel('공통 시간 1 시작', {exact:true}).fill('18:00');
  await dialog.getByLabel('공통 시간 1 종료', {exact:true}).selectOption('21:00');
  await dialog.getByLabel('투표 제목').fill(title);
  await dialog.locator('.schedule-day[aria-label^="2026년 10월 31일"]').click();
  await dialog.getByRole('button', { name: '투표 만들기', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.poll-time-cell')).toHaveCount(3);
}

test('shared times, day override, voting, editing, confirmation and RSVP retain the schedule history', async ({ page }) => {
  await page.goto('/polls?create=1');
  let dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('새 일정 투표');
  await dialog.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await dialog.getByLabel('투표 제목').fill('함께하는 11월 주말');
  await dialog.locator('.schedule-day[aria-label^="2026년 10월 31일"]').click();
  await dialog.locator('.schedule-day[aria-label^="2026년 11월 1일"]').click();
  await expect(dialog.locator('.poll-date-chips button')).toHaveCount(2);
  await dialog.getByLabel('공통 시간 1 시작', { exact: true }).fill('19:00');
  await dialog.getByLabel('공통 시간 1 종료', { exact: true }).selectOption('22:00');
  await dialog.getByRole('button', { name: '날짜별로 다르게 설정' }).click();
  const override = dialog.locator('.poll-date-override').filter({ hasText: '11월 1일' });
  await override.getByRole('button', { name: '공통 시간', exact: true }).click();
  await override.locator('.time-input').nth(0).fill('15:00');
  await override.locator('select').selectOption('17:00');
  await dialog.getByRole('button', { name: '투표 만들기', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('함께하는 11월 주말');
  await expect(dialog.locator('.poll-time-cell')).toHaveCount(5);
  await dialog.locator('.poll-time-cell').first().click();
  await dialog.locator('.poll-time-cell').last().click();
  await dialog.getByRole('button', { name: '선택 저장하기' }).click();
  await expect(dialog.getByRole('button', { name: '선택 수정하기' })).toBeVisible();
  const original = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const poll = data.polls.find((item: { title: string }) => item.title === '함께하는 11월 주말');
    return { poll, vote: data.votes.find((item: { pollId: string }) => item.pollId === poll.id) };
  });
  expect(original.poll.timeWindows).toEqual(expect.arrayContaining([
    expect.objectContaining({ date: '2026-10-31', start: '19:00', end: '22:00' }),
    expect.objectContaining({ date: '2026-11-01', start: '15:00', end: '17:00' }),
  ]));
  expect(original.poll.deadline).toBeNull();
  expect(original.poll.slotMinutes).toBe(60);
  expect(original.vote.slotIds).toHaveLength(2);
  await dialog.getByRole('button', { name: '투표 수정', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('투표 수정');
  await page.getByRole('dialog').getByLabel('투표 제목').fill('함께하는 11월 주말 · 장소 확정');
  await page.getByRole('button', { name: '수정하고 열기' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('함께하는 11월 주말 · 장소 확정');
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);
  const revised = await page.evaluate((id: string) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return { poll: data.polls.find((item: { id: string }) => item.id === id), vote: data.votes.find((item: { pollId: string }) => item.pollId === id) };
  }, original.poll.id);
  expect(revised.poll.slotIds).toEqual(original.poll.slotIds);
  expect(revised.vote.slotIds).toEqual(original.vote.slotIds);
  await dialog.getByRole('button', { name: '일정 확정', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('모임 일정 확정');
  await page.getByRole('textbox', { name:/^장소/ }).fill('서울숲 방문자센터');
  await page.getByRole('button', { name: '확정하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^지난 투표/ }).click();
  await expect(page.locator('.poll-card').filter({ hasText: '함께하는 11월 주말 · 장소 확정' })).toContainText('일정 확정');
  await page.goto(`/calendar?event=${encodeURIComponent(`poll-${original.poll.id}`)}`);
  dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('함께하는 11월 주말 · 장소 확정');
  await expect(dialog.getByText('서울숲 방문자센터')).toBeVisible();
  await dialog.getByRole('button', { name: '참여해요' }).click();
  await expect(dialog.getByText('참여 예정으로 등록했어요.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: '어려워요' }).click();
  await expect(dialog.getByText('불참으로 등록했어요.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: '일정 삭제', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('응답 기록은 보관돼요');
  await page.getByRole('button', { name: '삭제하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(`/polls?poll=${original.poll.id}`);
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('마감', { exact: true })).toBeVisible();
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);
  const afterDelete = await page.evaluate((id: string) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return { poll: data.polls.find((item: { id: string }) => item.id === id), events: data.events.filter((item: { pollId?: string }) => item.pollId === id), votes: data.votes.filter((item: { pollId: string }) => item.pollId === id) };
  }, original.poll.id);
  expect(afterDelete.poll.status).toBe('closed');
  expect(afterDelete.poll.eventId).toBeUndefined();
  expect(afterDelete.events).toHaveLength(0);
  expect(afterDelete.votes).toHaveLength(1);
});

test('desktop drag selects all three hourly cells and reverse drag erases them', async ({ page }) => {
  await createHourlyPoll(page, '드래그 가능한 시간');
  const cells = page.getByRole('dialog').locator('.poll-time-cell');
  const first = await cells.first().boundingBox(); const last = await cells.last().boundingBox();
  if (!first || !last) throw new Error('투표 시간을 찾을 수 없어요.');
  const start = { x:first.x + first.width / 2, y:first.y + first.height / 2 };
  const end = { x:last.x + last.width / 2, y:last.y + last.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps:10 }); await page.mouse.up();
  await expect(page.getByRole('dialog').locator('.poll-time-cell.is-selected')).toHaveCount(3);
  await page.mouse.move(end.x, end.y); await page.mouse.down(); await page.mouse.move(start.x, start.y, { steps:10 }); await page.mouse.up();
  await expect(page.getByRole('dialog').locator('.poll-time-cell.is-selected')).toHaveCount(0);
  await cells.first().focus(); await page.keyboard.press('Space');
  await expect(page.getByRole('dialog').locator('.poll-time-cell.is-selected')).toHaveCount(1);
});

test('calendar and multi-date picker name Korean public holidays and indicate missing-year data', async ({ page }) => {
  await page.goto('/calendar');
  const nationalDay = page.locator('.calendar-main .schedule-day[aria-label^="2026년 10월 3일"]');
  await expect(nationalDay).toHaveClass(/is-holiday/);
  await expect(nationalDay.locator('.schedule-holiday-label')).toHaveText('개천절');
  await expect(page.locator('.calendar-main .schedule-day[aria-label^="2026년 10월 5일"] .schedule-holiday-label')).toHaveText(/대체/);
  await expect(page.locator('.calendar-main .schedule-day[aria-label^="2026년 10월 9일"] .schedule-holiday-label')).toHaveText('한글날');
  const holidayColor = await nationalDay.evaluate(element => getComputedStyle(element).color);
  expect(holidayColor).toBe('rgb(240, 92, 100)');
  await page.getByRole('button', { name: '이전 달', exact: true }).click();
  await expect(page.locator('.calendar-main .schedule-day[aria-label^="2026년 9월 25일"] .schedule-holiday-label')).toHaveText('추석');
  await page.goto('/polls?create=1');
  let dialog = page.getByRole('dialog');
  await expect(dialog.locator('.schedule-day[aria-label^="2026년 10월 9일"] .schedule-holiday-label')).toHaveText('한글날');
  await dialog.getByRole('button', { name: '다음 달', exact: true }).click();
  await dialog.getByRole('button', { name: '다음 달', exact: true }).click();
  await dialog.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(dialog.locator('.schedule-day[aria-label^="2027년 1월 1일"] .schedule-holiday-label')).toHaveText('1월 1일');
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.goto('/calendar');
  for (let step = 0; step < 15; step++) await page.getByRole('button', { name: '다음 달', exact: true }).click();
  await expect(page.getByText('이 연도의 공휴일 정보가 아직 없어요.')).toBeVisible();
});

test('a member can explicitly submit no availability and revise it', async ({ page }) => {
  await page.goto('/polls?poll=poll-weekend');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '가능한 시간이 없어요' }).click();
  await dialog.getByRole('button', { name: '선택 저장하기' }).click();
  await expect(dialog.getByRole('button', { name: '선택 수정하기' })).toBeVisible();
  await dialog.getByRole('button', { name: /참여 현황/ }).click();
  await expect(dialog.locator('.poll-participant-row').filter({ hasText: '김민서' })).toContainText('가능한 시간 없음');
  await dialog.locator('.poll-time-cell').first().click();
  await dialog.getByRole('button', { name: '선택 수정하기' }).click();
  await expect(dialog.locator('.poll-participant-row').filter({ hasText: '김민서' })).toContainText('1개 시간 가능');
  await page.reload();
  await expect(page.getByRole('dialog').locator('.poll-time-cell.is-selected')).toHaveCount(1);
});

test('no-deadline poll offers hourly cells, partial availability and editable deadlines', async ({ page }) => {
  await page.goto('/polls?create=1');
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: '마감 없음', exact: true })).toBeChecked();
  await dialog.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await dialog.getByLabel('공통 시간 1 시작', {exact:true}).fill('18:00');
  await dialog.getByLabel('공통 시간 1 종료', {exact:true}).selectOption('21:00');
  await dialog.getByLabel('투표 제목').fill('마감 없는 주말 일정');
  await dialog.locator('.schedule-day[aria-label^="2026년 10월 31일"]').click();
  await dialog.getByRole('button', { name: '투표 만들기', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('마감 없음', { exact: true })).toBeVisible();
  await expect(dialog.locator('.poll-time-cell')).toHaveCount(3);
  await dialog.getByRole('button', { name: /19:00–20:00/ }).click();
  await dialog.getByRole('button', { name: /20:00–21:00/ }).click();
  await dialog.getByRole('button', { name: '선택 저장하기', exact: true }).click();
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);
  await dialog.getByRole('button', { name: '투표 마감', exact: true }).click();
  await expect(dialog.getByText('마감', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '다시 열기', exact: true }).click();
  await expect(dialog.getByText('투표 중', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '투표 수정', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: '마감 없음', exact: true })).toBeChecked();
  await expect(dialog.getByLabel('공통 시간 1 시작', { exact: true })).toHaveAttribute('data-step-minutes', '60');
  await dialog.getByRole('checkbox', { name: '마감 없음', exact: true }).uncheck();
  await dialog.getByLabel('마감 날짜', { exact: true }).fill('2026-10-28');
  await dialog.getByLabel('마감 시간', { exact: true }).fill('23:00');
  await dialog.getByRole('button', { name: '수정하고 열기', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('.poll-time-cell')).toHaveCount(3);
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);
  const stored = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.polls.find((item: { title: string }) => item.title === '마감 없는 주말 일정');
  });
  expect(stored.slotMinutes).toBe(60);
  expect(stored.deadline).toBe('2026-10-28T14:00:00.000Z');
  await dialog.getByRole('button', { name: '일정 확정', exact: true }).click();
  dialog = page.getByRole('dialog');
  const startValue = await dialog.getByLabel('시작 시간', { exact: true }).locator('option').filter({ hasText:'18:00' }).getAttribute('value');
  await dialog.getByLabel('시작 시간', { exact: true }).selectOption(startValue!);
  await expect(dialog.getByLabel('종료 시간', { exact: true }).locator('option:checked')).toHaveText('20:00 · 120분');
  await dialog.getByLabel('종료 시간', { exact: true }).selectOption({ label: '21:00 · 180분' });
  await dialog.getByRole('textbox', { name:/^장소/ }).fill('합정 모임 공간');
  await dialog.getByRole('button', { name: '확정하기', exact: true }).click();
  const confirmedEvent = await page.evaluate((pollId: string) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.events.find((item: { pollId?: string }) => item.pollId === pollId);
  }, stored.id);
  expect(confirmedEvent.start).toBe('18:00');
  expect(confirmedEvent.end).toBe('21:00');
});

test('Google Calendar invitation preview selects attendees and sends nothing in demo', async ({ page }) => {
  const calendarRequests: string[] = [];
  page.on('request', request => { if (/googleapis\.com\/calendar\//.test(request.url())) calendarRequests.push(request.url()); });
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button', { name: 'Google 캘린더', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Google 캘린더', exact: true });
  await expect(dialog).toContainText('데모에서는 초대를 보내지 않아요.');
  await expect(dialog.getByRole('checkbox')).toHaveCount(7);
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(4);
  await expect(dialog.getByRole('button', { name: 'Google 캘린더 연결', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '추가하고 초대 보내기', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: '모두 선택', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(7);
  await dialog.getByRole('button', { name: '선택 해제', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: '내 캘린더에 추가', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: '이준호 초대', exact: true }).check();
  await expect(dialog.locator('.google-calendar-recipients-head')).toContainText('1명');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await dialog.getByRole('button', { name: '닫기', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('커피 한 잔, 함께해요');
  expect(calendarRequests).toHaveLength(0);
});

test('Google Calendar link owned by another leader cannot be changed and unsafe links stay hidden', async ({ page }) => {
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button', { name: '참여해요', exact: true }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const event = data.events.find((item: { id: string }) => item.id === 'event-coffee');
    event.calendarLink = { ownerId: 'm-jun', googleEventId: 'existing-event', htmlLink: 'https://example.com/calendar', syncedAt: '2026-10-24T03:00:00.000Z', attendeeIds: ['m-seo'], signature: 'previous' };
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  });
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button', { name: 'Google 캘린더', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Google 캘린더', exact: true });
  await expect(dialog).toContainText('이준호 님의 Google 캘린더에 연결된 일정');
  await expect(dialog.getByRole('link', { name: 'Google 캘린더에서 일정 열기' })).toHaveCount(0);
  for (const checkbox of await dialog.getByRole('checkbox').all()) await expect(checkbox).toBeDisabled();
  await expect(dialog.getByRole('button', { name: '변경하고 초대 보내기', exact: true })).toBeDisabled();
});

test.describe('mobile schedule', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test('mobile calendar selection and shared-time form fit a 390px screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/polls?create=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name:'선택 초기화',exact:true}).click();
  await dialog.getByLabel('투표 제목').fill('모바일 산책 일정');
  await dialog.locator('.schedule-day[aria-label^="2026년 10월 31일"]').tap();
  await dialog.locator('.schedule-day[aria-label^="2026년 11월 1일"]').tap();
  await expect(dialog.locator('.poll-date-chips button')).toHaveCount(2);
  const pickerFits = await dialog.locator('.poll-date-picker').evaluate(element => element.scrollWidth <= element.clientWidth + 1);
  expect(pickerFits).toBe(true);
  await dialog.getByLabel('공통 시간 1 시작', { exact: true }).fill('14:00');
  await dialog.getByLabel('공통 시간 1 종료', { exact: true }).selectOption('16:00');
  const formFits = await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1);
  expect(formFits).toBe(true);
  await dialog.getByRole('button', { name: '투표 만들기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('모바일 산책 일정');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).click();
  await page.goto('/calendar');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const day = page.locator('.calendar-main .schedule-day[aria-label^="2026년 10월 27일"]');
  await day.tap();
  await expect(page.locator('.calendar-agenda')).toContainText('커피 한 잔, 함께해요');
});

test('mobile drag mode uses a touch gesture and normal taps resume after switching it off', async ({ page }) => {
  await createHourlyPoll(page, '모바일 드래그 일정');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name:'드래그 선택', exact:true }).tap();
  const cells = dialog.locator('.poll-time-cell');
  const first = await cells.first().boundingBox(); const last = await cells.last().boundingBox();
  if (!first || !last) throw new Error('투표 시간을 찾을 수 없어요.');
  const session = await page.context().newCDPSession(page);
  const x = first.x + first.width / 2; const startY = first.y + first.height / 2; const endY = last.y + last.height / 2;
  await session.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x,y:startY,id:1 }] });
  for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x,y:startY + (endY - startY) * step / 8,id:1 }] });
  await session.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(3);
  await dialog.getByRole('button', { name:'드래그 선택', exact:true }).tap();
  await cells.first().tap();
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await session.detach();
});

});
