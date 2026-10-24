import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const note = { name: '모임 회칙.txt', mimeType: 'text/plain', buffer: Buffer.from('모임 회칙\r\n회비 입금일: 매월 1일\r\n첨부 파일 원문 보존 ✓\n', 'utf8') };
const pdf = { name: '대관 안내.pdf', mimeType: 'application/pdf', buffer: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(600 * 1024, 0x5a), Buffer.from('\n%%EOF\n')]) };
const removed = { name: '제외할 내역.csv', mimeType: 'text/csv', buffer: Buffer.from('날짜,금액\n2026-10-24,20000\n', 'utf8') };

async function newPost(page: Page, title: string) {
  await page.goto('/board');
  await page.getByRole('button', { name: '글쓰기', exact: true }).click();
  const editor = page.getByRole('dialog', { name: '새 이야기', exact: true });
  await editor.getByLabel('제목', { exact: false }).fill(title);
  await editor.getByLabel('내용', { exact: false }).fill('첨부 파일을 확인해 주세요.');
  return editor;
}

async function editPost(detail: Locator, page: Page) {
  await detail.getByRole('button', { name: '게시글 관리', exact: true }).click();
  await detail.getByRole('button', { name: '수정하기', exact: true }).click();
  return page.getByRole('dialog', { name: '게시글 수정', exact: true });
}

async function downloadFile(page: Page, detail: Locator, file: typeof note) {
  const waiting = page.waitForEvent('download');
  await detail.getByRole('button', { name: `${file.name} 다운로드`, exact: true }).click();
  const download = await waiting;
  expect(download.suggestedFilename()).toBe(file.name);
  expect(await download.failure()).toBeNull();
  expect(await readFile((await download.path())!)).toEqual(file.buffer);
}

async function savedAttachments(page: Page, title: string) {
  return page.evaluate(title => JSON.parse(localStorage.getItem('moim-demo-v1')!).posts.find((post: { title: string }) => post.title === title)?.attachments, title);
}

