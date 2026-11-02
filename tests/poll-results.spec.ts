import { expect, test, type Page } from '@playwright/test';

type Scenario = 'example' | 'long' | 'solo' | 'many';
async function prepareResults(page:Page, scenario:Scenario) {
  await page.goto('/polls?create=1');
  const editor = page.getByRole('dialog');
  await editor.getByRole('button',{name:'선택 초기화',exact:true}).click();
  await editor.getByLabel('공통 시간 1 시작',{exact:true}).fill('18:00');
  await editor.getByLabel('투표 제목').fill(`연속 시간 결과 ${scenario}`);
  await editor.locator('[data-date="2026-10-31"]').click();
  await editor.getByLabel('공통 시간 1 종료', { exact:true }).selectOption('22:00');
  await editor.getByRole('button', { name:'투표 만들기', exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName(`연속 시간 결과 ${scenario}`);
  const pollId = await page.evaluate((kind:Scenario) => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const poll = data.polls.find((item:{title:string}) => item.title === `연속 시간 결과 ${kind}`);
    const candidates:{id:string;date:string;start:string;end:string}[] = poll.slots;
    const now = new Date().toISOString();
    const selected = (start:string,end:string) => candidates.filter(slot => slot.start >= start && slot.end <= end).map(slot => slot.id);
    let responses:{memberId:string;slotIds:string[]}[];
    if(kind === 'example') responses = [{memberId:'m-jun',slotIds:selected('18:00','21:00')},{memberId:'m-seo',slotIds:selected('18:00','20:00')},{memberId:'m-do',slotIds:selected('19:00','22:00')}];
    else if(kind === 'long') responses = [{memberId:'m-jun',slotIds:selected('18:00','22:00')},{memberId:'m-seo',slotIds:selected('18:00','22:00')},{memberId:'m-do',slotIds:selected('19:00','20:00')}];
    else if(kind === 'solo') responses = [{memberId:'m-jun',slotIds:selected('18:00','19:00')},{memberId:'m-seo',slotIds:selected('19:00','20:00')},{memberId:'m-do',slotIds:selected('20:00','21:00')}];
    else {
      poll.slots = Array.from({length:21},(_,index) => { const day = new Date('2026-10-31T12:00:00+09:00');day.setDate(day.getDate() + index);return {id:`fixture-${index}`,date:day.toISOString().slice(0,10),start:'18:00',end:'19:00'}; });
      poll.slotIds = poll.slots.map((slot:{id:string}) => slot.id); poll.timeWindows = poll.slots.map((slot:{id:string}) => ({...slot,id:`window-${slot.id}`}));
      responses = [{memberId:'m-jun',slotIds:poll.slotIds},{memberId:'m-seo',slotIds:poll.slotIds}];
    }
    data.votes = data.votes.filter((vote:{pollId:string}) => vote.pollId !== poll.id);
    data.votes.push(...responses.map(response => ({...response,id:`${poll.id}_${response.memberId}`,pollId:poll.id,updatedAt:now})));
    localStorage.setItem('moim-demo-v1',JSON.stringify(data)); return poll.id as string;
  },scenario);
  await page.reload();
  return pollId;
}

test.beforeEach(async ({page}) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00')); });

test('results start collapsed above the grid and open with fixed people-first ordering', async ({page}) => {
  await prepareResults(page,'example');
  const results = page.getByRole('region', {name:'가능한 시간대',exact:true});
  const rows = results.locator('.poll-availability-row');
  const toggle = results.getByRole('button', {name:'가능한 시간대',exact:true});
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(rows).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded','true');
  await expect(rows.first()).toBeVisible();
  await expect(results.getByRole('combobox')).toHaveCount(0);
  await expect(results.locator('h3')).toHaveText('가능한 시간대');
  await expect(rows.nth(0)).toContainText('19:00–20:00');
  await expect(rows.nth(0)).toContainText('3명 가능');
  await expect(rows.nth(1)).toContainText('18:00–20:00');
  await expect(rows.nth(2)).toContainText('19:00–21:00');
  await rows.nth(0).locator('summary').click();
  for(const name of ['이준호','박서연','최도윤']) await expect(rows.nth(0)).toContainText(name);
  const layout = await page.evaluate(() => ({participants:document.querySelector('.poll-participant-toggle')!.getBoundingClientRect().top,results:document.querySelector('.poll-availability')!.getBoundingClientRect().top,grid:document.querySelector('.poll-time-scroll')!.getBoundingClientRect().top}));
  expect(layout.participants).toBeLessThan(layout.results);
  expect(layout.results).toBeLessThan(layout.grid);
});

test('choosing a four-hour result keeps its full start and end when confirming a meeting', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const pollId = await prepareResults(page,'long');
  await page.getByRole('button',{name:'가능한 시간대',exact:true}).click();
  const row = page.getByRole('region',{name:'가능한 시간대',exact:true}).locator('.poll-availability-row').nth(1);
  await expect(row).toContainText('18:00–22:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.getByRole('button',{name:/일정 확정/}).click();
  const dialog = page.getByRole('dialog',{name:'모임 일정 확정',exact:true});
  await expect(dialog.getByLabel('시작 시간',{exact:true}).locator('option:checked')).toContainText('18:00');
  await expect(dialog.getByLabel('종료 시간',{exact:true}).locator('option:checked')).toHaveText('22:00 · 240분');
  await dialog.locator('input[placeholder="어디서 만날까요?"]').fill('정기 모임 장소');
  await dialog.getByRole('button',{name:'확정하기',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await page.evaluate(id => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.events.find((event:{pollId?:string}) => event.pollId === id);
  },pollId);
  expect(saved.date).toBe('2026-10-31'); expect(saved.start).toBe('18:00'); expect(saved.end).toBe('22:00');
});

test('results retain solo availability when nobody overlaps', async ({page}) => {
  await prepareResults(page,'solo');
  const results = page.getByRole('region',{name:'가능한 시간대',exact:true});
  await expect(results.locator('.poll-availability-row')).toHaveCount(0);
  await results.getByRole('button',{name:'가능한 시간대',exact:true}).click();
  await expect(results.locator('.poll-availability-row')).toHaveCount(3);
  await expect(results.getByRole('combobox')).toHaveCount(0);
  for(const row of await results.locator('.poll-availability-row').all()) await expect(row).toContainText('1명 가능');
});

test('the whole results heading expands all windows in a bounded list and collapses them completely', async ({page}) => {
  await prepareResults(page,'many');
  const results = page.getByRole('region',{name:'가능한 시간대',exact:true});
  const toggle = results.getByRole('button',{name:'가능한 시간대',exact:true});
  await expect(results.locator('.poll-availability-row')).toHaveCount(0);
  expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await toggle.click({position:{x:30,y:22}});
  await expect(results.locator('.poll-availability-row')).toHaveCount(21);
  expect((await results.locator('.poll-availability-list').boundingBox())!.height).toBeLessThanOrEqual(270);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(results.locator('.poll-availability-row')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(results.locator('.poll-availability-row')).toHaveCount(21);
  await page.reload();
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(results.locator('.poll-availability-row')).toHaveCount(0);
});

test('the default confirmation uses the top ranked full range', async ({page}) => {
  await prepareResults(page,'example');
  await page.getByRole('dialog').getByRole('button',{name:'일정 확정',exact:true}).last().click();
  const dialog = page.getByRole('dialog',{name:'모임 일정 확정',exact:true});
  await expect(dialog.getByLabel('시작 시간',{exact:true}).locator('option:checked')).toContainText('19:00');
  await expect(dialog.getByLabel('종료 시간',{exact:true}).locator('option:checked')).toHaveText('20:00 · 60분');
});
