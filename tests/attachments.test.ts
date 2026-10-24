import { describe, expect, it } from 'vitest';
import { assemblePostAttachment, MAX_POST_FILE_BYTES, MAX_POST_FILE_CHUNKS, POST_FILE_CHUNK_BYTES, preparePostAttachment, validatePostAttachments, validatePostFiles } from '../src/lib/attachments';

const file = (name = '경기 기록.pdf', bytes: Uint8Array = new Uint8Array([0, 255, 12]), type = 'application/pdf') => new File([new Uint8Array(bytes).buffer], name, { type });
const ready = async (value = file()) => preparePostAttachment(value, 'post-1', 'author-1', 'uploader-1');

describe('post attachment validation and binary roundtrip', () => {
  it('reassembles a 5MiB binary exactly from seven chunks in any retrieval order', async () => {
    const bytes = new Uint8Array(MAX_POST_FILE_BYTES);
    for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
    const { attachment, manifest, chunks } = await ready(file('원본.zip', bytes, 'application/zip'));
    expect(attachment.size).toBe(MAX_POST_FILE_BYTES);
    expect(manifest).toMatchObject({ ...attachment, postId: 'post-1', ownerId: 'author-1', uploadedBy: 'uploader-1', chunkCount: MAX_POST_FILE_CHUNKS });
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(chunks).toHaveLength(7);
    expect(chunks[0].byteLength).toBe(POST_FILE_CHUNK_BYTES);
    expect(chunks[6].byteLength).toBe(MAX_POST_FILE_BYTES - 6 * POST_FILE_CHUNK_BYTES);
    const blob = await assemblePostAttachment(manifest, chunks.map((value, index) => ({ index, bytes: value })).reverse());
    expect(blob.type).toBe('application/octet-stream');
    expect(Buffer.from(await blob.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
  });

  it('keeps unknown file formats downloadable and never renders active formats inline', async () => {
    const { attachment, manifest, chunks } = await ready(file('운영 파일.bin', new Uint8Array([1, 2]), ''));
    expect(attachment.mimeType).toBe('application/octet-stream');
    const html = await ready(new File(['<script>alert(1)</script>'], '안내.html', { type: 'text/html' }));
    expect((await assemblePostAttachment(html.manifest, html.chunks.map((bytes, index) => ({ index, bytes })))).type).toBe('application/octet-stream');
    expect((await assemblePostAttachment(manifest, [{ index: 0, bytes: chunks[0] }])).size).toBe(2);
  });

  it('rejects missing, duplicate, out-of-range, shortened, or tampered chunks', async () => {
    const { manifest, chunks } = await ready(file('기록.bin', new Uint8Array(POST_FILE_CHUNK_BYTES + 3)));
    const data = chunks.map((bytes, index) => ({ index, bytes }));
    const tampered = chunks[0].slice(); tampered[0] = 1;
    for (const invalid of [data.slice(0, 1), [data[0], data[0]], [data[0], { ...data[1], index: 2 }], [data[0], { ...data[1], bytes: chunks[1].slice(1) }], [{ ...data[0], bytes: tampered }, data[1]]]) {
      await expect(assemblePostAttachment(manifest, invalid)).rejects.toThrow('첨부 파일이 손상됐거나 완전히 저장되지 않았어요.');
    }
    for (const changes of [{ size: MAX_POST_FILE_BYTES + 1 }, { chunkCount: 1 }, { sha256: '0'.repeat(64) }, { postId: '../other' }, { createdAt: 'invalid' }]) {
      await expect(assemblePostAttachment({ ...manifest, ...changes }, data)).rejects.toThrow('첨부 파일이 손상됐거나 완전히 저장되지 않았어요.');
    }
  });

  it('enforces count, nonempty bounded sizes, filenames and MIME lengths before upload', () => {
    expect(() => validatePostFiles([file()], 2)).not.toThrow();
    expect(() => validatePostFiles([file(), file()], 2)).toThrow('첨부 파일은 최대 3개까지 올릴 수 있어요.');
    expect(() => validatePostFiles([], -1)).toThrow();
    expect(() => validatePostFiles([file('empty', new Uint8Array())])).toThrow();
    expect(() => validatePostFiles([file('large', new Uint8Array(MAX_POST_FILE_BYTES + 1))])).toThrow();
    for (const name of [' ', '../file', 'path\\file', 'a'.repeat(201), 'bad\nname']) expect(() => validatePostFiles([file(name)])).toThrow();
    expect(() => validatePostFiles([file('valid', new Uint8Array([1]), 'a'.repeat(121))])).toThrow('파일 형식을 확인해 주세요.');
  });

  it('accepts ordinary ASCII and Korean filenames while rejecting actual control and path characters', () => {
    for (const name of ['roster.txt', 'file-01.pdf', '준비물.xlsx']) {
      expect(() => validatePostFiles([file(name)])).not.toThrow();
      expect(() => validatePostAttachments([{ id: 'file-01', name, size: 3, mimeType: 'application/octet-stream' }])).not.toThrow();
    }
    for (const code of [0, 10, 13, 31, 47, 92, 127, 128, 159]) {
      const name = `bad${String.fromCharCode(code)}name.txt`;
      expect(file(name).name).toContain(String.fromCharCode(code));
      expect(() => validatePostFiles([file(name)]), `character code ${code}`).toThrow();
      expect(() => validatePostAttachments([{ id: 'file-01', name, size: 3, mimeType: 'text/plain' }])).toThrow();
    }
    expect(() => validatePostAttachments([{ id: 'file-01', name: 'roster.txt', size: 3, mimeType: `text/plain${String.fromCharCode(10)}` }])).toThrow();
  });

  it('rejects duplicate IDs, invalid metadata and unexpected fields without breaking old empty lists', () => {
    const attachment = { id: 'file-1', name: '기록.pdf', size: 123, mimeType: 'application/pdf' };
    expect(() => validatePostAttachments([])).not.toThrow();
    expect(() => validatePostAttachments([attachment])).not.toThrow();
    expect(() => validatePostAttachments([attachment, attachment])).toThrow();
    for (const changes of [{ id: '../file' }, { size: 0 }, { size: 1.5 }, { mimeType: '' }, { name: 'a/b' }, { extra: true }]) {
      expect(() => validatePostAttachments([{ ...attachment, ...changes }])).toThrow();
    }
  });
});
