import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseBirthday } from './helpers/birthday';

async function addRoster(page:Page,name:string,phone:string) {
  await page.goto('/members');
  await page.getByRole('button',{name:'멤버 추가',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('이름').fill(name);
  await dialog.getByLabel('전화번호').fill(phone);
  await dialog.getByLabel('거주 지역').fill('서울 테스트구');
  await chooseBirthday(page, '02-29');
  await expect(dialog.getByLabel('직책').locator('option')).toHaveText(['','회장','부회장','총무']);
  await dialog.getByLabel('직책').selectOption('부회장');
  return dialog;
}

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`명단과 내 정보 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});

    test('오프라인 멤버 추가와 생일·직책 편집은 유지되고 개인정보는 제한된다',async({page})=>{
      const dialog=await addRoster(page,'샘플 명단원','010-0000-9911');
      await page.getByRole('textbox',{name:'생일',exact:true}).click();
      const picker=page.getByRole('dialog',{name:'생일 선택',exact:true});
      await picker.getByRole('combobox',{name:'월 선택',exact:true}).selectOption('2');
      await expect(picker.getByRole('combobox',{name:'일 선택',exact:true}).locator('option[value="29"]')).toHaveCount(1);
      await expect(picker.getByRole('combobox',{name:'일 선택',exact:true}).locator('option[value="30"]')).toHaveCount(0);
      await picker.getByRole('combobox',{name:'일 선택',exact:true}).selectOption('28');
      await page.keyboard.press('Escape');
      await expect(picker).toHaveCount(0);
      await expect(dialog.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button',{name:'추가',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByLabel('멤버 이름 검색').fill('샘플 명단원');
      const row=page.locator('.member-row').filter({hasText:'샘플 명단원'});
      await expect(row.getByText('미연결',{exact:true})).toBeVisible();
      await expect(row.getByText('부회장',{exact:true})).toBeVisible();
      await row.getByRole('button',{name:/샘플 명단원/}).first().click();
      const detail=page.getByRole('dialog');
      await expect(detail.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
      await expect(detail.getByLabel('권한')).toHaveCount(0);
      await expect(detail.getByLabel('직책').locator('option')).toHaveText(['','회장','부회장','총무']);
      await chooseBirthday(page, '03-14');
      await detail.getByLabel('직책').selectOption('회장');
      await detail.getByRole('button',{name:'저장',exact:true}).click();
      await page.reload();
      await page.getByLabel('멤버 이름 검색').fill('샘플 명단원');
      await page.locator('.member-row').filter({hasText:'샘플 명단원'}).getByRole('button',{name:/샘플 명단원/}).first().click();
      await expect(page.getByRole('dialog').getByRole('textbox',{name:'생일',exact:true})).toHaveValue('03-14');
      await expect(page.getByRole('dialog').getByLabel('직책')).toHaveValue('회장');
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.role='member';me.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.goto('/members');
      await page.getByLabel('멤버 이름 검색').fill('샘플 명단원');
      await expect(page.getByText('010-0000-9911',{exact:true})).toHaveCount(0);
      await page.locator('.member-row').filter({hasText:'샘플 명단원'}).getByRole('button',{name:/샘플 명단원/}).first().click();
      await expect(page.getByRole('dialog').getByRole('textbox',{name:'생일',exact:true})).toHaveCount(0);
      await expect(page.getByRole('dialog').getByLabel('전화번호')).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });

    test('관리자가 기존 명단을 가입 계정에 연결하며 Auth UID를 유지한다',async({page})=>{
      const dialog=await addRoster(page,'명단 연결 테스트','010-0000-9912');
      await dialog.getByRole('button',{name:'추가',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const rosterId=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);return data.members.find((member:{name:string;isRoster?:boolean})=>member.name==='명단 연결 테스트'&&member.isRoster).id as string;});
      await page.locator('.member-toolbar').getByRole('button',{name:/가입 대기/}).click();
      await page.locator('.member-row').filter({hasText:'신예린'}).getByRole('button',{name:/신예린/}).first().click();
      const pending=page.getByRole('dialog');
      await pending.getByLabel('연결할 기존 멤버').selectOption(rosterId);
      await pending.getByRole('button',{name:'명단 연결하고 승인',exact:true}).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!));
      const account=data.members.find((member:{id:string})=>member.id==='m-new');
      expect(account).toMatchObject({id:'m-new',name:'명단 연결 테스트',email:'yerin@example.com',status:'active',isRoster:false,position:'부회장'});
      expect(data.members.find((member:{id:string})=>member.id===rosterId)).toBeUndefined();
      expect(data.profiles.find((profile:{id:string})=>profile.id===rosterId)).toBeUndefined();
      expect(data.profiles.find((profile:{id:string})=>profile.id==='m-new')).toMatchObject({phone:'010-0000-9912',area:'서울 테스트구',birthday:'02-29'});
      await page.reload();
      await page.getByLabel('멤버 이름 검색').fill('명단 연결 테스트');
      const row=page.locator('.member-row').filter({hasText:'명단 연결 테스트'});
      await expect(row).toHaveCount(1);
      await expect(row.getByText('미연결',{exact:true})).toHaveCount(0);
    });

    test('내 정보 생일은 윤일과 유효한 날짜만 선택하며 모임 설정과 분리된다',async({page})=>{
      await page.goto('/profile');
      await expect(page.getByRole('heading',{name:'내 정보',exact:true})).toBeVisible();
      await expect(page.getByLabel('직책')).toHaveAttribute('readonly','');
      await chooseBirthday(page, '02-29');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.reload();
      await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
      await page.getByRole('textbox',{name:'생일',exact:true}).click();
      const picker=page.getByRole('dialog',{name:'생일 선택',exact:true});
      await picker.getByRole('combobox',{name:'월 선택',exact:true}).selectOption('4');
      await expect(picker.getByRole('combobox',{name:'일 선택',exact:true}).locator('option[value="30"]')).toHaveCount(1);
      await expect(picker.getByRole('combobox',{name:'일 선택',exact:true}).locator('option[value="31"]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(picker).toHaveCount(0);
      await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
      await page.goto('/settings');
      await expect(page.getByRole('heading',{name:'모임 설정',exact:true})).toBeVisible();
      await expect(page.getByLabel('전화번호')).toHaveCount(0);
      await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'로그아웃',exact:true})).toHaveCount(0);
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.role='member';me.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.goto('/settings');
      await expect(page).not.toHaveURL(/\/settings$/);
      await page.goto('/profile');
      await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
      await expect(page.getByLabel('모임 이름')).toHaveCount(0);
      await chooseBirthday(page, '');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.reload();
      await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('');
    });
  });
}
