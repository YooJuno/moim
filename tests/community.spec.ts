import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

for (const viewport of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844}]) {
 test.describe(viewport.name, () => {
  test.use({viewport:{width:viewport.width,height:viewport.height}});

test('게시글 작성·수정, 댓글, 좋아요와 삭제', async ({ page }) => {
  await page.goto('/board');
  await page.getByRole('button', { name: '글쓰기', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목').fill('함께한 주말 기록');
  await dialog.getByLabel('내용').fill('다음 모임에서 사진도 함께 나눠요.');
  await dialog.getByRole('button', { name: '올리기', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '함께한 주말 기록', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '좋아요 0', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '좋아요 1', exact: true })).toBeVisible();
  await dialog.getByLabel('댓글 내용').fill('좋은 주말이었어요!');
  await dialog.getByRole('button', { name: '등록', exact: true }).click();
  await expect(dialog.getByText('좋은 주말이었어요!', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '게시글 관리' }).click();
  await dialog.getByRole('button', { name: '수정하기' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목').fill('함께한 주말 기록 · 수정');
  await dialog.getByRole('button', { name: '수정 완료' }).click();
  await expect(dialog.getByRole('heading', { name: '함께한 주말 기록 · 수정', exact: true })).toBeVisible();
  await page.reload();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('좋은 주말이었어요!', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '좋아요 1', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '댓글 삭제' }).click();
  await expect(dialog.getByText('좋은 주말이었어요!', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: '게시글 관리' }).click();
  await dialog.getByRole('button', { name: '삭제하기' }).click();
  await dialog.getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('함께한 주말 기록 · 수정', { exact: true })).toHaveCount(0);
});

test('사진첩에 올린 이미지가 새로고침 후에도 표시된다', async ({ page }) => {
  await page.goto('/board?category=gallery');
  await page.getByRole('button', { name: '글쓰기', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('제목').fill('테스트 사진 기록');
  await dialog.getByLabel('내용').fill('우리 모임의 작은 순간');
  await dialog.locator('input[type=file]').setInputFiles({ name:'test-photo.png', mimeType:'image/png', buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQyf4LAAJDAY2a3VQGAAAAAElFTkSuQmCC', 'base64') });
  await expect(dialog.getByRole('img', { name:'첨부 사진 1' })).toBeVisible();
  await dialog.getByRole('button', { name: '올리기', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: '테스트 사진 기록', exact: true })).toBeVisible();
  await page.reload();
  const image=page.getByRole('dialog').getByRole('img',{name:'테스트 사진 기록 사진 1'});
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate((element:HTMLImageElement)=>element.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
  await expect(page.getByRole('button',{name:/테스트 사진 기록/})).toBeVisible();
});

test('가입 승인과 멤버 역할·투표 권한 관리', async ({ page }) => {
  await page.goto('/members');
  await page.locator('.member-toolbar').getByRole('button',{name:/가입 대기/}).click();
  const pendingRow=page.locator('.member-row').filter({hasText:'신예린'});
  await expect(pendingRow).toBeVisible();
  await pendingRow.getByRole('button',{name:'승인',exact:true}).click();
  await expect(pendingRow).toHaveCount(0);
  await page.locator('.member-toolbar').getByRole('button',{name:'멤버',exact:true}).click();
  const memberRow=page.locator('.member-row').filter({hasText:'신예린'});
  await memberRow.getByRole('button',{name:/신예린/}).first().click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('권한').selectOption('treasurer');
  await dialog.getByLabel('직책').selectOption('총무');
  await dialog.getByRole('switch').check();
  await dialog.getByLabel('전화번호').fill('010-1234-5678');
  await dialog.getByLabel('거주 지역').fill('서울 종로구');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  await expect(memberRow.getByText('총무',{exact:true})).toBeVisible();
  await page.reload();
  await page.locator('.member-row').filter({hasText:'신예린'}).getByRole('button',{name:/신예린/}).first().click();
  await expect(page.getByRole('dialog').getByRole('switch')).toBeChecked();
  await expect(page.getByRole('dialog').getByLabel('전화번호')).toHaveValue('010-1234-5678');
});

test('내 정보와 관리자 모임 설정을 별도로 저장', async ({ page }) => {
  await page.goto('/profile');
  await page.getByLabel('이름',{exact:false}).fill('김민서 QA');
  await page.getByLabel('전화번호').fill('010-5555-1234');
  await page.getByLabel('거주 지역').fill('서울 강남구');
  await page.locator('.settings-section').first().getByRole('button',{name:'저장하기'}).click();
  await page.goto('/settings');
  await page.getByLabel('모임 이름',{exact:false}).fill('우리의 토요일');
  await page.getByLabel('한 줄 소개').fill('함께 걷고 이야기해요');
  await page.locator('.settings-section').filter({has:page.getByRole('heading',{name:'모임 정보',exact:true})}).getByRole('button',{name:'저장하기'}).click();
  await page.reload();
  await expect(page.getByLabel('모임 이름',{exact:false})).toHaveValue('우리의 토요일');
  await expect(page.getByLabel('전화번호')).toHaveCount(0);
  await page.goto('/profile');
  await expect(page.getByLabel('전화번호')).toHaveValue('010-5555-1234');
  await expect(page.getByLabel('거주 지역')).toHaveValue('서울 강남구');
});

test('회계 수입 추가·수정·필터·CSV 내보내기·삭제', async ({ page }) => {
  await page.goto('/ledger');
  await page.getByRole('button',{name:'내역 추가',exact:true}).first().click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('금액').fill('25000');
  await dialog.getByLabel('내역',{exact:false}).fill('테스트 회비 입금');
  await expect(dialog.getByLabel('관련 멤버')).toHaveCount(0);
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  let row=page.locator('.ledger-row').filter({hasText:'테스트 회비 입금'});
  await expect(row).toContainText('+25,000');
  await row.getByRole('button',{name:'테스트 회비 입금 수정'}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'지출',exact:true}).click();
  await dialog.getByLabel('금액').fill('18000');
  await dialog.getByLabel('내역',{exact:false}).fill('=테스트 간식 구매');
  await dialog.getByRole('button',{name:'저장',exact:true}).click();
  row=page.locator('.ledger-row').filter({hasText:'=테스트 간식 구매'});
  await expect(row).toContainText('−18,000');
  await page.getByRole('button',{name:'수입',exact:true}).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button',{name:'지출',exact:true}).click();
  await expect(row).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'내보내기',exact:true}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/모임_회계장부_.*\.csv/);
  const csv=await readFile((await download.path())!, 'utf8');
  expect(csv).toContain("\"'=테스트 간식 구매\"");
  expect(csv).toContain('18000');
  await row.getByRole('button',{name:'=테스트 간식 구매 수정'}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'삭제',exact:true}).first().click();
  await dialog.locator('.community-confirm').getByRole('button',{name:'삭제',exact:true}).click();
  await expect(row).toHaveCount(0);
});

test('멤버 화면은 다른 사람의 개인정보와 운영 버튼을 숨긴다', async ({ page }) => {
  await page.goto('/profile');
  await page.locator('.settings-section').first().getByRole('button',{name:'저장하기'}).click();
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('moim-demo-v1')!);const me=data.members.find((member:{id:string})=>member.id==='demo-me');me.role='member';me.canCreatePoll=false;localStorage.setItem('moim-demo-v1',JSON.stringify(data));});
  await page.goto('/members');
  await expect(page.getByText('010-0000-1202',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/가입 대기/})).toHaveCount(0);
  await page.getByRole('button',{name:/이준호/}).first().click();
  await expect(page.getByRole('dialog').getByLabel('전화번호')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
  await page.goto('/ledger');
  await expect(page.getByRole('button',{name:'내역 추가',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:/수정$/})).toHaveCount(0);
  await page.goto('/profile');
  await expect(page.getByLabel('모임 이름',{exact:false})).toHaveCount(0);
  await expect(page.getByLabel('전화번호')).toHaveValue('010-0000-1201');
});


test('모임 대표 사진은 저장 후 유지되고 삭제할 수 있다',async({page})=>{
  await page.goto('/settings');
  const group=page.locator('.settings-section').filter({has:page.getByRole('heading',{name:'모임 정보',exact:true})});
  await group.getByLabel('모임 대표 사진').setInputFiles({name:'group-photo.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQyf4LAAJDAY2a3VQGAAAAAElFTkSuQmCC','base64')});
  await expect(group.getByRole('img',{name:'대표 사진 미리보기'})).toBeVisible();
  await expect(page.locator('img[alt="모임 사진"]')).toHaveCount(0);
  await group.getByRole('button',{name:'저장하기',exact:true}).click();
  await expect(page.locator('img[alt="모임 사진"]').first()).toHaveAttribute('src',/^data:image\/webp;base64,/);
  await page.reload();
  await expect(group.getByRole('img',{name:'대표 사진 미리보기'})).toHaveAttribute('src',/^data:image\/webp;base64,/);
  await group.getByRole('button',{name:'모임 사진 삭제',exact:true}).click();
  await group.getByRole('button',{name:'저장하기',exact:true}).click();
  await page.reload();
  await expect(group.getByRole('img',{name:'대표 사진 미리보기'})).toHaveCount(0);
  await expect(page.locator('img[alt="모임 사진"]')).toHaveCount(0);
});

 });
}
