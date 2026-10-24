import { test, expect } from '@playwright/test';

test('멤버 개인정보가 늦게 도착하면 저장을 막고 로드 후 편집 내용을 유지한다',async({page})=>{
  await page.route('**/src/lib/store.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();
    const marker='const [data, setData] = useState(initialData);';
    expect(body).toContain(marker);
    body=body.replace(marker,`${marker}\nuseEffect(()=>{const deliver=event=>setData(current=>({...current,profiles:event.detail}));window.addEventListener('moim:test-profile-delivery',deliver);return()=>window.removeEventListener('moim:test-profile-delivery',deliver);},[]);`);
    await route.fulfill({response,body});
  });
  await page.goto('/members');
  await expect(page.locator('.member-row').filter({hasText:'박서연'})).toBeVisible();
  const profiles=await page.evaluate(async()=>{
    const {createDemoData}=await import('/src/data/demo.ts');
    return createDemoData().profiles.map((profile:{id:string;phone:string;area:string;birthday?:string})=>profile.id==='m-seo'?{...profile,birthday:'02-29'}:profile);
  });
  await page.evaluate(delivered=>window.dispatchEvent(new CustomEvent('moim:test-profile-delivery',{detail:delivered})),profiles.filter((profile:{id:string})=>profile.id!=='m-seo'));
  await page.locator('.member-row').filter({hasText:'박서연'}).getByRole('button',{name:/박서연/}).first().click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('status')).toHaveText('개인정보 불러오는 중');
  await expect(dialog.getByLabel('전화번호')).toBeDisabled();
  await expect(dialog.getByLabel('거주 지역')).toBeDisabled();
  await expect(dialog.getByRole('textbox',{name:'생일',exact:true})).toBeDisabled();
  await expect(dialog.getByRole('button',{name:'저장',exact:true})).toBeDisabled();
  await page.evaluate(delivered=>window.dispatchEvent(new CustomEvent('moim:test-profile-delivery',{detail:delivered})),profiles);
  await expect(dialog.getByLabel('전화번호')).toBeEnabled();
  await expect(dialog.getByLabel('전화번호')).toHaveValue('010-0000-1203');
  await expect(dialog.getByLabel('거주 지역')).toHaveValue('서울 서대문구');
  await expect(dialog.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
  await dialog.getByLabel('전화번호').fill('010-0000-9913');
  await page.evaluate(delivered=>window.dispatchEvent(new CustomEvent('moim:test-profile-delivery',{detail:delivered})),profiles.map((profile:{id:string;phone:string;area:string;birthday?:string})=>profile.id==='m-seo'?{...profile,phone:'010-0000-9914',area:'테스트 지역',birthday:'11-11'}:profile));
  await expect(dialog.getByLabel('전화번호')).toHaveValue('010-0000-9913');
  await expect(dialog.getByLabel('거주 지역')).toHaveValue('서울 서대문구');
  await expect(dialog.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).profiles.find((profile:{id:string})=>profile.id==='m-seo'));
  expect(saved).toMatchObject({phone:'010-0000-9913',area:'서울 서대문구',birthday:'02-29'});
});
