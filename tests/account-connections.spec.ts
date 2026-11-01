import {expect,test,type Page} from '@playwright/test';
async function mockAccounts(page:Page,options:{linked?:boolean;consented?:boolean;automatic?:boolean;available?:boolean}={}){
 const {linked=false,consented=false,automatic=false,available=true}=options;
 await page.route('**/src/components/AccountConnections.tsx*',async route=>{
  const response=await route.fetch(),source=await response.text();
  expect(source).toContain('!auth?.currentUser || auth.currentUser.uid !== app.user?.id');
  await route.fulfill({response,body:source.replaceAll('app.isDemo','false').replace('!auth?.currentUser || auth.currentUser.uid !== app.user?.id','false')});
 });
 await page.route('**/src/lib/social-auth.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
 const providers={google:true,kakao:${linked},naver:false,calendar:{kakao:${consented},automatic:${automatic},available:${available}}};
 export function useAuthProviderConfig(){return {enabled:true,loading:false,providers:{kakao:true,naver:false},calendar:{kakao:true}};}
 export async function getAccountProviders(){return structuredClone(providers);}
 export async function startSocialAuth(provider,intent,options){window.__connection={provider,intent,options};}
 export async function setKakaoCalendarAutomatic(enabled){providers.calendar.automatic=enabled;window.__settings=[...(window.__settings||[]),enabled];}
 export function kickKakaoCalendarSync(){}
 export async function exchangeSocialCallback(){}
 export async function linkGoogleAccount(){}
 `}));
 await page.goto('/profile');return page.locator('.account-provider').filter({has:page.getByText('카카오',{exact:true})});
}
for(const width of [1440,390]){
 test(`one Kakao connection also requests calendar consent at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});const row=await mockAccounts(page);
  await expect(row.getByText('로그인 · 캘린더 자동 반영',{exact:true})).toBeVisible();
  await expect(page.locator('.account-provider')).toHaveCount(1);
  await row.getByRole('button',{name:'연결',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__connection)).toEqual({provider:'kakao',intent:'link',options:{calendar:true,automatic:true}});
 });
}
test('an existing login connects missing calendar consent and an existing grant toggles without another OAuth',async({page})=>{
 let row=await mockAccounts(page,{linked:true});await row.getByRole('switch',{name:'참여 일정 자동 반영',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__connection)).toMatchObject({options:{calendar:true,automatic:true}});
 await page.unrouteAll();row=await mockAccounts(page,{linked:true,consented:true});
 const toggle=row.getByRole('switch',{name:'참여 일정 자동 반영',exact:true});await toggle.check();await expect(toggle).toBeChecked();await toggle.uncheck();await expect(toggle).not.toBeChecked();
 expect(await page.evaluate(()=>(window as any).__connection)).toBeUndefined();expect(await page.evaluate(()=>(window as any).__settings)).toEqual([true,false]);
});
test('unapproved calendar users can connect their Kakao login without requesting restricted calendar access',async({page})=>{
 const row=await mockAccounts(page,{available:false});await expect(row.getByRole('switch')).toHaveCount(0);await row.getByRole('button',{name:'연결',exact:true}).click();
 expect(await page.evaluate(()=>(window as any).__connection)).toEqual({provider:'kakao',intent:'link',options:{}});
});
