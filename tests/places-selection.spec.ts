import { expect, test, type Page } from '@playwright/test';

async function addSavedPlace(page: Page, name: string, address: string) {
  await page.goto('/settings');
  await page.getByRole('region', { name:'자주 가는 장소', exact:true }).getByRole('button', { name:'장소 추가', exact:true }).click();
  const dialog = page.getByRole('dialog', { name:'장소 추가', exact:true });
  await dialog.getByLabel('장소 이름').fill(name);
  await dialog.getByLabel('주소').fill(address);
  await dialog.getByRole('button', { name:'저장', exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00')); });

test('saved venue fills a calendar event without truncation and manual edits remain independent', async ({ page }) => {
  const name = '테스트 모임 체육관 '.repeat(10).slice(0, 80).trim();
  const address = '서울 테스트구 모임로 123 '.repeat(30).slice(0, 300).trim();
  await addSavedPlace(page, name, address);
  await page.goto('/calendar?create=1');
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('일정 제목').fill('저장한 장소의 정기 모임');
  await dialog.getByLabel('저장한 장소', { exact:true }).selectOption({ label:`${name} (${address})` });
  const snapshot = `${name} · ${address}`;
  await expect(dialog.getByLabel('장소', { exact:false }).last()).toHaveValue(snapshot);
  await expect(dialog.locator('input[placeholder="어디서 만날까요?"]')).toHaveAttribute('maxlength','500');
  await dialog.getByRole('button', { name:'일정 만들기', exact:true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('저장한 장소의 정기 모임');
  const created = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.events.find((event: { title:string }) => event.title === '저장한 장소의 정기 모임');
  });
  expect(created.location).toBe(snapshot);
  expect(created.location.length).toBeGreaterThan(300);
  await dialog.getByRole('button', { name:'일정 수정', exact:true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('저장한 장소', { exact:true }).locator('option:checked')).toHaveText(`${name} (${address})`);
  await dialog.locator('input[placeholder="어디서 만날까요?"]').fill(`${snapshot} · 정문 집결`);
  await expect(dialog.getByLabel('저장한 장소', { exact:true })).toHaveValue('');
  await dialog.getByRole('button', { name:'수정하기', exact:true }).click();
  await page.goto('/settings');
  await page.getByRole('button', { name:`${name} 수정`, exact:true }).click();
  await page.getByRole('dialog').getByLabel('주소').fill('서울 테스트구 새로운 주소 42');
  await page.getByRole('dialog').getByRole('button', { name:'저장', exact:true }).click();
  await page.goto(`/calendar?event=${created.id}`);
  await expect(page.getByRole('dialog').locator('.event-location')).toHaveText(`${snapshot} · 정문 집결`);
});

test('poll confirmation selects a saved venue and stores its name and address as a snapshot', async ({ page }) => {
  await addSavedPlace(page, '시민체육관', '서울 테스트구 운동장길 52');
  await page.goto('/polls?poll=poll-weekend');
  await page.getByRole('dialog').getByRole('button', { name:'일정 확정', exact:true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('저장한 장소', { exact:true }).selectOption({ label:'시민체육관 (서울 테스트구 운동장길 52)' });
  await expect(dialog.locator('input[placeholder="어디서 만날까요?"]')).toHaveValue('시민체육관 · 서울 테스트구 운동장길 52');
  await dialog.getByRole('button', { name:'확정하기', exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const event = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    return data.events.find((item: { pollId?:string }) => item.pollId === 'poll-weekend');
  });
  expect(event.location).toBe('시민체육관 · 서울 테스트구 운동장길 52');
  await page.goto(`/calendar?event=${event.id}`);
  await expect(page.getByRole('dialog').locator('.event-location')).toHaveText(event.location);
});
