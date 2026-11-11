import { expect, test, devices, type Page } from '@playwright/test';

const confirmation=(page:Page)=>page.getByRole('dialog',{name:'저장하지 않고 닫을까요?',exact:true});
for(const engine of ['chromium','webkit'] as const){
  test(`poll, event and ledger editors protect changed drafts and close clean drafts on ${engine}`,async({playwright,baseURL})=>{
    test.setTimeout(60000);
    const browser=await playwright[engine].launch({channel:engine==='chromium'?'chrome':undefined});
    try{
      const page=await browser.newPage({...devices['iPhone 13'],baseURL});
      const click=(locator:ReturnType<Page['getByRole']>)=>engine==='webkit'?locator.tap():locator.click();
      const cases=[
        {path:'/polls?create=1',title:'새 일정 투표',field:'투표 제목',value:'편집 중인 취합'},
        {path:'/calendar?create=1',title:'새 모임 일정',field:'일정 제목',value:'편집 중인 일정'},
        {path:'/ledger',title:'회계 내역 추가',field:'내역',value:'편집 중인 회계'},
      ];
      for(const item of cases){
        await page.goto(item.path);if(item.path==='/ledger')await click(page.getByRole('button',{name:'내역 추가',exact:true}).first());
        const editor=page.getByRole('dialog',{name:item.title,exact:true});const field=editor.getByLabel(item.field,{exact:false});
        const original=await field.inputValue();
        // A clean form closes without a warning.
        await click(editor.getByRole('button',{name:'닫기',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
        if(item.path==='/ledger')await click(page.getByRole('button',{name:'내역 추가',exact:true}).first());else await page.goto(item.path);
        await field.fill(item.value);await click(editor.getByRole('button',{name:'닫기',exact:true}));await expect(confirmation(page)).toBeVisible();
        await click(confirmation(page).getByRole('button',{name:'계속 편집',exact:true}));await expect(field).toHaveValue(item.value);
        // Reverting the only change makes the form clean again.
        await field.fill(original);await click(editor.getByRole('button',{name:'취소',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
        if(item.path==='/ledger')await click(page.getByRole('button',{name:'내역 추가',exact:true}).first());else await page.goto(item.path);
        await field.fill(item.value);await page.keyboard.press('Escape');await expect(confirmation(page)).toBeVisible();
        await click(confirmation(page).getByRole('button',{name:'나가기',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
      }
      // UI-only calendar browsing and opening date overrides are not draft edits.
      await page.goto('/polls?create=1');const editor=page.getByRole('dialog',{name:'새 일정 투표',exact:true});
      await click(editor.getByRole('button',{name:'다음 달',exact:true}));await click(editor.getByRole('button',{name:'날짜별로 다르게 설정',exact:true}));
      await click(editor.getByRole('button',{name:'닫기',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
    }finally{await browser.close();}
  });
}

test('polls close and the next event refreshes at the exact boundary without reloading',async({page})=>{
  await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.clock.install({time:new Date('2026-11-12T12:00:00+09:00')});
  await page.evaluate(()=>{
    const d=JSON.parse(localStorage.getItem('moim-demo-v1')!);const createdAt=new Date().toISOString();
    d.polls=[{id:'boundary',title:'마감 경계 투표',description:'',slots:[],slotIds:[],deadline:'2026-11-12T12:01:00+09:00',status:'open',creatorId:'demo-me',createdAt,updatedAt:createdAt}];
    d.events=[{id:'ending',title:'종료 경계 일정',date:'2026-11-12',start:'11:00',end:'12:02',location:'서울',description:'',creatorId:'demo-me',createdAt}];localStorage.setItem('moim-demo-v1',JSON.stringify(d));
  });
  await page.goto('/polls');await expect(page.locator('.poll-card')).toContainText('마감 경계 투표');
  await page.clock.pauseAt(new Date('2026-11-12T12:00:30+09:00'));
  await page.clock.fastForward(29999);await expect(page.locator('.poll-card')).toHaveCount(1);
  await page.clock.fastForward(1);await expect(page.locator('.poll-card')).toHaveCount(0);
  await page.clock.resume();await page.getByRole('button',{name:/지난 투표/}).click();await expect(page.locator('.poll-card')).toContainText('마감됨');
  await page.goto('/');await expect(page.locator('.home-next-event')).toContainText('종료 경계 일정');await page.clock.pauseAt(new Date('2026-11-12T12:01:30+09:00'));await page.clock.fastForward(30000);await expect(page.locator('.home-next-event')).toContainText('예정된 일정이 없어요.');
});

test('the poll list matches home priority and reorders an answered poll after saving',async({page})=>{
  await page.clock.setFixedTime(new Date('2026-10-24T12:00:00+09:00'));
  await page.setViewportSize({width:390,height:900});await page.goto('/polls');
  await expect(page.locator('.poll-card').first()).toContainText('다음 모임, 언제 만날까요?');
  await page.locator('.poll-card').first().click();await page.locator('.poll-time-cell').first().click();await page.getByRole('button',{name:'선택 저장하기',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await expect(page.locator('.poll-card').first()).toContainText('전시 보러 갈 사람?');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('stored photos are read only when visible and reused when reopening a post',async({page})=>{
  await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.evaluate(async()=>{
    const {saveDemoImage}=await import('/src/data/images.ts');const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!),'image/png'));await saveDemoImage('lazy-photo',blob);
    const d=JSON.parse(localStorage.getItem('moim-demo-v1')!);d.posts=[{id:'lazy-post',category:'gallery',title:'지연 로딩 사진',body:'내용',images:['demo-image:lazy-photo'],authorId:'demo-me',pinned:false,likedBy:[],createdAt:new Date().toISOString()}];localStorage.setItem('moim-demo-v1',JSON.stringify(d));
  });
  await page.addInitScript(()=>{
    const original=IDBObjectStore.prototype.get;const counts:Record<string,number>={};(window as unknown as {photoReads:Record<string,number>}).photoReads=counts;
    IDBObjectStore.prototype.get=function(key){if(this.transaction.db.name==='moim-demo-images')counts[String(key)]=(counts[String(key)]??0)+1;return original.call(this,key);};
  });
  await page.goto('/');expect(await page.evaluate(()=>(window as unknown as {photoReads:Record<string,number>}).photoReads)).toEqual({});
  await page.locator('.mobile-nav a[href="/board"],.desktop-nav a[href="/board"]').filter({visible:true}).first().click();
  const thumbnail=page.locator('.board-row-thumb');await expect.poll(()=>thumbnail.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(20);
  await page.locator('.board-post-row').click();const image=page.getByRole('img',{name:'지연 로딩 사진 사진 1',exact:true});await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.naturalWidth)).toBe(20);
  expect(await page.evaluate(()=>(window as unknown as {photoReads:Record<string,number>}).photoReads['lazy-photo'])).toBe(1);
});
