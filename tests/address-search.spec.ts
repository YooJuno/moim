import { expect, test, type Page } from '@playwright/test';

const sdkURL = '**/mapjsapi/bundle/postcode/prod/postcode.v2.js';
const mockSDK = `window.kakao = {...window.kakao, Postcode:class {
  constructor(options) { this.options = options; }
  embed(container, embedOptions) {
    window.__postcodeQueries = [...(window.__postcodeQueries || []), embedOptions.q || ''];
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '서울 주소 선택';
    button.onclick = () => this.options.oncomplete({userSelectedType:'R',roadAddress:'서울 마포구 월드컵로 1',jibunAddress:'서울 마포구 합정동 1',buildingName:'모임빌딩'});
    container.appendChild(button);
  }
}};`;

async function placeEditor(page:Page) {
  await page.goto('/settings');
  await page.getByRole('region', {name:'자주 가는 장소',exact:true}).getByRole('button', {name:'장소 추가',exact:true}).click();
  return page.getByRole('dialog', {name:'장소 추가',exact:true});
}

test('postcode loads after an explicit click, selects an editable saved address and produces safe map links', async ({ page }) => {
  let loads = 0;
  await page.route(sdkURL, async route => {loads++;await route.fulfill({contentType:'application/javascript',body:mockSDK});});
  const editor = await placeEditor(page);
  await editor.getByLabel('장소 이름').fill('모임 코트');
  await editor.getByLabel('주소', {exact:true}).fill('기존 주소');
  expect(loads).toBe(0);
  await editor.getByRole('button', {name:'주소 검색',exact:true}).click();
  const places = page.getByRole('dialog', {name:'장소 검색',exact:true});
  await expect(places).toBeVisible();
  await expect(places.getByRole('textbox', {name:'장소 이름 또는 주소',exact:true})).toHaveValue('모임 코트');
  const naver = places.getByRole('link', {name:'네이버지도에서 검색',exact:true});
  await expect(naver).toHaveAttribute('href',`https://map.naver.com/p/search/${encodeURIComponent('모임 코트')}`);
  await expect(naver).toHaveAttribute('target','_blank'); await expect(naver).toHaveAttribute('rel','noopener noreferrer');
  expect(loads).toBe(0);
  await places.getByRole('button', {name:'도로명 주소 검색',exact:true}).click();
  const search = page.getByRole('dialog', {name:'주소 검색',exact:true});
  await expect(search.getByRole('button', {name:'서울 주소 선택',exact:true})).toBeVisible();
  expect(loads).toBe(1);
  await search.getByRole('button', {name:'서울 주소 선택',exact:true}).click();
  await expect(search).toHaveCount(0);
  await expect(places).toHaveCount(0);
  await expect(editor.getByLabel('주소', {exact:true})).toHaveValue('서울 마포구 월드컵로 1 (모임빌딩)');
  await expect(editor.getByLabel('주소', {exact:true})).toBeFocused();
  await editor.getByLabel('주소', {exact:true}).fill('서울 마포구 월드컵로 1 (모임빌딩) 2층');
  await editor.getByRole('button', {name:'저장',exact:true}).click();
  const row = page.locator('.saved-place-row').filter({hasText:'모임 코트'});
  await row.getByRole('button', {name:'지도 보기',exact:true}).click();
  let chooser = page.getByRole('dialog', {name:'지도 앱 선택',exact:true});
  expect(await chooser.getByRole('link').evaluateAll(links=>links.map(link=>link.getAttribute('aria-label')))).toEqual(['네이버지도','카카오맵','Google 지도']);
  const map = chooser.getByRole('link', {name:'네이버지도',exact:true});
  await expect(map).toHaveAttribute('target','_blank'); await expect(map).toHaveAttribute('rel',/noopener/);
  expect(decodeURIComponent(new URL((await map.getAttribute('href'))!).pathname.slice('/p/search/'.length))).toBe('서울 마포구 월드컵로 1 (모임빌딩) 2층');
  await chooser.getByRole('button', {name:'닫기',exact:true}).click();
  await row.getByRole('button', {name:'길찾기',exact:true}).click();
  chooser = page.getByRole('dialog', {name:'길찾기 앱 선택',exact:true});
  expect(new URL((await chooser.getByRole('link', {name:'Google 지도',exact:true}).getAttribute('href'))!).searchParams.get('destination')).toBe('서울 마포구 월드컵로 1 (모임빌딩) 2층');
  await chooser.getByRole('button', {name:'닫기',exact:true}).click();
  await page.reload(); await expect(row).toContainText('모임빌딩) 2층');
});

