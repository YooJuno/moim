import type { PostAttachment } from './types';

export const MAX_POST_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_FILES = 3;
export const POST_FILE_CHUNK_BYTES = 768 * 1024;
export const MAX_POST_FILE_CHUNKS = 7;

export interface PostFileManifest extends PostAttachment {
  postId: string;
  ownerId: string;
  uploadedBy: string;
  createdAt: string;
  chunkCount: number;
  sha256: string;
}

const attachmentId = /^[A-Za-z0-9_-]{1,80}$/;
const documentId = /^[A-Za-z0-9:_-]{1,128}$/;
const invalidName = /[\u0000-\u001f\u007f-\u009f/\\]/;
const corrupt = () => new Error('첨부 파일이 손상됐거나 완전히 저장되지 않았어요.');

function validateFileInfo(name: unknown, size: unknown, mimeType: unknown): void {
  if (typeof name !== 'string' || !name.trim() || name.length > 200 || invalidName.test(name)) {
    throw new Error('파일 이름은 200자 이내로 입력하고 특수 경로 문자는 빼 주세요.');
  }
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size <= 0 || size > MAX_POST_FILE_BYTES) {
    throw new Error('첨부 파일은 1바이트 이상 5MB 이하로 선택해 주세요.');
  }
  if (typeof mimeType !== 'string' || !mimeType || mimeType.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(mimeType)) {
    throw new Error('파일 형식을 확인해 주세요.');
  }
}

export function validatePostFiles(files: File[], existingCount = 0): void {
  if (!Array.isArray(files) || !Number.isInteger(existingCount) || existingCount < 0 || existingCount + files.length > MAX_POST_FILES) {
    throw new Error('첨부 파일은 최대 3개까지 올릴 수 있어요.');
  }
  for (const file of files) {
    if (!(file instanceof File)) throw new Error('첨부 파일 정보를 확인해 주세요.');
    validateFileInfo(file.name, file.size, file.type || 'application/octet-stream');
  }
}

export function validatePostAttachments(attachments: PostAttachment[]): void {
  if (!Array.isArray(attachments) || attachments.length > MAX_POST_FILES) throw new Error('첨부 파일은 최대 3개까지 올릴 수 있어요.');
  const ids = new Set<string>();
  for (const attachment of attachments) {
    if (!attachment || typeof attachment !== 'object' || Array.isArray(attachment)
      || Object.keys(attachment).some(key => !['id', 'name', 'size', 'mimeType'].includes(key))
      || typeof attachment.id !== 'string' || !attachmentId.test(attachment.id) || ids.has(attachment.id)) {
      throw new Error('첨부 파일 정보를 확인해 주세요.');
    }
    validateFileInfo(attachment.name, attachment.size, attachment.mimeType);
    ids.add(attachment.id);
  }
}

async function digest(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function preparePostAttachment(file: File, postId: string, ownerId: string, uploadedBy: string): Promise<{
  attachment: PostAttachment;
  manifest: PostFileManifest;
  chunks: Uint8Array[];
}> {
  validatePostFiles([file]);
  if (![postId, ownerId, uploadedBy].every(id => typeof id === 'string' && documentId.test(id))) throw new Error('첨부 파일 정보를 확인해 주세요.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size) throw corrupt();
  const attachment: PostAttachment = { id: crypto.randomUUID(), name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream' };
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < bytes.byteLength; offset += POST_FILE_CHUNK_BYTES) chunks.push(bytes.slice(offset, offset + POST_FILE_CHUNK_BYTES));
  const manifest: PostFileManifest = {
    ...attachment, postId, ownerId, uploadedBy, createdAt: new Date().toISOString(), chunkCount: chunks.length, sha256: await digest(bytes),
  };
  return { attachment, manifest, chunks };
}

export async function assemblePostAttachment(manifest: PostFileManifest, chunks: { index: number; bytes: Uint8Array }[]): Promise<Blob> {
  try {
    if (!manifest || typeof manifest !== 'object') throw corrupt();
    validatePostAttachments([{ id: manifest.id, name: manifest.name, size: manifest.size, mimeType: manifest.mimeType }]);
    if (![manifest.postId, manifest.ownerId, manifest.uploadedBy].every(id => typeof id === 'string' && documentId.test(id))
      || typeof manifest.createdAt !== 'string' || !Number.isFinite(Date.parse(manifest.createdAt))
      || !Number.isInteger(manifest.chunkCount) || manifest.chunkCount < 1 || manifest.chunkCount > MAX_POST_FILE_CHUNKS
      || manifest.chunkCount !== Math.ceil(manifest.size / POST_FILE_CHUNK_BYTES)
      || typeof manifest.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.sha256)
      || !Array.isArray(chunks) || chunks.length !== manifest.chunkCount) throw corrupt();
    const ordered = chunks.slice().sort((a, b) => a.index - b.index);
    const bytes = new Uint8Array(manifest.size);
    for (let index = 0; index < ordered.length; index++) {
      const chunk = ordered[index];
      const expectedLength = Math.min(POST_FILE_CHUNK_BYTES, manifest.size - index * POST_FILE_CHUNK_BYTES);
      if (!chunk || chunk.index !== index || !(chunk.bytes instanceof Uint8Array) || chunk.bytes.byteLength !== expectedLength) throw corrupt();
      bytes.set(chunk.bytes, index * POST_FILE_CHUNK_BYTES);
    }
    if (await digest(bytes) !== manifest.sha256) throw corrupt();
    // Every attachment is downloaded, including HTML/SVG, instead of rendered inline.
    return new Blob([bytes.buffer], { type: 'application/octet-stream' });
  } catch {
    throw corrupt();
  }
}
