import { test, expect } from '@playwright/test';

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`개인 화면 설정 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    test('언어와 테마를 계정에 저장하고 시스템 테마 변경을 반영한다',async({page})=>{
      await page.emulateMedia({colorScheme:'light'});
      await page.goto('/profile');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!));
      await page.getByRole('combobox',{name:'언어',exact:true}).selectOption('en');
      await expect(page.locator('html')).toHaveAttribute('lang','en');
      await expect(page.getByLabel('Name',{exact:false})).toBeVisible();
      await expect(page.getByRole('button',{name:'화면 안내 다시 보기',exact:true})).toHaveCount(0);
      await page.getByRole('button',{name:'Dark',exact:true}).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
      await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).profiles.find((profile:{id:string})=>profile.id==='demo-me')?.theme)).toBe('dark');
      const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!));
      expect(after.profiles.find((profile:{id:string})=>profile.id==='demo-me')).toMatchObject({...before.profiles.find((profile:{id:string})=>profile.id==='demo-me'),language:'en',theme:'dark'});
      expect(after.profiles.filter((profile:{id:string})=>profile.id!=='demo-me')).toEqual(before.profiles.filter((profile:{id:string})=>profile.id!=='demo-me'));
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang','en');
      await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
      await expect(page.getByRole('combobox',{name:'Language',exact:true})).toHaveValue('en');
      expect(await page.evaluate(()=>document.documentElement.style.colorScheme)).toBe('dark');
      await page.getByRole('button',{name:'Light',exact:true}).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme','light');
      await page.getByRole('button',{name:'System',exact:true}).click();
      await page.emulateMedia({colorScheme:'dark'});
      await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
      await page.emulateMedia({colorScheme:'light'});
      await expect(page.locator('html')).toHaveAttribute('data-theme','light');
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-preferences-v1:demo-me')!))).toEqual({language:'en',theme:'system'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });
  });
}

test('다른 계정으로 전환하면 이전 계정의 언어와 테마를 사용하지 않는다',async({page})=>{
  await page.route('**/src/lib/store.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();const marker='const [data, setData] = useState(initialData);';expect(body).toContain(marker);expect(body).toContain('m.id === DEMO_USER_ID');
    body=body.replace(marker,`${marker}\nconst [testPreferenceUID,setTestPreferenceUID]=useState(DEMO_USER_ID);useEffect(()=>{const change=event=>setTestPreferenceUID(event.detail);window.addEventListener('moim:test-preference-uid',change);return()=>window.removeEventListener('moim:test-preference-uid',change);},[]);`).replace('m.id === DEMO_USER_ID','m.id === testPreferenceUID');await route.fulfill({response,body});
  });
  await page.goto('/profile');
  await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);for(const profile of data.profiles){if(profile.id==='demo-me'){profile.language='en';profile.theme='dark';}if(profile.id==='m-jun'){profile.language='ko';profile.theme='light';}}localStorage.setItem('moim-demo-v1',JSON.stringify(data));localStorage.setItem('moim-preferences-v1:demo-me',JSON.stringify({language:'en',theme:'dark'}));localStorage.setItem('moim-preferences-v1:m-jun',JSON.stringify({language:'ko',theme:'light'}));});
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.evaluate(()=>{(window as unknown as {__preferenceStates:unknown[]}).__preferenceStates=[];new MutationObserver(()=>{(window as unknown as {__preferenceStates:unknown[]}).__preferenceStates.push({language:document.documentElement.lang,theme:document.documentElement.dataset.theme});}).observe(document.documentElement,{attributes:true,attributeFilter:['lang','data-theme']});window.dispatchEvent(new CustomEvent('moim:test-preference-uid',{detail:'m-jun'}));});
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  await expect(page.getByRole('combobox',{name:'언어',exact:true})).toHaveValue('ko');
  const changes=await page.evaluate(()=>(window as unknown as {__preferenceStates:{language:string;theme:string}[]}).__preferenceStates);
  expect(changes.length).toBeGreaterThan(0);expect(changes.every(value=>value.language==='ko'&&value.theme==='light')).toBe(true);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-preferences-v1:demo-me')!))).toEqual({language:'en',theme:'dark'});
});

test('설정 저장 실패 시 화면과 계정별 캐시를 이전 값으로 되돌린다',async({page})=>{
  await page.route('**/src/lib/store.tsx*',async route=>{const response=await route.fetch();let body=await response.text();const marker='async savePreferences(preferences) {';expect(body).toContain(marker);body=body.replace(marker,`${marker}\nawait new Promise(resolve=>setTimeout(resolve,120));throw new Error('설정을 저장하지 못했어요. 다시 시도해 주세요.');`);await route.fulfill({response,body});});
  await page.goto('/profile');
  await page.getByRole('combobox',{name:'언어',exact:true}).selectOption('en');
  await expect(page.getByText('설정을 저장하지 못했어요. 다시 시도해 주세요.',{exact:true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  await expect(page.getByRole('combobox',{name:'언어',exact:true})).toHaveValue('ko');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-preferences-v1:demo-me')!))).toEqual({language:'ko',theme:'system'});
});
