import type { PostFileManifest } from '../lib/attachments';

interface StoredAttachment { manifest: PostFileManifest; blob: Blob }
const databaseName = 'moim-demo-attachments';

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('첨부 파일 저장소를 열 수 없어요. 브라우저 저장 공간을 확인해 주세요.'));
    request.onblocked = () => reject(new Error('첨부 파일 저장소를 열 수 없어요. 브라우저 저장 공간을 확인해 주세요.'));
  });
}

async function mutate(action: (store: IDBObjectStore) => void, message: string): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(message));
      transaction.onabort = () => reject(new Error(message));
      action(transaction.objectStore('files'));
    });
  } finally { db.close(); }
}

export function saveDemoAttachment(manifest: PostFileManifest, blob: Blob): Promise<void> {
  return mutate(store => store.put({ manifest, blob } satisfies StoredAttachment, manifest.id), '첨부 파일을 저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.');
}

export async function readDemoAttachment(id: string): Promise<StoredAttachment | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('files');
      const request = transaction.objectStore('files').get(id);
      let result: StoredAttachment | undefined;
      request.onsuccess = () => { result = request.result as StoredAttachment | undefined; };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(new Error('첨부 파일을 불러오지 못했어요.'));
      transaction.onabort = () => reject(new Error('첨부 파일을 불러오지 못했어요.'));
    });
  } finally { db.close(); }
}

export function deleteDemoAttachment(id: string): Promise<void> {
  return mutate(store => store.delete(id), '첨부 파일을 삭제하지 못했어요.');
}

export function clearDemoAttachments(): Promise<void> {
  return mutate(store => store.clear(), '첨부 파일을 삭제하지 못했어요.');
}
