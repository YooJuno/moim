import {expect,test} from '@playwright/test';
for(const width of [1440,390]){
 test(`admin removes a member after confirmation and cannot remove self at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto('/members');
  const own=page.locator('.member-row').filter({has:page.locator('.member-me')});await own.getByRole('button',{name:/관리$/}).click();await expect(page.getByRole('button',{name:'멤버 삭제',exact:true})).toHaveCount(0);await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).last().click();
  const row=page.locator('.member-row').filter({hasNot:page.locator('.member-me')}).first();const name=await row.locator('.member-person strong').textContent();const memberCount=await page.locator('.member-row').count();await row.getByRole('button',{name:/관리$/}).click();
  const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'멤버 삭제',exact:true}).click();await expect(dialog.getByText('모임에서 삭제할까요? 접근 권한이 해제돼요.',{exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'취소',exact:true}).click();await expect(page.locator('.member-row')).toHaveCount(memberCount);
  await dialog.getByRole('button',{name:'멤버 삭제',exact:true}).click();await dialog.getByRole('button',{name:'삭제',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.member-row')).toHaveCount(memberCount-1);
  await page.getByRole('button',{name:'승인 거절',exact:true}).click();await expect(page.locator('.member-row').filter({hasText:name!})).toHaveCount(0);
  const result=await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!),removed=data.members.find((m:{removedAt?:string})=>m.removedAt);return {member:removed,profile:data.profiles.find((p:{id:string})=>p.id===removed.id),posts:data.posts.length,ledger:data.ledger.length};});
  expect(result.member).toMatchObject({role:'member',status:'rejected',canCreatePoll:false});expect(result.profile.phone).toBe('');expect(result.profile.area).toBe('');expect(result.posts).toBeGreaterThan(0);expect(result.ledger).toBeGreaterThan(0);
  await page.evaluate(id=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const event={...data.events[0],date:'2040-01-01'},poll={...data.polls[0],status:'open',deadline:null};data.events=[event];data.polls=[poll];data.rsvps=[id,'demo-me'].map(memberId=>({id:`${event.id}_${memberId}`,eventId:event.id,memberId,status:'going',updatedAt:new Date().toISOString()}));data.votes=[id,'demo-me'].map(memberId=>({id:`${poll.id}_${memberId}`,pollId:poll.id,memberId,slotIds:[poll.slotIds[0]],updatedAt:new Date().toISOString()}));localStorage.setItem('moim-demo-v1',JSON.stringify(data));},result.member.id);
  await page.goto('/');await expect(page.locator('.hero-attendees')).toContainText('1명 참여');await expect(page.locator('.home-poll-progress>span')).toHaveText(/^1 \/ /);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).votes.length)).toBe(2);

 });
}
test('profile logout is a red full-width button beneath the settings and works after confirmation',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/profile');const button=page.getByRole('button',{name:'로그아웃',exact:true});
 await expect(button).toHaveClass(/profile-logout-button/);await expect(button).toHaveCSS('background-color','rgb(223, 65, 75)');
 expect(await button.evaluate(element=>element.getBoundingClientRect().top-element.previousElementSibling!.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(16);
 await button.click();await page.getByRole('dialog').getByRole('button',{name:'로그아웃',exact:true}).click();await expect(page.getByRole('heading',{name:'로그인',exact:true})).toBeVisible();
});
