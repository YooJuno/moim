import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const image = (name: string) => ({
  name,
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNQyf4LAAJDAY2a3VQGAAAAAElFTkSuQmCC', 'base64'),
});

for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }]) {
  test.describe(`회계 비고 ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('줄바꿈·CSV·영수증·기존 메타데이터를 유지하고 수정하거나 지운다', async ({ page }) => {
      const title = '비고가 있는 대관료';
      const memo = ' =SUM(1,2), "대관료"\n현장 결제 · 다음 달 정산';
      await page.goto('/ledger');
      // Legacy entries without a memo still render and open normally.
      const legacy = page.locator('.ledger-row').first();
      await legacy.getByRole('button', { name: /수정$/ }).click();
      await expect(page.getByRole('dialog').getByLabel('비고', { exact: true })).toHaveValue('');
      await page.getByRole('dialog').getByRole('button', { name: '취소', exact: true }).click();
      await page.getByRole('button', { name: '내역 추가', exact: true }).first().click();
      let editor = page.getByRole('dialog');
      await editor.getByLabel('금액').fill('30000');
      await editor.getByLabel('내역', { exact: false }).fill(title);
      await editor.getByLabel('비고', { exact: true }).fill(memo);
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await page.reload();
      const row = page.locator('.ledger-row').filter({ hasText: title });
      await expect(row.locator('.ledger-entry-memo')).toHaveText(memo);
      await expect(row.locator('.ledger-entry-memo')).toHaveAttribute('title', memo);
      await expect(row.locator('.ledger-entry-memo')).toHaveCSS('-webkit-line-clamp', '2');
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: '내보내기', exact: true }).click();
      const download = await downloadPromise;
      const csv = await readFile((await download.path())!, 'utf8');
      expect(csv).toContain('"비고"');
      // Quoted multiline CSV, escaped quotes, and spreadsheet-formula protection.
      expect(csv).toContain('"\' =SUM(1,2), ""대관료""\n현장 결제 · 다음 달 정산"');

      const original = await page.evaluate((description) => {
        const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
        const entry = data.ledger.find((item: { description: string }) => item.description === description);
        entry.memberId = 'demo-me';
        entry.creatorId = 'legacy-creator';
        entry.createdAt = '2020-01-01T00:00:00.000Z';
        localStorage.setItem('moim-demo-v1', JSON.stringify(data));
        return entry;
      }, title);
      await page.reload();
      await row.getByRole('button', { name: `${title} 수정`, exact: true }).click();
      editor = page.getByRole('dialog');
      await expect(editor.getByLabel('비고', { exact: true })).toHaveValue(memo);
      await editor.getByLabel('영수증 사진', { exact: true }).setInputFiles(image('memo-receipt.png'));
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await row.getByRole('button', { name: '영수증 보기', exact: true }).click();
      const viewer = page.getByRole('dialog');
      await viewer.getByLabel('영수증 사진 변경', { exact: true }).setInputFiles(image('memo-receipt-replaced.png'));
      await expect(viewer.locator('.ledger-receipt-file-name')).toHaveText('memo-receipt-replaced.png');
      await viewer.getByRole('button', { name: '영수증 삭제', exact: true }).click();
      await viewer.locator('.community-confirm').getByRole('button', { name: '삭제', exact: true }).click();
      await expect(viewer).toHaveCount(0);
      await page.reload();
      const preserved = await page.evaluate((id) => JSON.parse(localStorage.getItem('moim-demo-v1')!).ledger.find((entry: { id: string }) => entry.id === id), original.id);
      expect(preserved).toMatchObject({ memo, memberId: original.memberId, creatorId: original.creatorId, createdAt: original.createdAt, hasReceipt: false });

      await row.getByRole('button', { name: `${title} 수정`, exact: true }).click();
      editor = page.getByRole('dialog');
      await editor.getByLabel('비고', { exact: true }).fill('최종 정산\n계좌이체 완료');
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await page.reload();
      await expect(row.locator('.ledger-entry-memo')).toHaveText('최종 정산\n계좌이체 완료');
      await row.getByRole('button', { name: `${title} 수정`, exact: true }).click();
      editor = page.getByRole('dialog');
      await editor.getByLabel('비고', { exact: true }).fill('');
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await page.reload();
      await expect(row.locator('.ledger-entry-memo')).toHaveCount(0);
      expect(await page.evaluate((id) => JSON.parse(localStorage.getItem('moim-demo-v1')!).ledger.find((entry: { id: string }) => entry.id === id).memo, original.id)).toBeUndefined();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });

    test('2,000자 제한과 승인 대기자의 읽기 권한을 유지한다', async ({ page }) => {
      await page.goto('/ledger');
      await page.getByRole('button', { name: '내역 추가', exact: true }).first().click();
      const editor = page.getByRole('dialog');
      await editor.getByLabel('금액').fill('1000');
      await editor.getByLabel('내역', { exact: false }).fill('비고 길이 검증');
      const input = editor.getByLabel('비고', { exact: true });
      await expect(input).toHaveAttribute('maxlength', '2000');
      await input.evaluate(element => element.removeAttribute('maxlength'));
      await input.fill('m'.repeat(2001));
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      await expect(page.getByText('비고는 2,000자 이내로 입력해 주세요.', { exact: true })).toBeVisible();
      await expect(editor).toBeVisible();
      await input.fill('m'.repeat(2000));
      await editor.getByRole('button', { name: '저장', exact: true }).click();
      await expect(editor).toHaveCount(0);
      await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
        const me = data.members.find((member: { id: string }) => member.id === 'demo-me');
        me.status = 'pending';
        localStorage.setItem('moim-demo-v1', JSON.stringify(data));
      });
      await page.reload();
      const row = page.locator('.ledger-row').filter({ hasText: '비고 길이 검증' });
      await expect(row.locator('.ledger-entry-memo')).toHaveText('m'.repeat(2000));
      await expect(page.getByRole('button', { name: '내역 추가', exact: true })).toHaveCount(0);
      await expect(row.getByRole('button', { name: /수정$/ })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
}
