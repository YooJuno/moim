import {expect,test,devices} from '@playwright/test';
for(const browserName of ['chromium','webkit'] as const){
 test(`touch profile menu navigates and signs out on ${browserName}`,async({playwright,baseURL})=>{
   const browser=await playwright[browserName].launch({channel:browserName==='chromium'?'chrome':undefined});
   const context=await browser.newContext({...devices['iPhone 13'],baseURL});const page=await context.newPage();
   try {
   await page.goto('/calendar');const trigger=page.getByRole('button',{name:'내 프로필',exact:true});
   await trigger.tap();const menu=page.getByRole('menu',{name:'계정 메뉴'});await expect(menu).toBeVisible();
   await menu.getByRole('menuitem',{name:'내 정보',exact:true}).tap();
   await expect(page).toHaveURL(/\/profile$/);await expect(page.getByRole('heading',{name:'내 정보',exact:true})).toBeVisible();
   await trigger.tap();await menu.getByRole('menuitem',{name:'로그아웃',exact:true}).tap();
   await expect(page.getByRole('heading',{name:'로그인',exact:true})).toBeVisible();
   } finally {await browser.close();}
 });
}
