import { test, expect } from '@playwright/test';

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`자주 가는 장소 관리 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});

    test('장소 추가·수정·새로고침·삭제 시 같은 기록을 유지한다',async({page})=>{
      await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
      await page.goto('/settings');
      const manager=page.getByRole('region',{name:'자주 가는 장소',exact:true});
      await manager.getByRole('button',{name:'장소 추가',exact:true}).click();
      let dialog=page.getByRole('dialog');
      await dialog.getByLabel('장소 이름').fill('샘플 코트 A');
      await dialog.getByLabel('주소').fill('테스트시 테스트동');
      await dialog.getByRole('button',{name:'저장',exact:true}).click();
      const created=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).places.find((place:{name:string})=>place.name==='샘플 코트 A'));
      let row=manager.locator('.saved-place-row').filter({hasText:'샘플 코트 A'});
      await expect(row).toContainText('테스트시 테스트동');
      await page.reload();
      await expect(row).toContainText('테스트시 테스트동');
      await page.clock.setFixedTime(new Date('2026-10-24T12:01:00+09:00'));
      await row.getByRole('button',{name:'샘플 코트 A 수정',exact:true}).click();
      dialog=page.getByRole('dialog');
      await dialog.getByLabel('장소 이름').fill('샘플 코트 B');
      await dialog.getByLabel('주소').fill('테스트시 두번째동');
      await dialog.getByRole('button',{name:'저장',exact:true}).click();
      row=manager.locator('.saved-place-row').filter({hasText:'샘플 코트 B'});
      await expect(row).toContainText('테스트시 두번째동');
      const edited=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).places.find((place:{name:string})=>place.name==='샘플 코트 B'));
      expect(edited.id).toBe(created.id);
      expect(edited.createdAt).toBe(created.createdAt);
      expect(edited.updatedAt).not.toBe(created.updatedAt);
      const eventsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).events);
      await row.getByRole('button',{name:'샘플 코트 B 삭제',exact:true}).click();
      dialog=page.getByRole('dialog');
      await expect(dialog.getByText('샘플 코트 B',{exact:true})).toBeVisible();
      await dialog.getByRole('button',{name:'취소',exact:true}).click();
      await expect(row).toHaveCount(1);
      await row.getByRole('button',{name:'샘플 코트 B 삭제',exact:true}).click();
      await page.getByRole('dialog').getByRole('button',{name:'삭제',exact:true}).click();
      await expect(row).toHaveCount(0);
      await page.reload();
      await expect(manager.locator('.saved-place-row').filter({hasText:'샘플 코트 B'})).toHaveCount(0);
      expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).events)).toEqual(eventsBefore);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });

    test('일반 멤버에게 장소 관리와 관리자 설정을 표시하지 않는다',async({page})=>{
      await page.goto('/settings');
      await expect(page.getByRole('region',{name:'자주 가는 장소',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.role='member';me.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.goto('/settings');
      await expect(page).not.toHaveURL(/\/settings$/);
      await expect(page.getByRole('region',{name:'자주 가는 장소',exact:true})).toHaveCount(0);
      await expect(page.getByRole('button',{name:'장소 추가',exact:true})).toHaveCount(0);
      await expect(page.getByRole('link',{name:'모임 설정',exact:true})).toHaveCount(0);
    });
  });
}
