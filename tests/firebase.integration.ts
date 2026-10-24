import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { chooseBirthday } from './helpers/birthday';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
import type { DocumentData } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const password='local-integration-password';
const leaderEmail='leader-integration@example.com';
const pendingEmail='pending-integration@example.com';
let environment: RulesTestEnvironment;
let leaderId:string;
let pendingId:string;

test('real Firebase file attachments preserve maximum-size bytes, editing and pending downloads', async ({ page, browser }) => {
  test.setTimeout(90000);
  const title = 'Firebase 문서 첨부';
  const large = Buffer.alloc(5 * 1024 * 1024);
  for (let i = 0; i < large.length; i++) large[i] = i % 251;
  const note = Buffer.from('회비 안내\r\n매월 1일 · 20,000원\n', 'utf8');
  await login(page, leaderEmail); await page.goto('/board');
  await page.getByRole('button', { name: '글쓰기', exact: true }).first().click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목').fill(title); await dialog.getByLabel('내용').fill('최대 크기의 파일도 원본 그대로 저장합니다.');
  await dialog.getByLabel('파일 첨부', { exact: true }).setInputFiles([
    { name: '대관 자료.pdf', mimeType: 'application/pdf', buffer: large },
    { name: '회비 안내.txt', mimeType: 'text/plain', buffer: note },
  ]);
  await dialog.getByRole('button', { name: '올리기', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: title, exact: true })).toBeVisible({ timeout: 30000 });
  const saved = (await savedPost(title))!;
  expect(saved.attachments).toHaveLength(2);
  expect(saved.attachments[0].size).toBe(large.length);
  await page.reload(); dialog = page.getByRole('dialog');
  const waiting = page.waitForEvent('download');
  await dialog.getByRole('button', { name: '대관 자료.pdf 다운로드', exact: true }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe('대관 자료.pdf');
  expect(readFileSync((await download.path())!)).toEqual(large);
  await dialog.getByRole('button', { name: '게시글 관리', exact: true }).click();
  await dialog.getByRole('button', { name: '수정하기', exact: true }).click();
  await page.getByRole('dialog').getByLabel('내용').fill('본문을 수정했습니다.');
  await page.getByRole('dialog').getByRole('button', { name: '수정 완료', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('본문을 수정했습니다.', { exact: true })).toBeVisible();
  expect((await savedPost(title))!.attachments).toEqual(saved.attachments);

  const pendingContext = await browser.newContext();
  const pendingPage = await pendingContext.newPage();
  await login(pendingPage, pendingEmail);
  await pendingPage.goto(`/board?post=${saved.id}`);
  const pendingDetail = pendingPage.getByRole('dialog');
  await expect(pendingPage.locator('.pending-access')).toBeVisible();
  await expect(pendingDetail.getByRole('button', { name: '게시글 관리', exact: true })).toHaveCount(0);
  const pendingWaiting = pendingPage.waitForEvent('download');
  await pendingDetail.getByRole('button', { name: '회비 안내.txt 다운로드', exact: true }).click();
  expect(readFileSync((await (await pendingWaiting).path())!)).toEqual(note);
  await pendingContext.close();

  dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '게시글 관리', exact: true }).click();
  await dialog.getByRole('button', { name: '삭제하기', exact: true }).click();
  await dialog.locator('.community-confirm').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await savedPost(title)).toBeUndefined();
  // The post snapshot removes the dialog before asynchronous file cleanup finishes.
  await expect.poll(async () => {
    let remaining = true;
    await environment.withSecurityRulesDisabled(async context => {
      const files = await Promise.all(saved.attachments.map((file: { id: string }) => getDoc(doc(context.firestore(), 'postFiles', file.id))));
      remaining = files.some(file => file.exists());
    });
    return remaining;
  }).toBe(false);
  await environment.withSecurityRulesDisabled(async context => {
    const { collection, getDocs } = await import('firebase/firestore');
    for (const file of saved.attachments) {
      expect((await getDoc(doc(context.firestore(), 'postFiles', file.id))).exists()).toBe(false);
      expect((await getDocs(collection(context.firestore(), 'postFiles', file.id, 'chunks'))).empty).toBe(true);
    }
  });
});

