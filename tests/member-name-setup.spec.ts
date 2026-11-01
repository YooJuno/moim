import { chooseBirthday } from './helpers/birthday';
import { expect, test } from '@playwright/test';

for (const status of ['active', 'pending']) {
  test(`a ${status} member with no provider name enters their name once`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/profile');
    await page.getByRole('button', { name: '저장하기', exact: true }).click();
    await page.evaluate(status => {
      const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
      const member = data.members.find((member: any) => member.id === 'demo-me');
      member.name = '새 멤버'; member.status = status; member.birthday = '02-20';
      const profile = data.profiles.find((profile: any) => profile.id === 'demo-me');
      profile.phone = '010-0000-0000'; profile.area = '서울 중랑구'; profile.birthday = '02-20';
      localStorage.setItem('moim-demo-v1', JSON.stringify(data));
    }, status);
    await page.goto('/polls?poll=poll-weekend');
    await expect(page.getByRole('heading', { name: '가입 정보', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: '이름' })).toHaveValue('');
    await page.getByRole('textbox', { name: '이름' }).fill('새 멤버');
    await page.getByRole('button', { name: '저장하고 계속', exact: true }).click();
    await expect(page.getByText('이름을 입력해 주세요.', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: '이름' }).fill('  방정혁  ');
    await page.getByRole('button', { name: '저장하고 계속', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
    const records = await page.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
      return { member: data.members.find((m: any) => m.id === 'demo-me'), profile: data.profiles.find((p: any) => p.id === 'demo-me') };
    });
    expect(records.member).toMatchObject({ name: '방정혁', status });
    expect(records.profile).toMatchObject({ phone: '010-0000-0000', area: '서울 중랑구', birthday: '02-20' });
    await page.reload();
    await expect(page.getByRole('heading', { name: '가입 정보', exact: true })).toHaveCount(0);
    if (status === 'pending') await expect(page.locator('.poll-time-cell').first()).toBeDisabled();
  });
}