test('postcode network failure leaves manual entry available and a later search can retry', async ({ page }) => {
  let failed = true;
  await page.route(sdkURL, async route => {if(failed)await route.abort();else await route.fulfill({contentType:'application/javascript',body:mockSDK});});
  const editor = await placeEditor(page);
  await editor.getByLabel('장소 이름').fill('수동 입력 장소'); await editor.getByLabel('주소', {exact:true}).fill('서울 직접 입력한 주소');
  await editor.getByRole('button', {name:'주소 검색',exact:true}).click();
  let places = page.getByRole('dialog', {name:'장소 검색',exact:true});
  await places.getByRole('button', {name:'도로명 주소 검색',exact:true}).click();
  let search = page.getByRole('dialog', {name:'주소 검색',exact:true});
  await expect(search.getByRole('alert')).toContainText('주소를 직접 입력해 주세요.');
  await search.getByRole('button', {name:'직접 입력하기',exact:true}).click();
  await expect(search).toHaveCount(0); await expect(places).toBeVisible();
  await expect(places.getByRole('button', {name:'도로명 주소 검색',exact:true})).toBeFocused();
  await places.getByRole('button', {name:'닫기',exact:true}).last().click();
  await expect(places).toHaveCount(0);
  await expect(editor.getByLabel('주소', {exact:true})).toHaveValue('서울 직접 입력한 주소');
  failed = false;
  await editor.getByRole('button', {name:'주소 검색',exact:true}).click();
  places = page.getByRole('dialog', {name:'장소 검색',exact:true});
  await places.getByRole('button', {name:'도로명 주소 검색',exact:true}).click();
  search = page.getByRole('dialog', {name:'주소 검색',exact:true});
  await search.getByRole('button', {name:'서울 주소 선택',exact:true}).click();
  await expect(search).toHaveCount(0); await expect(places).toHaveCount(0);
  await editor.getByRole('button', {name:'저장',exact:true}).click();
  await expect(page.locator('.saved-place-row').filter({hasText:'수동 입력 장소'})).toContainText('서울 마포구 월드컵로 1 (모임빌딩)');
});

test('mobile venue candidates use the nested search modal and Escape preserves the venue editor and its manual addresses', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.route(sdkURL, route => route.fulfill({contentType:'application/javascript',body:mockSDK}));
  await page.goto('/calendar?event=event-coffee');
  await page.locator('.venue-ballot').getByRole('button', {name:'만들기',exact:true}).click();
  const editor = page.getByRole('dialog', {name:'장소 투표 만들기',exact:true});
  const first = editor.locator('.venue-editor-option').first();
  await first.getByLabel('장소 이름').fill('검색한 모임 장소');
  await first.getByRole('button', {name:'주소 검색',exact:true}).click();
  let places = page.getByRole('dialog', {name:'장소 검색',exact:true});
  await expect(places.getByRole('textbox', {name:'장소 이름 또는 주소',exact:true})).toHaveValue('검색한 모임 장소');
  expect(await places.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await places.getByRole('button', {name:'도로명 주소 검색',exact:true}).click();
  let search = page.getByRole('dialog', {name:'주소 검색',exact:true});
  await expect(search.getByRole('button', {name:'서울 주소 선택',exact:true})).toBeVisible();
  expect(await search.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0); await expect(places).toBeVisible(); await expect(editor).toBeVisible();
  await expect(places.getByRole('button', {name:'도로명 주소 검색',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(places).toHaveCount(0); await expect(editor).toBeVisible();
  await expect(first.getByRole('button', {name:'주소 검색',exact:true})).toBeFocused();
  await first.getByRole('button', {name:'주소 검색',exact:true}).click();
  places = page.getByRole('dialog', {name:'장소 검색',exact:true});
  await places.getByRole('button', {name:'도로명 주소 검색',exact:true}).click();
  search = page.getByRole('dialog', {name:'주소 검색',exact:true});
  await search.getByRole('button', {name:'서울 주소 선택',exact:true}).click();
  await expect(search).toHaveCount(0); await expect(places).toHaveCount(0);
  await expect(first.getByLabel('주소', {exact:true})).toHaveValue('서울 마포구 월드컵로 1 (모임빌딩)');
  await expect(first.getByLabel('주소', {exact:true})).toBeFocused();
  const second = editor.locator('.venue-editor-option').nth(1);
  await second.getByLabel('장소 이름').fill('수동 모임 장소'); await second.getByLabel('주소', {exact:true}).fill('서울 성동구 수동 주소');
  await editor.getByRole('button', {name:'투표 만들기',exact:true}).click();
  await expect(page.locator('.venue-ballot').getByRole('radio', {name:/검색한 모임 장소/})).toContainText('서울 마포구 월드컵로 1 (모임빌딩)');
  await expect(page.locator('.venue-ballot').getByRole('radio', {name:/수동 모임 장소/})).toContainText('서울 성동구 수동 주소');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
