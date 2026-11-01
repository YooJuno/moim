import { expect, test } from '@playwright/test';

for (const engine of ['chromium', 'webkit'] as const) {
  test(`large phone photos upload, persist and decode with real ${engine} encoding`, async ({ playwright, baseURL }) => {
    test.setTimeout(90000);
    const browser = await playwright[engine].launch({ channel: engine === 'chromium' ? 'chrome' : undefined });
    const page = await browser.newPage({ baseURL, viewport: { width: 390, height: 844 } });
    try {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/board');
      await page.getByRole('button', { name: '글쓰기', exact: true }).click();
      const editor = page.getByRole('dialog', { name: '새 이야기', exact: true });
      const title = `휴대폰 사진 ${engine}`;
      await editor.getByLabel('제목', { exact: false }).fill(title);
      await editor.getByLabel('내용', { exact: false }).fill('사진 업로드 확인');
      const original = await editor.getByLabel('사진 첨부', { exact: true }).evaluate(async (element: HTMLInputElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1200; canvas.height = 1700;
        const context = canvas.getContext('2d')!;
        const pixels = context.createImageData(canvas.width, canvas.height);
        let random = 12345;
        for (let i = 0; i < pixels.data.length; i += 4) {
          random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
          pixels.data[i] = random & 255; pixels.data[i + 1] = random >>> 8 & 255;
          pixels.data[i + 2] = random >>> 16 & 255; pixels.data[i + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'));
        const probe = document.createElement('canvas'); probe.width = 1; probe.height = 1;
        const encoded = await new Promise<Blob>(resolve => probe.toBlob(value => resolve(value!), 'image/webp'));
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], 'phone-photo.png', { type: 'image/png' }));
        element.files = transfer.files;
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { bytes: blob.size, webp: encoded.type === 'image/webp' };
      });
      expect(original.bytes).toBeGreaterThan(5 * 1024 * 1024);
      await expect(editor.locator('.board-editor-images img')).toHaveCount(1, { timeout: 30000 });
      await editor.getByRole('button', { name: '올리기', exact: true }).click();
      await expect(page.getByRole('dialog').getByRole('heading', { name: title, exact: true })).toBeVisible();
      await page.reload();
      const image = page.getByRole('img', { name: `${title} 사진 1`, exact: true });
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0);
      const saved = await page.evaluate(async title => {
        const { readDemoImage } = await import('/src/data/images.ts');
        const data = JSON.parse(localStorage.getItem('moim-demo-v1')!);
        const path = data.posts.find((post: { title: string }) => post.title === title).images[0];
        const blob = (await readDemoImage(path.replace('demo-image:', '')))!;
        const bitmap = await createImageBitmap(blob);
        const result = { bytes: blob.size, type: blob.type, width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
      }, title);
      expect(saved.bytes).toBeLessThanOrEqual(500 * 1024);
      expect(saved.type).toBe(original.webp ? 'image/webp' : 'image/jpeg');
      expect(saved.width).toBeGreaterThan(500);
      expect(saved.height / saved.width).toBeCloseTo(1700 / 1200, 2);
      expect(saved.height).toBeLessThanOrEqual(2048);
      expect(errors).toEqual([]);

      const limits = await page.evaluate(async () => {
        const { MAX_PHOTO_INPUT_BYTES, validatePhotoFile, preparePostPhoto } = await import('/src/lib/image-upload.ts');
        const file = new File([new Uint8Array(MAX_PHOTO_INPUT_BYTES)], 'limit.jpg', { type: 'image/jpeg' });
        validatePhotoFile(file);
        let tooLarge = '', unreadable = '';
        try { validatePhotoFile(new File([file, 'x'], 'over-limit.jpg', { type: 'image/jpeg' })); }
        catch (error) { tooLarge = (error as Error).message; }
        try { await preparePostPhoto(new File(['invalid'], 'broken.jpg', { type: 'image/jpeg' })); }
        catch (error) { unreadable = (error as Error).message; }
        return { tooLarge, unreadable };
      });
      expect(limits.tooLarge).toContain('20MB');
      expect(limits.tooLarge + limits.unreadable).not.toContain('영수증');
      expect(limits.unreadable).toContain('사진을 읽지 못했어요.');
    } finally { await browser.close(); }
  });
}
