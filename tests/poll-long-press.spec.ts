import {expect,test,devices} from '@playwright/test';
test('WebKit supports tap selection and held selection without opening a separate drag mode',async({playwright,baseURL})=>{
 const browser=await playwright.webkit.launch({channel:undefined});const context=await browser.newContext({...devices['iPhone 13'],baseURL});const page=await context.newPage();
 try{
  await page.goto('/profile');await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const slots=Array.from({length:3},(_,i)=>({id:`hold-${i}`,date:'2026-11-07',start:`${18+i}:00`,end:`${19+i}:00`}));data.polls.push({id:'hold-test',title:'길게 눌러 선택',description:'',slots,slotIds:slots.map(slot=>slot.id),deadline:null,status:'open',creatorId:'demo-me',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
  await page.goto('/polls?poll=hold-test');const cells=page.getByRole('dialog').locator('.poll-time-cell');await expect(cells).toHaveCount(3);
  await cells.first().tap();await expect(cells.first()).toHaveAttribute('aria-pressed','true');await cells.first().tap();await expect(page.locator('.poll-time-cell.is-selected')).toHaveCount(0);
  const first=await cells.first().boundingBox(),last=await cells.last().boundingBox();if(!first||!last)throw Error('No slots');
  const start={x:first.x+first.width/2,y:first.y+first.height/2},end={x:last.x+last.width/2,y:last.y+last.height/2};
  await cells.first().dispatchEvent('pointerdown',{pointerId:77,pointerType:'touch',clientX:start.x,clientY:start.y});
  await expect(page.locator('.poll-time-cell.is-selected')).toHaveCount(1);
  // Exercise WebKit's non-passive touch handler; native swipe coverage runs with Chromium's touch protocol.
  const canceled=await cells.first().evaluate((element,end)=>{const move=new Event('touchmove',{bubbles:true,cancelable:true});Object.defineProperty(move,'touches',{value:[{clientX:end.x,clientY:end.y}]});return !element.dispatchEvent(move);},end);
  expect(canceled).toBe(true);await expect(page.locator('.poll-time-cell.is-selected')).toHaveCount(3);
  await cells.first().dispatchEvent('pointerup',{pointerId:77,pointerType:'touch'});
  await cells.first().tap();await expect(page.locator('.poll-time-cell.is-selected')).toHaveCount(2);
 }finally{await browser.close();}
});