async function attachmentKeys(page: Page) {
  return page.evaluate(async () => {
    if (!(await indexedDB.databases()).some(database => database.name === 'moim-demo-attachments')) return [];
    return new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = indexedDB.open('moim-demo-attachments', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const keys = database.transaction('files', 'readonly').objectStore('files').getAllKeys();
        keys.onerror = () => { database.close(); reject(keys.error); };
        keys.onsuccess = () => { database.close(); resolve(keys.result); };
      };
    });
  });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`게시판 파일 첨부 ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('문서와 PDF를 저장하고 편집·새로고침 후에도 원본 그대로 다운로드한다', async ({ page }) => {
      const title = '첨부 파일 보존 확인';
      let editor = await newPost(page, title);
      await expect(editor.getByText('파일당 5MB · 최대 3개', { exact: true })).toBeVisible();
      await editor.getByLabel('파일 첨부', { exact: true }).setInputFiles([note, pdf, removed]);
      await expect(editor.locator('.board-file-draft')).toHaveCount(3);
      await editor.getByRole('button', { name: `${removed.name} 첨부 삭제`, exact: true }).click();
      await expect(editor.locator('.board-file-draft')).toHaveCount(2);
      for (const file of [note, pdf]) {
        const row = editor.locator('.board-file-draft').filter({ hasText: file.name });
        await expect(row).toBeVisible();
        await expect(row).toContainText(/\d.*(?:KB|MB|B)/);
      }
      await editor.getByRole('button', { name: '올리기', exact: true }).click();
      let detail = page.getByRole('dialog');
      await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
      const metadata = await savedAttachments(page, title);
      expect(metadata).toHaveLength(2);
      expect(await attachmentKeys(page)).toHaveLength(2);
      await expect(detail.locator('.board-attachment-download')).toHaveCount(2);
      await expect(detail.getByText(removed.name, { exact: true })).toHaveCount(0);
      await downloadFile(page, detail, pdf);

      await page.reload();
      detail = page.getByRole('dialog');
      await expect(detail.getByRole('button', { name: `${note.name} 다운로드`, exact: true })).toBeVisible();
      editor = await editPost(detail, page);
      await expect(editor.locator('.board-file-draft')).toHaveCount(2);
      await editor.getByLabel('내용', { exact: false }).fill('본문만 수정해도 첨부 파일은 유지됩니다.');
      await editor.getByRole('button', { name: '수정 완료', exact: true }).click();
      detail = page.getByRole('dialog');
      await expect(detail.getByText('본문만 수정해도 첨부 파일은 유지됩니다.', { exact: true })).toBeVisible();
      expect(await savedAttachments(page, title)).toEqual(metadata);

      editor = await editPost(detail, page);
      await editor.getByRole('button', { name: `${pdf.name} 첨부 삭제`, exact: true }).click();
      await editor.getByRole('button', { name: '수정 완료', exact: true }).click();
      await page.reload();
      detail = page.getByRole('dialog');
      await expect(detail.locator('.board-attachment-download')).toHaveCount(1);
      await expect(detail.getByRole('button', { name: `${pdf.name} 다운로드`, exact: true })).toHaveCount(0);
      await downloadFile(page, detail, note);
      expect(await savedAttachments(page, title)).toEqual([metadata.find((file: { name: string }) => file.name === note.name)]);
      expect(await attachmentKeys(page)).toEqual([metadata.find((file: { name: string }) => file.name === note.name).id]);
      expect(await detail.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  });
}

test('첨부 개수와 파일 크기를 제한하고 취소한 글을 저장하지 않는다', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: '저장하기', exact: true }).click();
  const editor = await newPost(page, '취소한 첨부 글');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('moim-demo-v1')!).posts);
  const filesBefore = await attachmentKeys(page);
  await editor.getByLabel('파일 첨부', { exact: true }).setInputFiles(Array.from({ length: 4 }, (_, index) => ({ ...note, name: `문서-${index + 1}.txt` })));
  await expect(page.locator('.toast').filter({ hasText: /최대 3개/ })).toBeVisible();
  await expect(editor.locator('.board-file-draft')).toHaveCount(0);
  await editor.getByLabel('파일 첨부', { exact: true }).setInputFiles({ name: '큰 파일.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 0x5a) });
  await expect(page.locator('.toast').filter({ hasText: /5MB/ })).toBeVisible();
  await expect(editor.locator('.board-file-draft')).toHaveCount(0);
  await editor.getByLabel('파일 첨부', { exact: true }).setInputFiles(note);
  await expect(editor.locator('.board-file-draft')).toHaveCount(1);
  await editor.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('moim-demo-v1')!).posts)).toEqual(before);
  expect(await attachmentKeys(page)).toEqual(filesBefore);
});

test('승인 대기 사용자는 첨부를 다운로드하고 글쓰기와 첨부 수정은 할 수 없다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const title = '승인 대기 첨부 읽기';
  const editor = await newPost(page, title);
  await editor.getByLabel('파일 첨부', { exact: true }).setInputFiles(note);
  await editor.getByRole('button', { name: '올리기', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: title, exact: true })).toBeVisible();
  const metadata = await savedAttachments(page, title);
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
    // Keep privileged flags so approval status is what prevents writes.
    data.members.find((member: { id: string }) => member.id === 'demo-me').status = 'pending';
    localStorage.setItem('moim-demo-v1', JSON.stringify(data));
  });
  await page.reload();
  const detail = page.getByRole('dialog');
  await expect(page.locator('.pending-access')).toContainText('승인 대기');
  await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '글쓰기', exact: true })).toHaveCount(0);
  await expect(detail.getByRole('button', { name: '게시글 관리', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('파일 첨부', { exact: true })).toHaveCount(0);
  await downloadFile(page, detail, note);
  expect(await savedAttachments(page, title)).toEqual(metadata);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
