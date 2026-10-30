import { test, expect } from '@playwright/test';

test('모임 설정 초기 로드 전 저장을 막고 실시간 갱신 중 편집 내용을 유지한다', async ({ page }) => {
  await page.route('**/src/lib/store.tsx*', async route => {
    const response = await route.fetch();
    let body = await response.text();
    const ready = /const settingsReady = [^;]+;/;
    expect(body).toMatch(ready);
    body = body.replace(ready, `const [settingsReady,setTestSettingsReady]=useState(false);
useEffect(()=>{const deliver=event=>{setData(current=>({...current,settings:event.detail}));setTestSettingsReady(true);};window.addEventListener('moim:test-settings-delivery',deliver);return()=>window.removeEventListener('moim:test-settings-delivery',deliver);},[]);`);
    await route.fulfill({ response, body });
  });
  await page.goto('/settings');
  await expect(page.getByRole('status')).toHaveText('모임 정보 불러오는 중');
  await expect(page.getByLabel(/^모임 이름/)).toBeDisabled();
  await expect(page.getByRole('button', { name: '저장하기', exact: true })).toBeDisabled();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  for (const checkbox of await page.getByRole('checkbox').all()) await expect(checkbox).toBeDisabled();
  await expect(page.getByRole('button', { name: '문자 설정 저장' })).toBeDisabled();
  const photoURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=';
  const settings = { name: '등록된 모임', description: '기존 소개', photoURL, smsEnabled: true, smsAutoOnConfirm: false };
  await page.evaluate(value => window.dispatchEvent(new CustomEvent('moim:test-settings-delivery', { detail: value })), settings);
  await expect(page.getByLabel(/^모임 이름/)).toBeEnabled();
  await expect(page.getByLabel(/^모임 이름/)).toHaveValue(settings.name);
  await expect(page.getByLabel('한 줄 소개')).toHaveValue(settings.description);
  await expect(page.getByAltText('대표 사진 미리보기')).toHaveAttribute('src', photoURL);
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByLabel(/^모임 이름/).fill('작성 중인 모임');
  await page.getByRole('checkbox').nth(1).check();
  await page.evaluate(value => window.dispatchEvent(new CustomEvent('moim:test-settings-delivery', { detail: value })), { ...settings, name: '갱신된 모임', description: '갱신된 소개', photoURL: '', smsEnabled: false });
  await expect(page.getByLabel(/^모임 이름/)).toHaveValue('작성 중인 모임');
  await expect(page.getByLabel('한 줄 소개')).toHaveValue('기존 소개');
  await expect(page.getByAltText('대표 사진 미리보기')).toHaveAttribute('src', photoURL);
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await expect(page.getByRole('checkbox').nth(1)).toBeChecked();
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('moim-demo-v1')!).settings);
  expect(saved).toMatchObject({ name: '작성 중인 모임', description: '기존 소개', photoURL, smsEnabled: false, smsAutoOnConfirm: false });
  await page.getByRole('button', { name: '문자 설정 저장' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('moim-demo-v1')!).settings)).toMatchObject({ name: '작성 중인 모임', description: '기존 소개', photoURL, smsEnabled: true, smsAutoOnConfirm: true });
});

test('회칙을 불러온 뒤 편집을 열고 후속 갱신에도 작성 내용을 유지한다', async ({page})=>{
  await page.route('**/src/lib/store.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();const marker=/const bylawsReady = [^;]+;/;expect(body).toMatch(marker);
    body=body.replace(marker,`const [bylawsReady,setTestBylawsReady]=useState(false);
useEffect(()=>{const deliver=event=>{setData(current=>({...current,bylaws:event.detail}));setTestBylawsReady(true);};window.addEventListener('moim:test-bylaws-delivery',deliver);return()=>window.removeEventListener('moim:test-bylaws-delivery',deliver);},[]);`);
    await route.fulfill({response,body});
  });
  await page.goto('/rules');
  await expect(page.getByRole('status')).toHaveText('회칙 불러오는 중');
  await expect(page.getByRole('button',{name:'회칙 수정',exact:true})).toBeDisabled();
  const bylaws={content:'기존 회칙',updatedAt:'2026-10-24T00:00:00Z',editorId:'m-min'};
  await page.evaluate(value=>window.dispatchEvent(new CustomEvent('moim:test-bylaws-delivery',{detail:value})),bylaws);
  await page.getByRole('button',{name:'회칙 수정',exact:true}).click();
  const editor=page.getByRole('textbox',{name:'회칙 내용',exact:true});
  await expect(editor).toHaveValue('기존 회칙');await editor.fill('작성 중인 회칙');
  await page.evaluate(value=>window.dispatchEvent(new CustomEvent('moim:test-bylaws-delivery',{detail:value})),{...bylaws,content:'다른 창에서 갱신된 회칙'});
  await expect(editor).toHaveValue('작성 중인 회칙');
  await page.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.locator('.rules-content')).toContainText('작성 중인 회칙');
});
