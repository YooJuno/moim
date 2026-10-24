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