async function createAccount(email:string):Promise<string> {
  const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  const result=await response.json();if(!response.ok)throw new Error(JSON.stringify(result));return result.localId as string;
}
async function login(page:Page,email:string) {
  await page.goto('/');
  await page.evaluate(async ({email,password})=>{
    const firebase=await import('/src/lib/firebase.ts');
    const source=await (await fetch('/src/lib/store.tsx')).text();
    const path=source.match(/from\s+["']([^"']*firebase_auth[^"']*)["']/)?.[1];
    if(!path)throw new Error('Firebase Auth module was not found in Vite imports.');
    const auth=await import(path);
    await auth.signInWithEmailAndPassword(firebase.auth,email,password);
  },{email,password});
}
async function savedPost(title:string) {
  let result: DocumentData | undefined;
  await environment.withSecurityRulesDisabled(async context=>{
    const {getDocs,collection}=await import('firebase/firestore');
    const docs=await getDocs(collection(context.firestore(),'posts'));
    result=docs.docs.map(d=>d.data()).find(d=>d.title===title);
  });
  return result;
}

test.beforeAll(async()=>{
  if(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST)throw new Error('Run this suite through Firebase Auth + Firestore emulators.');
  environment=await initializeTestEnvironment({projectId:'demo-moim',firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
  await environment.clearFirestore();
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-moim/accounts',{method:'DELETE'});
  leaderId=await createAccount(leaderEmail);pendingId=await createAccount(pendingEmail);
  await environment.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();const batch=writeBatch(db);const now=new Date().toISOString();
    batch.set(doc(db,'members',leaderId),{id:leaderId,name:'테스트 관리자',email:leaderEmail,role:'leader',status:'active',canCreatePoll:true,joinedAt:now});
    batch.set(doc(db,'members',pendingId),{id:pendingId,name:'가입 신청자',email:pendingEmail,role:'member',status:'pending',canCreatePoll:false,joinedAt:now});
    batch.set(doc(db,'profiles',leaderId),{id:leaderId,phone:'010-1111-1111',area:'서울 마포구'});
    batch.set(doc(db,'profiles',pendingId),{id:pendingId,phone:'010-2222-2222',area:'서울 성동구'});
    batch.set(doc(db,'settings','club'),{name:'Firebase 연동 검증',description:'로컬 에뮬레이터'});
    batch.set(doc(db,'settings','bylaws'),{content:'검증용 회칙',updatedAt:now,editorId:leaderId});
    batch.set(doc(db,'posts','pending-readable-post'),{id:'pending-readable-post',category:'notice',title:'열람용 공지',body:'가입 대기 계정도 읽을 수 있어요.',authorId:leaderId,createdAt:now,updatedAt:now,images:[],pinned:false,likedBy:[]});
    await batch.commit();
  });
});
test.afterAll(async()=>{await environment?.cleanup();});

test('real Firebase provider saves and edits posts and polls, closes, reopens and confirms atomically',async({page})=>{
  await login(page,leaderEmail);
  await expect(page.locator('.sidebar')).toContainText('Firebase 연동 검증');
  await page.goto('/board');
  await page.getByRole('button',{name:'글쓰기',exact:true}).first().click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('제목').fill('Firebase 실제 저장 글');
  await dialog.getByLabel('내용').fill('Firestore 보안 규칙을 적용한 게시물');
  await dialog.getByRole('button',{name:'올리기',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Firebase 실제 저장 글',exact:true})).toBeVisible();
  const firstPost=await savedPost('Firebase 실제 저장 글');
  expect(firstPost).toBeTruthy();
  await dialog.getByRole('button',{name:'좋아요 0',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'좋아요 1',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'게시글 관리'}).click();
  await dialog.getByRole('button',{name:'수정하기',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByLabel('제목').fill('Firebase 실제 저장 글 · 수정');
  await dialog.getByRole('button',{name:'수정 완료',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Firebase 실제 저장 글 · 수정',exact:true})).toBeVisible();
  const revisedPost=await savedPost('Firebase 실제 저장 글 · 수정');
  expect(revisedPost!.updatedAt).not.toBe(firstPost!.updatedAt);
  expect(revisedPost!.likedBy).toEqual([leaderId]);
  await page.reload();
  await expect(page.getByRole('dialog').getByRole('heading',{name:'Firebase 실제 저장 글 · 수정',exact:true})).toBeVisible();

  await page.goto('/polls?create=1');
  dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'선택 초기화',exact:true}).click();
  await dialog.getByLabel('투표 제목').fill('Firebase 일정 투표');
  const future=new Date();future.setDate(future.getDate()+3);
  const dayLabel=`${future.getFullYear()}년 ${future.getMonth()+1}월 ${future.getDate()}일`;
  // The picker shows adjacent-month dates too, so +3 days is always visible.
  await dialog.locator(`.schedule-day[aria-label^="${dayLabel}"]`).click();
  await dialog.getByLabel('공통 시간 1 시작',{exact:true}).fill('14:00');
  await dialog.getByLabel('공통 시간 1 종료',{exact:true}).selectOption('16:00');
  await dialog.getByRole('button',{name:'투표 만들기',exact:true}).click();
  dialog=page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Firebase 일정 투표');
  await dialog.locator('.poll-time-cell').first().click();
  await dialog.getByRole('button',{name:'선택 저장하기',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'선택 수정하기'})).toBeVisible();
  const pollId=new URL(page.url()).searchParams.get('poll')!;
  let before: DocumentData | undefined;
  await environment.withSecurityRulesDisabled(async context=>{before=(await getDoc(doc(context.firestore(),'polls',pollId))).data();});
  await dialog.getByRole('button',{name:'투표 수정',exact:true}).click();
  await page.getByRole('dialog').getByLabel('투표 제목').fill('Firebase 일정 투표 · 수정');
  await page.getByRole('button',{name:'수정하고 열기',exact:true}).click();
  dialog=page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Firebase 일정 투표 · 수정');
  await expect(dialog.locator('.poll-time-cell.is-selected')).toHaveCount(1);
  await dialog.getByRole('button',{name:'투표 마감',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'다시 열기',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'다시 열기',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'투표 마감',exact:true})).toBeVisible();
  await dialog.getByRole('button',{name:'일정 확정',exact:true}).click();
  await page.getByLabel('장소',{exact:false}).fill('서울숲 테스트 장소');
  await page.getByRole('button',{name:'확정하기',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await environment.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();const poll=(await getDoc(doc(db,'polls',pollId))).data()!;
    expect(poll.status).toBe('confirmed');expect(poll.updatedAt).not.toBe(before!.updatedAt);
    expect(poll.slotIds).toEqual(before!.slotIds);
    const vote=(await getDoc(doc(db,'votes',`${pollId}_${leaderId}`))).data()!;
    expect(vote.slotIds).toEqual([poll.slotIds[0]]);
    const event=(await getDoc(doc(db,'events',poll.eventId))).data()!;
    expect(event.pollId).toBe(pollId);expect(event.location).toBe('서울숲 테스트 장소');
    expect(poll.deadline).toBeNull();expect(poll.deadlineAt).toBeNull();
  });
  // Seed only emulator metadata: no Google API request or real invitation is made.
  const calendarLink={ownerId:leaderId,googleEventId:'local-fake-google-event',htmlLink:'https://calendar.google.com/calendar/event?eid=local-test',syncedAt:new Date().toISOString(),attendeeIds:[],signature:'original-calendar-signature'};
  await environment.withSecurityRulesDisabled(async context=>{await updateDoc(doc(context.firestore(),'events',`poll-${pollId}`),{calendarLink});});
  await page.goto(`/calendar?event=poll-${pollId}`);
  dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'일정 수정',exact:true}).click();
  await page.getByRole('dialog').getByLabel('일정 제목').fill('Firebase 일정 · 캘린더 연결 유지');
  await page.getByRole('button',{name:'수정하기',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('Firebase 일정 · 캘린더 연결 유지');
  await environment.withSecurityRulesDisabled(async context=>{
    const saved=(await getDoc(doc(context.firestore(),'events',`poll-${pollId}`))).data()!;
    expect(saved.calendarLink).toEqual(calendarLink);expect(saved.pollId).toBe(pollId);
  });
});

test('pending accounts subscribe to readable group content without participating or accessing other private profiles',async({page})=>{
  await login(page,pendingEmail);
  const access=await page.evaluate(async uid=>{const {exercisePendingAccess}=await import('/tests/fixtures/preferences-probe.tsx');return await exercisePendingAccess(uid);},pendingId);
  expect(access).toMatchObject({canParticipate:false,isAdmin:false,canCreatePoll:false,profiles:[pendingId],blocked:['vote','like','rsvp','upload']});expect(access.postCount).toBeGreaterThan(0);expect(access.memberStatuses.every(status=>status==='active')).toBe(true);
  const privateRead=await page.evaluate(async uid=>{const config=await import('/src/lib/firebase.ts');const source=await(await fetch('/src/lib/store.tsx')).text();const path=source.match(/from\s+["']([^"']*firebase_firestore[^"']*)["']/)?.[1];if(!path)throw Error('Firestore module not found');const sdk=await import(path);try{await sdk.getDoc(sdk.doc(config.db,'profiles',uid));return 'unexpected-success';}catch(error){return (error as {code:string}).code;}},leaderId);expect(privateRead).toBe('permission-denied');
  await environment.withSecurityRulesDisabled(async testContext=>{expect((await getDoc(doc(testContext.firestore(),'members',pendingId))).data()!.status).toBe('pending');expect((await getDoc(doc(testContext.firestore(),'profiles',pendingId))).data()).toMatchObject({phone:'010-3333-3333',area:'서울 강서구'});expect((await getDoc(doc(testContext.firestore(),'votes',`unused-poll_${pendingId}`))).exists()).toBe(false);});
});

test('real Firebase receipts upload atomically, load on demand, survive entry edits and delete cleanly',async({page})=>{
  await login(page,leaderEmail);
  await page.goto('/ledger');
  await page.getByRole('button',{name:'내역 추가',exact:true}).first().click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('금액').fill('20000');
  await dialog.getByLabel('내역',{exact:false}).fill('Firebase 영수증 정산');
  await dialog.getByLabel('영수증 사진',{exact:true}).setInputFiles({name:'receipt-test.jpg',mimeType:'image/jpeg',buffer:readFileSync(new URL('../public/images/gallery-cafe.jpg',import.meta.url))});
  await expect(dialog.getByRole('img',{name:'영수증 미리보기'})).toBeVisible();
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let row=page.locator('.ledger-row').filter({hasText:'Firebase 영수증 정산'});
  await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toBeVisible();
  let entryId='';let imageURL='';
  await environment.withSecurityRulesDisabled(async context=>{
    const {getDocs,collection}=await import('firebase/firestore');const entries=await getDocs(collection(context.firestore(),'ledger'));const entry=entries.docs.find(item=>item.data().description==='Firebase 영수증 정산')!;entryId=entry.id;
    expect(entry.data().hasReceipt).toBe(true);const receipt=(await getDoc(doc(context.firestore(),'receipts',entryId))).data()!;expect(receipt.uploadedBy).toBe(leaderId);expect(receipt.imageURL.length).toBeLessThanOrEqual(700000);imageURL=receipt.imageURL;
  });
  await row.getByRole('button',{name:'영수증 보기',exact:true}).click();
  dialog=page.getByRole('dialog');await expect(dialog).toHaveAccessibleName('영수증');
  await expect(dialog.getByRole('img',{name:'Firebase 영수증 정산 영수증'})).toBeVisible();
  await dialog.getByRole('button',{name:'닫기',exact:true}).last().click();
  await row.getByRole('button',{name:'Firebase 영수증 정산 수정',exact:true}).click();
  dialog=page.getByRole('dialog');await expect(dialog.getByRole('img',{name:'영수증 미리보기'})).toBeVisible();
  await dialog.getByLabel('금액').fill('25000');await dialog.getByLabel('내역',{exact:false}).fill('Firebase 영수증 정산 · 수정');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  row=page.locator('.ledger-row').filter({hasText:'Firebase 영수증 정산 · 수정'});
  await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toBeVisible();
  await environment.withSecurityRulesDisabled(async context=>{expect((await getDoc(doc(context.firestore(),'ledger',entryId))).data()!.hasReceipt).toBe(true);expect((await getDoc(doc(context.firestore(),'receipts',entryId))).data()!.imageURL).toBe(imageURL);});
  await row.getByRole('button',{name:'영수증 보기',exact:true}).click();
  dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'영수증 삭제',exact:true}).click();
  await dialog.locator('.community-confirm').getByRole('button',{name:'삭제',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row.getByRole('button',{name:'영수증 보기',exact:true})).toHaveCount(0);
  await environment.withSecurityRulesDisabled(async context=>{expect((await getDoc(doc(context.firestore(),'ledger',entryId))).data()!.hasReceipt).toBe(false);expect((await getDoc(doc(context.firestore(),'receipts',entryId))).exists()).toBe(false);});
});

test('real Firebase gallery uses compact private photo documents and preserves references before image loading',async({page,context})=>{
  await login(page,leaderEmail);await page.goto('/board?category=gallery');
  await page.getByRole('button',{name:'글쓰기',exact:true}).first().click();let dialog=page.getByRole('dialog');
  await dialog.getByLabel('제목').fill('Firebase 사진 저장');await dialog.getByLabel('내용').fill('Firestore 사진 참조 검증');
  await dialog.getByLabel('사진 첨부',{exact:true}).setInputFiles({name:'group-photo.jpg',mimeType:'image/jpeg',buffer:readFileSync(new URL('../public/images/gallery-cafe.jpg',import.meta.url))});
  await expect(dialog.getByRole('img',{name:'첨부 사진 1'})).toBeVisible();await dialog.getByRole('button',{name:'올리기',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Firebase 사진 저장',exact:true})).toBeVisible();
  let postId='',reference='';
  await environment.withSecurityRulesDisabled(async testContext=>{
    const {getDocs,collection}=await import('firebase/firestore');const posts=await getDocs(collection(testContext.firestore(),'posts'));const post=posts.docs.find(item=>item.data().title==='Firebase 사진 저장')!;postId=post.id;reference=post.data().images[0];expect(reference).toMatch(/^photo:/);
    const photo=(await getDoc(doc(testContext.firestore(),'photos',reference.slice(6)))).data()!;expect(photo.uploadedBy).toBe(leaderId);expect(photo.imageURL).toMatch(/^data:image\/(jpeg|png|webp);base64,/);expect(photo.imageURL.length).toBeLessThanOrEqual(700000);
  });
  // Hold viewport loading so editing exercises unresolved private-image placeholders.
  await page.addInitScript(()=>{window.IntersectionObserver=class {observe(){}unobserve(){}disconnect(){}takeRecords(){return [];}readonly root=null;readonly rootMargin='0px';readonly thresholds=[];} as unknown as typeof IntersectionObserver;});
  await page.reload();dialog=page.getByRole('dialog');await expect(dialog.getByRole('heading',{name:'Firebase 사진 저장',exact:true})).toBeVisible();
  await expect(dialog.getByRole('img',{name:'Firebase 사진 저장 사진 1'})).toHaveAttribute('src',/^data:image\/svg\+xml/);
  await dialog.getByRole('button',{name:'게시글 관리'}).click();await dialog.getByRole('button',{name:'수정하기',exact:true}).click();
  dialog=page.getByRole('dialog');await dialog.getByLabel('제목').fill('Firebase 사진 저장 · 수정');await dialog.getByRole('button',{name:'수정 완료',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Firebase 사진 저장 · 수정',exact:true})).toBeVisible();
  await environment.withSecurityRulesDisabled(async testContext=>{expect((await getDoc(doc(testContext.firestore(),'posts',postId))).data()!.images).toEqual([reference]);});
  const restored=await context.newPage();await restored.goto(page.url());const image=restored.getByRole('dialog').getByRole('img',{name:'Firebase 사진 저장 · 수정 사진 1'});
  await expect(image).toBeVisible();await expect(image).toHaveAttribute('src',/^blob:/);await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);await restored.close();
});

test('real Firebase profile mirrors public month-day birthday while keeping contact data private',async({page})=>{
  await login(page,leaderEmail);await page.goto('/profile');
  await chooseBirthday(page,'02-29');await page.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(page.getByText('내 정보를 저장했어요.',{exact:true})).toBeVisible();
  await environment.withSecurityRulesDisabled(async testContext=>{
    const publicMember=(await getDoc(doc(testContext.firestore(),'members',leaderId))).data()!;const profile=(await getDoc(doc(testContext.firestore(),'profiles',leaderId))).data()!;
    expect(publicMember.birthday).toBe('02-29');expect(profile.birthday).toBe('02-29');expect(publicMember.phone).toBeUndefined();expect(publicMember.area).toBeUndefined();expect(profile.phone).toBe('010-1111-1111');
  });
  await page.reload();await expect(page.getByRole('textbox',{name:'생일',exact:true})).toHaveValue('02-29');
  await chooseBirthday(page,'');await page.getByRole('button',{name:'저장하기',exact:true}).click();await expect(page.getByText('내 정보를 저장했어요.',{exact:true})).toBeVisible();
  await environment.withSecurityRulesDisabled(async testContext=>{expect((await getDoc(doc(testContext.firestore(),'members',leaderId))).data()!.birthday).toBeUndefined();expect((await getDoc(doc(testContext.firestore(),'profiles',leaderId))).data()!.birthday).toBeUndefined();});
});

test('real Firebase account preferences preserve private contact and birthday fields across ordinary profile edits',async({page})=>{
  await environment.withSecurityRulesDisabled(async testContext=>{await updateDoc(doc(testContext.firestore(),'members',leaderId),{birthday:'03-15'});await updateDoc(doc(testContext.firestore(),'profiles',leaderId),{birthday:'03-15'});});
  await login(page,leaderEmail);
  await page.evaluate(async uid=>{const {exercisePreferences}=await import('/tests/fixtures/preferences-probe.tsx');await exercisePreferences(uid);},leaderId);
  await environment.withSecurityRulesDisabled(async testContext=>{
    const profile=(await getDoc(doc(testContext.firestore(),'profiles',leaderId))).data()!;const member=(await getDoc(doc(testContext.firestore(),'members',leaderId))).data()!;
    expect(profile).toMatchObject({id:leaderId,phone:'010-1111-1111',area:'서울 마포구',birthday:'03-15',language:'en',theme:'dark'});
    expect(member).toMatchObject({role:'leader',canCreatePoll:true,birthday:'03-15'});expect(member.theme).toBeUndefined();expect(member.language).toBeUndefined();
  });
});