test('new signup requires phone, area and birthday before returning to the shared poll', async ({ page }) => {
  await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const member=data.members.find((m:any)=>m.id==='demo-me');member.name='새 멤버';member.status='pending';delete member.birthday;const profile=data.profiles.find((p:any)=>p.id==='demo-me');profile.phone='';profile.area='';delete profile.birthday;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
  await page.goto('/polls?poll=poll-weekend');
  await expect(page.getByRole('heading',{name:'가입 정보',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel(/^이름/).fill('김설호');
  await page.getByRole('button',{name:'저장하고 계속',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel(/^전화번호/).fill('010');await page.getByLabel(/^거주 지역/).fill('서울 중랑구');
  await page.getByRole('button',{name:'저장하고 계속',exact:true}).click();
  await expect(page.getByText('전화번호를 확인해 주세요.',{exact:true})).toBeVisible();
  await page.getByLabel(/^전화번호/).fill('010-1234-5678');
  await page.getByRole('button',{name:'저장하고 계속',exact:true}).click();
  await expect(page.getByText('이름·전화번호·거주 지역·생일을 모두 입력해 주세요.',{exact:true})).toBeVisible();
  await chooseBirthday(page,'02-20');await page.getByRole('button',{name:'저장하고 계속',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
  await expect(page.locator('.poll-time-cell').first()).toBeDisabled();
});

for (const width of [390,1440]) {
  test(`provider details are prefilled, editable, and require signup confirmation at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
    await page.evaluate(()=>{
      const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);
      const member=data.members.find((m:any)=>m.id==='demo-me');member.name='계정 프로필 이름';member.status='pending';delete member.birthday;
      const profile=data.profiles.find((p:any)=>p.id==='demo-me');Object.assign(profile,{phone:'010-1234-5678',birthday:'02-20',area:''});
      localStorage.setItem('moim-demo-v1',JSON.stringify(data));
    });
    await page.goto('/polls?poll=poll-weekend');
    await expect(page.getByRole('heading',{name:'가입 정보',exact:true})).toBeVisible();
    await expect(page.getByLabel(/^이름/)).toHaveValue('계정 프로필 이름');
    await expect(page.getByLabel(/^전화번호/)).toHaveValue('010-1234-5678');
    await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-20');
    await expect(page.getByLabel(/^거주 지역/)).toHaveValue('');
    await page.getByRole('button',{name:'저장하고 계속',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).members.find((m:any)=>m.id==='demo-me').birthday)).toBeUndefined();
    await page.getByLabel(/^이름/).fill('박성진');
    await page.getByLabel(/^전화번호/).fill('010-9876-5432');
    await page.getByLabel(/^거주 지역/).fill('서울 중랑구');
    await page.getByRole('button',{name:'저장하고 계속',exact:true}).click();
    await expect(page.getByRole('dialog')).toHaveAccessibleName('다음 모임, 언제 만날까요?');
    const saved=await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('moim-demo-v1')!);return{member:d.members.find((m:any)=>m.id==='demo-me'),profile:d.profiles.find((p:any)=>p.id==='demo-me')};});
    expect(saved.member).toMatchObject({name:'박성진',status:'pending',birthday:'02-20'});
    expect(saved.profile).toMatchObject({phone:'010-9876-5432',area:'서울 중랑구',birthday:'02-20'});
  });
}

test('late provider fields fill untouched inputs without replacing edits',async({page})=>{
  await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);
    const member=data.members.find((m:any)=>m.id==='demo-me');member.name='새 멤버';member.status='pending';delete member.birthday;
    const profile=data.profiles.find((p:any)=>p.id==='demo-me');profile.phone='';profile.area='';delete profile.birthday;
    localStorage.setItem('moim-demo-v1',JSON.stringify(data));
  });
  await page.route('**/src/lib/store.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();
    const marker='const [data, setData] = useState(initialData);';expect(body).toContain(marker);
    body=body.replace(marker,`${marker}\nuseEffect(()=>{const deliver=event=>setData(current=>({...current,members:current.members.map(m=>m.id==='demo-me'?{...m,...event.detail.member}:m),profiles:current.profiles.map(p=>p.id==='demo-me'?{...p,...event.detail.profile}:p)}));window.addEventListener('moim:test-signup-delivery',deliver);return()=>window.removeEventListener('moim:test-signup-delivery',deliver);},[]);`);
    await route.fulfill({response,body});
  });
  await page.goto('/polls?poll=poll-weekend');
  await expect(page.getByLabel(/^이름/)).toHaveValue('');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('moim:test-signup-delivery',{detail:{member:{name:'처음 도착한 계정 이름'},profile:{}}})));
  await expect(page.getByLabel(/^이름/)).toHaveValue('처음 도착한 계정 이름');
  await page.getByLabel(/^이름/).fill('직접 입력한 이름');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('moim:test-signup-delivery',{detail:{member:{name:'구글 프로필 이름'},profile:{phone:'010-1234-5678',birthday:'02-20'}}})));
  await expect(page.getByLabel(/^이름/)).toHaveValue('직접 입력한 이름');
  await expect(page.getByLabel(/^전화번호/)).toHaveValue('010-1234-5678');
  await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-20');
  await page.getByLabel(/^전화번호/).fill('010-9876-5432');
  await page.getByLabel(/^거주 지역/).fill('서울 중랑구');
  await chooseBirthday(page,'03-04');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('moim:test-signup-delivery',{detail:{member:{name:'나중에 도착한 이름'},profile:{phone:'010-5555-5555',birthday:'12-25',area:''}}})));
  await expect(page.getByLabel(/^이름/)).toHaveValue('직접 입력한 이름');
  await expect(page.getByLabel(/^전화번호/)).toHaveValue('010-9876-5432');
  await expect(page.getByLabel(/^거주 지역/)).toHaveValue('서울 중랑구');
  await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('03-04');
});
