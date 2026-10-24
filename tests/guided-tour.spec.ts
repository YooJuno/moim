import { test, expect } from '@playwright/test';

const tour=(page:import('@playwright/test').Page)=>page.getByRole('dialog',{name:'화면 안내',exact:true});

test('첫 방문 안내는 다음·이전·건너뛰기와 완료 기록을 지원한다',async({page})=>{
  // Keep the test's demo data, while exercising the production automatic-start policy.
  await page.route('**/src/components/GuidedTour.tsx*',async route=>{const response=await route.fetch();const body=await response.text();expect(body).toContain('app.isDemo');await route.fulfill({response,body:body.replaceAll('app.isDemo','false')});});
  await page.goto('/');
  const dialog=tour(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('data-tour-step','home');
  await dialog.getByRole('button',{name:'다음',exact:true}).click();
  await expect(dialog).toHaveAttribute('data-tour-step','group');
  await page.keyboard.press('ArrowRight');
  await expect(dialog).toHaveAttribute('data-tour-step','polls');
  await dialog.getByRole('button',{name:'이전',exact:true}).click();
  await expect(dialog).toHaveAttribute('data-tour-step','group');
  for(let i=0;i<7;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(element=>element.contains(document.activeElement))).toBe(true);}
  await dialog.getByRole('button',{name:'건너뛰기',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('moim-tour-v1:demo-me'))).toBe('1');
  await page.reload();
  await page.waitForTimeout(900);
  await expect(tour(page)).toHaveCount(0);
});

test('데모에서는 자동으로 열리지 않고 내 정보에서 안내를 다시 연다',async({page})=>{
  await page.goto('/profile');
  await expect(page.getByRole('heading',{name:'내 정보',exact:true})).toBeVisible();
  await page.waitForTimeout(850);
  await expect(tour(page)).toHaveCount(0);
  const reopen=page.getByRole('button',{name:'화면 안내 다시 보기',exact:true});
  await reopen.click();
  await expect(tour(page)).toBeVisible();
  await expect(tour(page).locator('[data-tour-next]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(tour(page)).toHaveCount(0);
  await expect(reopen).toBeFocused();
  await reopen.click();
  await expect(tour(page)).toBeVisible();
  for(let i=0;i<15;i++){
    const dialog=tour(page);const next=dialog.getByRole('button',{name:'다음',exact:true});
    if(await next.count()){const previous=await dialog.getAttribute('data-tour-step');await next.click();await expect(dialog).not.toHaveAttribute('data-tour-step',previous!);}
    else{await dialog.getByRole('button',{name:'완료',exact:true}).click();break;}
  }
  await expect(tour(page)).toHaveCount(0);
  expect(await page.evaluate(()=>localStorage.getItem('moim-tour-v1:demo-me'))).toBe('1');
});

for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]){
  test.describe(`일반 멤버 화면 안내 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    test('권한에 맞는 메뉴만 안내하고 말풍선이 화면 안에 들어온다',async({page})=>{
      await page.goto('/profile');
      await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const member=data.members.find((item:{id:string})=>item.id==='demo-me');member.role='member';member.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
      await page.reload();
      await page.getByRole('button',{name:'화면 안내 다시 보기',exact:true}).click();
      const seen:string[]=[];const descriptions:string[]=[];
      for(let i=0;i<15;i++){
        const dialog=tour(page);await expect(dialog).toBeVisible();const id=(await dialog.getAttribute('data-tour-step'))!;seen.push(id);descriptions.push(await dialog.innerText());
        const box=await dialog.boundingBox();expect(box).not.toBeNull();expect(box!.x).toBeGreaterThanOrEqual(8);expect(box!.y).toBeGreaterThanOrEqual(8);expect(box!.x+box!.width).toBeLessThanOrEqual(viewport.width-8);expect(box!.y+box!.height).toBeLessThanOrEqual(viewport.height-8);
        if(id==='polls'){
          const selector=viewport.name==='mobile'?'[data-tour="mobile-nav-polls"]':'[data-tour="nav-polls"]';const target=await page.locator(selector).boundingBox();const url=page.url();await page.mouse.click(target!.x+target!.width/2,target!.y+target!.height/2);await expect(page).toHaveURL(url);await expect(dialog).toHaveAttribute('data-tour-step','polls');
        }
        const next=dialog.getByRole('button',{name:'다음',exact:true});if(await next.count()){await next.click();await expect(dialog).not.toHaveAttribute('data-tour-step',id);}else{await dialog.getByRole('button',{name:'완료',exact:true}).click();break;}
      }
      expect(seen).not.toContain('settings');expect(descriptions.join(' ')).not.toContain('모임 설정');expect(seen).toContain('polls');expect(seen).toContain('calendar');expect(seen).toContain('board');expect(seen).toContain('profile');if(viewport.name==='mobile')expect(seen).toContain('more');
      await expect(tour(page)).toHaveCount(0);
    });
  });
}

test('일정 상세창이 열려 있으면 자동 안내를 기다렸다가 창을 닫은 뒤 시작한다',async({page})=>{
  await page.route('**/src/components/GuidedTour.tsx*',async route=>{const response=await route.fetch();const body=await response.text();expect(body).toContain('app.isDemo');await route.fulfill({response,body:body.replaceAll('app.isDemo','false')});});
  await page.goto('/calendar?event=event-coffee');
  const detail=page.getByRole('dialog',{name:'커피 한 잔, 함께해요',exact:true});
  await expect(detail).toBeVisible();
  await page.waitForTimeout(900);
  await expect(tour(page)).toHaveCount(0);
  await expect(detail).toBeVisible();
  await detail.getByRole('button',{name:'닫기',exact:true}).first().click();
  await expect(tour(page)).toBeVisible();
  await tour(page).getByRole('button',{name:'건너뛰기',exact:true}).click();
});
