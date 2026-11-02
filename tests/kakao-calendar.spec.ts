import {expect,test,type Page} from '@playwright/test';

async function calendarMock(page:Page,options:{available?:boolean;consented?:boolean;callback?:boolean;automatic?:boolean}={}){
  const {available=true,consented=false,callback=false,automatic=false}=options;
  await page.route('**/src/components/KakaoCalendar.tsx*',async route=>{
    const response=await route.fetch();const source=await response.text();
    expect(source).toContain('app.isDemo');
    await route.fulfill({response,body:source.replaceAll('app.isDemo','false')});
  });
  await page.route('**/src/lib/social-auth.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
let automaticEnabled=${automatic};
export function useAuthProviderConfig(){return {enabled:true,loading:false,providers:{kakao:true,naver:false},calendar:{kakao:true}};}
export function getAuthAPIURL(){return null;}
export async function getAccountProviders(){return {google:true,kakao:true,naver:false,calendar:{kakao:${consented},available:${available},automatic:automaticEnabled}};}
export async function startSocialAuth(provider,intent,options){window.__calendarConnection={provider,intent,options};}
export async function setKakaoCalendarAutomatic(enabled,eventId){automaticEnabled=enabled;window.__calendarWrites=(window.__calendarWrites||0)+1;window.__calendarSetting={enabled,eventId};}
export async function exchangeSocialCallback(){return {uid:'demo-me',provider:'kakao',intent:'link'${callback?",calendarEventId:'event-coffee'":''}};}
export function kickKakaoCalendarSync(){}
export async function linkGoogleAccount(){}
`}));
}
async function attend(page:Page){
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
  await page.goto('/calendar?event=event-coffee');
  await page.getByRole('dialog').getByRole('button',{name:'참여해요',exact:true}).click();
  await expect(page.getByRole('dialog').getByText('참여 예정으로 등록했어요.',{exact:false})).toBeVisible();
}

for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]] as const){
 test(`calendar consent is requested only from its connection button ${name}`,async({page})=>{
  await page.setViewportSize(viewport);await calendarMock(page);await attend(page);
  await page.getByRole('dialog').getByRole('button',{name:'카카오 캘린더',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'카카오 캘린더 연결',exact:true});
  expect(await page.evaluate(()=>(window as any).__calendarConnection)).toBeUndefined();
  await dialog.getByRole('button',{name:'자동 반영 연결',exact:true}).click();
  expect(await page.evaluate(()=>(window as any).__calendarConnection)).toEqual({provider:'kakao',intent:'link',options:{calendar:true,automatic:true,eventId:'event-coffee'}});
  expect(await page.evaluate(()=>(window as any).__calendarWrites??0)).toBe(0);
 });
}

test('test restrictions hide the calendar action from other approved attendees',async({page})=>{
  await calendarMock(page,{available:false});await attend(page);
  await expect(page.getByRole('button',{name:'카카오 캘린더',exact:true})).toHaveCount(0);
  expect(await page.evaluate(()=>(window as any).__calendarWrites??0)).toBe(0);
});

test('automatic connection callback shows the connected state without another add',async({page})=>{
  await calendarMock(page,{consented:true,callback:true,automatic:true});await attend(page);
  await page.goto(`/auth/callback?code=${'c'.repeat(43)}&provider=kakao&intent=link`);
  await expect(page).toHaveURL(/\/calendar\?event=event-coffee$/);
  const dialog=page.getByRole('dialog',{name:'카카오 캘린더 연결',exact:true});
  await expect(dialog.getByText('자동 반영 연결됨',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).__calendarWrites??0)).toBe(0);
  await dialog.getByRole('button',{name:'자동 반영 끄기',exact:true}).click();
  await expect(dialog).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__calendarSetting)).toEqual({enabled:false,eventId:'event-coffee'});
  await expect(page.getByRole('dialog')).toHaveAccessibleName('커피 한 잔, 함께해요');
  await expect(page.getByRole('button',{name:'카카오 캘린더',exact:true}).locator('.calendar-connection-state')).toHaveCount(0);
});

for(const width of [320,390,1440]){
 test(`calendar actions keep connection states inside equal compact rows at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await calendarMock(page,{consented:true,automatic:true});await attend(page);
  await page.evaluate(()=>{
   const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);
   const event=data.events.find((e:{id:string})=>e.id==='event-coffee');
   event.calendarLink={ownerId:'demo-me',googleEventId:'preview-only',htmlLink:'https://calendar.google.com/',syncedAt:new Date().toISOString(),attendeeIds:[],signature:JSON.stringify([event.title,event.description,event.date,event.start,event.end,event.location,[]])};
   localStorage.setItem('moim-demo-v1',JSON.stringify(data));
  });
  await page.reload();const group=page.getByRole('dialog').locator('.event-calendar-connections');
  const google=group.getByRole('button',{name:'Google 캘린더',exact:true}),kakao=group.getByRole('button',{name:'카카오 캘린더',exact:true});
  await expect(google.locator('.calendar-connection-state')).toHaveText('연결됨');await expect(kakao.locator('.calendar-connection-state')).toHaveText('연결됨');
  const g=(await google.boundingBox())!,k=(await kakao.boundingBox())!;
  expect(g.width).toBe(k.width);expect(g.height).toBeGreaterThanOrEqual(44);expect(k.height).toBeGreaterThanOrEqual(44);expect((await group.boundingBox())!.height).toBeLessThanOrEqual(140);
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await google.click();await expect(page.getByRole('dialog')).toHaveAccessibleName('Google 캘린더');
  expect(await page.evaluate(()=>(window as any).__calendarWrites??0)).toBe(0);
 });
}
