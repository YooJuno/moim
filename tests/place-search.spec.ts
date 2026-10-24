import { expect, test } from '@playwright/test';

for (const mobile of [false, true]) test(`NAVER results fill an editable name and street address ${mobile ? 'on mobile' : 'on desktop'}`, async ({ page }) => {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/src/lib/place-search.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isPlaceSearchReady=async()=>true;
    export const searchPlaces=async(q,signal)=>{
      window.__placeQueries=[...(window.__placeQueries||[]),q];
      return [{id:'test-court',name:'서울 코트 & 농구장',address:'서울 마포구 지번 1',roadAddress:'서울 마포구 월드컵로 1'}];
    };` }));
  await page.goto('/settings');
  await page.getByRole('region', { name: '자주 가는 장소', exact: true }).getByRole('button', { name: '장소 추가', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '장소 추가', exact: true });
  await editor.getByRole('button', { name: '주소 검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '장소 검색', exact: true });
  await expect(search.getByRole('button', { name: '검색', exact: true })).toBeDisabled();
  await search.getByLabel('장소 이름 또는 주소', { exact: true }).fill('서울 코트');
  await search.getByRole('button', { name: '검색', exact: true }).click();
  await search.getByRole('button', { name: /서울 코트 & 농구장/ }).click();
  await expect(search).toHaveCount(0);
  await expect(editor.getByLabel('장소 이름')).toHaveValue('서울 코트 & 농구장');
  await expect(editor.getByLabel('주소', { exact: true })).toHaveValue('서울 마포구 월드컵로 1');
  await expect(editor.getByLabel('주소', { exact: true })).toBeFocused();
  await editor.getByLabel('주소', { exact: true }).fill('서울 마포구 월드컵로 1 2층');
  await editor.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.locator('.saved-place-row').filter({ hasText: '서울 코트 & 농구장' })).toContainText('서울 마포구 월드컵로 1 2층');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('changing a place query cancels old results, while a selected result preserves the existing venue name', async ({ page }) => {
  await page.route('**/src/lib/place-search.ts', route => route.fulfill({ contentType: 'application/javascript', body: `
    export const isPlaceSearchReady=async()=>true;
    export const searchPlaces=(q,signal)=>new Promise(resolve=>setTimeout(()=>resolve([{id:q,name:q,address:'서울 주소 1',roadAddress:'서울 도로 1'}]),q==='이전 장소'?500:0));
  ` }));
  await page.goto('/settings');
  await page.getByRole('region', { name: '자주 가는 장소', exact: true }).getByRole('button', { name: '장소 추가', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '장소 추가', exact: true });
  await editor.getByLabel('장소 이름').fill('우리 코트');
  await editor.getByRole('button', { name: '주소 검색', exact: true }).click();
  const search = page.getByRole('dialog', { name: '장소 검색', exact: true });
  const query = search.getByLabel('장소 이름 또는 주소', { exact: true });
  await expect(query).toHaveValue('우리 코트');
  await query.fill('이전 장소'); await search.getByRole('button', { name: '검색', exact: true }).click();
  await query.fill('새 장소'); await search.getByRole('button', { name: '검색', exact: true }).click();
  await expect(search.getByRole('button', { name: /새 장소 서울 도로/ })).toBeVisible();
  await page.waitForTimeout(550);
  await expect(search.getByRole('button', { name: /이전 장소 서울 도로/ })).toHaveCount(0);
  await search.getByRole('button', { name: /새 장소 서울 도로/ }).click();
  await expect(editor.getByLabel('장소 이름')).toHaveValue('우리 코트');
  await expect(editor.getByLabel('주소', { exact: true })).toHaveValue('서울 도로 1');
});
