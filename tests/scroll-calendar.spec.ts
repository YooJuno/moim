import { test, expect } from '@playwright/test';

for (const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
  test.describe(`연속 날짜 선택 ${viewport.name}`,()=>{
    test.use({viewport:{width:viewport.width,height:viewport.height}});
    test.beforeEach(async({page})=>{
      await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
      await page.goto('/polls');
      await page.getByRole('button',{name:'투표 만들기',exact:true}).first().click();
      await page.getByRole('dialog').getByRole('button',{name:'선택 초기화',exact:true}).click();
    });

    test('달의 경계에서 선택한 두 날짜가 유지되고 두 달이 함께 남는다',async({page})=>{
      const dialog=page.getByRole('dialog');
      const calendar=dialog.getByRole('region',{name:'후보 날짜 선택 달력'});
      const first=calendar.locator('[data-date="2026-10-31"]');
      const next=calendar.locator('[data-date="2026-11-01"]');
      await expect(first).toHaveCount(1);
      await expect(next).toHaveCount(1);
      await first.click();
      await expect(first).toHaveAttribute('aria-pressed','true');
      await next.scrollIntoViewIfNeeded();
      const before=await calendar.evaluate(element=>element.scrollTop);
      await next.click();
      await expect(next).toHaveAttribute('aria-pressed','true');
      await expect(first).toHaveAttribute('aria-pressed','true');
      expect(Math.abs((await calendar.evaluate(element=>element.scrollTop))-before)).toBeLessThan(50);
      await expect(calendar.locator('[data-month="2026-10"]')).toHaveCount(1);
      await expect(calendar.locator('[data-month="2026-11"]')).toHaveCount(1);
      await expect(dialog.locator('.poll-date-chips')).toContainText('10. 31.');
      await expect(dialog.locator('.poll-date-chips')).toContainText('11. 1.');
      await dialog.getByRole('button',{name:'다음 달',exact:true}).click();
      await expect(first).toHaveAttribute('aria-pressed','true');
      await expect(next).toHaveAttribute('aria-pressed','true');
      await expect(calendar.locator('[data-month="2026-12"]')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });

    test('위아래 스크롤로 달을 추가하고 이전 위치와 선택을 보존한다',async({page})=>{
      const calendar=page.getByRole('dialog').getByRole('region',{name:'후보 날짜 선택 달력'});
      const selected=calendar.locator('[data-date="2026-10-31"]');
      await selected.click();
      const initialCount=await calendar.locator('.scroll-calendar-month').count();
      await calendar.evaluate(element=>{element.scrollTop=element.scrollHeight;});
      await expect.poll(()=>calendar.locator('.scroll-calendar-month').count()).toBeGreaterThan(initialCount);
      const afterAppend=await calendar.locator('.scroll-calendar-month').count();
      await calendar.evaluate(element=>{element.scrollTop=0;});
      await expect.poll(()=>calendar.locator('.scroll-calendar-month').count()).toBeGreaterThan(afterAppend);
      expect(await calendar.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
      await expect(selected).toHaveAttribute('aria-pressed','true');
      await selected.scrollIntoViewIfNeeded();
      const beforeWheel=await calendar.evaluate(element=>element.scrollTop);
      await calendar.hover();
      await page.mouse.wheel(0,180);
      await expect.poll(()=>calendar.evaluate(element=>element.scrollTop)).toBeGreaterThan(beforeWheel);
      await expect(calendar.locator('[data-date="2026-10-31"]')).toHaveCount(1);
      await expect(calendar.locator('[data-date="2026-11-01"]')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    });
  });
}
