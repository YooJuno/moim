import { expect, test, devices } from '@playwright/test';

for (const engine of ['chromium','webkit'] as const) {
  test(`unsaved poll choices survive close cancellation and saved choices close without a prompt on ${engine}`, async ({playwright,baseURL})=>{
    const browser=await playwright[engine].launch({channel:engine==='chromium'?'chrome':undefined});
    try {
      const page=await browser.newPage({...devices['iPhone 13'],baseURL});
      await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
      await page.evaluate(()=>{
        const d=JSON.parse(localStorage.getItem('moim-demo-v1')!);const now=new Date().toISOString();
        const slots=[{id:'draft-a',date:'2026-12-06',start:'08:00',end:'09:00'},{id:'draft-b',date:'2026-12-06',start:'09:00',end:'10:00'}];
        d.polls.push({id:'draft-poll',title:'저장 전 선택 보호',description:'',slots,slotIds:slots.map(s=>s.id),deadline:null,status:'open',creatorId:'demo-me',createdAt:now,updatedAt:now});d.votes.push({id:'draft-poll_demo-me',pollId:'draft-poll',memberId:'demo-me',slotIds:['draft-a'],updatedAt:now});localStorage.setItem('moim-demo-v1',JSON.stringify(d));
      });
      await page.goto('/polls?poll=draft-poll');let dialog=page.getByRole('dialog',{name:'저장 전 선택 보호',exact:true});
      const activate=(locator:ReturnType<typeof page.getByRole>)=>engine==='webkit'?locator.tap():locator.click();
      await activate(dialog.getByRole('button',{name:'닫기',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.goto('/polls?poll=draft-poll');dialog=page.getByRole('dialog',{name:'저장 전 선택 보호',exact:true});await activate(dialog.locator('[data-slot-id="draft-b"]'));
      await activate(dialog.getByRole('button',{name:'닫기',exact:true}));const confirm=page.getByRole('dialog',{name:'저장하지 않고 닫을까요?',exact:true});await expect(confirm).toBeVisible();
      await activate(confirm.getByRole('button',{name:'계속 편집',exact:true}));await expect(confirm).toHaveCount(0);await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);
      await page.keyboard.press('Escape');await expect(confirm).toBeVisible();await page.keyboard.press('Escape');await expect(confirm).toHaveCount(0);await expect(dialog).toBeVisible();
      await activate(dialog.getByRole('button',{name:'선택 수정하기',exact:true}));await expect(page.locator('.toast').last()).toHaveText('가능한 시간을 저장했어요.');await activate(dialog.getByRole('button',{name:'닫기',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.goto('/polls?poll=draft-poll');await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(2);await activate(dialog.locator('[data-slot-id="draft-a"]'));
      await page.locator('.modal-overlay').click({position:{x:3,y:3}});await expect(confirm).toBeVisible();await activate(confirm.getByRole('button',{name:'나가기',exact:true}));await expect(page.getByRole('dialog')).toHaveCount(0);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('moim-demo-v1')!).votes.find((v:{id:string})=>v.id==='draft-poll_demo-me').slotIds);expect(saved.slice().sort()).toEqual(['draft-a','draft-b']);
    } finally { await browser.close(); }
  });
}

test('a board draft and its file survive cancellation, while leaving discards only the draft',async({page})=>{
  await page.goto('/board');await page.getByRole('button',{name:'글쓰기',exact:true}).first().click();const editor=page.getByRole('dialog',{name:'새 이야기',exact:true});
  await editor.getByLabel('제목').fill('저장 전 게시글');await editor.getByLabel('내용').fill('편집 중인 본문');await editor.getByLabel('파일 첨부',{exact:true}).setInputFiles({name:'draft.txt',mimeType:'text/plain',buffer:Buffer.from('draft')});
  await editor.getByRole('button',{name:'취소',exact:true}).click();const confirm=page.getByRole('dialog',{name:'저장하지 않고 닫을까요?',exact:true});await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'계속 편집',exact:true}).click();await expect(editor.getByLabel('제목')).toHaveValue('저장 전 게시글');await expect(editor.locator('.board-file-draft')).toContainText('draft.txt');
  await editor.getByRole('button',{name:'취소',exact:true}).click();await confirm.getByRole('button',{name:'나가기',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.board-post-row').filter({hasText:'저장 전 게시글'})).toHaveCount(0);
});

test('ledger searches notes and formatted amounts, exports the filtered rows and keeps totals intact',async({page})=>{
  await page.setViewportSize({width:390,height:900});await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();await page.goto('/ledger');await page.getByRole('button',{name:'전체 보기',exact:true}).first().click();
  await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('moim-demo-v1')!);const now=new Date().toISOString();d.ledger.push({id:'search-ledger',type:'expense',category:'대관',amount:20000,date:'2026-11-07',description:'검색 전용 체육관',memo:'구리 코트 예약',creatorId:'demo-me',createdAt:now});localStorage.setItem('moim-demo-v1',JSON.stringify(d));});await page.reload();
  const balance=await page.locator('.ledger-balance>strong').innerText();const search=page.getByRole('searchbox',{name:'회계 검색',exact:true});await search.fill('구리 20,000원');await expect(page.locator('.ledger-row')).toHaveCount(1);await expect(page.locator('.ledger-row')).toContainText('검색 전용 체육관');await expect(page.locator('.ledger-balance>strong')).toHaveText(balance);await expect(page.locator('.ledger-list-head')).not.toContainText('멤버');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'내보내기',exact:true}).click();const download=await downloadPromise;const stream=await download.createReadStream();let csv='';for await(const chunk of stream!)csv+=chunk.toString();expect(csv).toContain('검색 전용 체육관');expect(csv.split('\r\n')).toHaveLength(2);
  const description=(await page.locator('.ledger-entry-description').boundingBox())!,amount=(await page.locator('.ledger-amount').boundingBox())!;
  expect(description.y).toBeGreaterThanOrEqual(amount.y+amount.height);
  await search.fill('존재하지않는거래');await expect(page.getByRole('heading',{name:'검색 결과가 없어요',exact:true})).toBeVisible();await page.locator('.ledger-search').getByRole('button',{name:'검색 지우기',exact:true}).click();expect(await page.locator('.ledger-row').count()).toBeGreaterThan(1);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
