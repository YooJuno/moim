import { expect, test } from '@playwright/test';

test.use({ timezoneId: 'Asia/Seoul' });
test('midnight end survives creation, editing and calendar-file export', async ({ page }) => {
  await page.goto('/calendar?create=1');
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('일정 제목').fill('자정까지 농구');
  await dialog.getByLabel(/^시작 시간/).fill('22:00');
  await dialog.getByLabel('자정 (24:00)', { exact: true }).check();
  await expect(dialog.getByLabel(/^종료 시간/)).toBeDisabled();
  await dialog.getByRole('textbox', { name: /^장소/ }).fill('농구장');
  await dialog.getByRole('button', { name: '일정 만들기', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('22:00–24:00');
  await dialog.getByRole('button', { name: '일정 수정', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('자정 (24:00)', { exact: true })).toBeChecked();
  await dialog.getByLabel('일정 제목').fill('자정까지 농구 수정');
  await dialog.getByRole('button', { name: '수정하기', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('dialog')).toContainText('22:00–24:00');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '캘린더 파일 저장', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('자정까지 농구 수정.ics');
  const stream = await download.createReadStream();
  let contents = '';
  for await (const chunk of stream!) contents += chunk.toString();
  const dates = contents.match(/DT(?:START|END):(.+)/g)!;
  expect(dates).toHaveLength(2);
  const parse = (line: string) => {
    const value = line.split(':')[1].trim();
    return Date.parse(value.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
  };
  expect(parse(dates[1]) - parse(dates[0])).toBe(2 * 60 * 60 * 1000);
});

test('editing an event date keeps the calendar on its new month and day', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button', { name: '일정 수정', exact: true }).click();
  const editor = page.getByRole('dialog');
  const beforeMonth = await editor.locator('.schedule-month-nav strong').textContent();
  await editor.getByRole('button', { name: '다음 달', exact: true }).click();
  const chosenDay = editor.locator('.schedule-day:not(.is-outside)').nth(4);
  const nextDate = await chosenDay.getAttribute('data-date');
  await chosenDay.click();
  const afterMonth = await editor.locator('.schedule-month-nav strong').textContent();
  expect(afterMonth).not.toBe(beforeMonth);
  await editor.getByRole('button', { name: '수정하기', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('커피 한 잔, 함께해요');
  await page.getByRole('dialog').getByRole('button', { name: '닫기', exact: true }).last().click();
  await expect(page.locator('.calendar-main .schedule-month-nav strong')).toHaveText(afterMonth!);
  await expect(page.locator(`.calendar-main .schedule-day[data-date="${nextDate}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.event-agenda-card').filter({ hasText: '커피 한 잔, 함께해요' })).toBeVisible();
});
