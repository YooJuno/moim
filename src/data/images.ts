const databaseName = 'moim-demo-images';
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('사진 저장소를 열 수 없어요. 브라우저 저장 공간을 확인해 주세요.'));
  });
}
export async function saveDemoImage(id: string, blob: Blob): Promise<void> {
  // ArrayBuffer records also work in WebKit contexts that cannot persist Blob values.
  const stored = { bytes: await blob.arrayBuffer(), type: blob.type };
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.objectStore('images').put(stored, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('사진을 저장할 공간이 부족해요.'));
      transaction.onabort = () => reject(new Error('사진을 저장하지 못했어요.'));
    });
  } finally { db.close(); }
}
export async function readDemoImage(id: string): Promise<Blob | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('images').objectStore('images').get(id);
      request.onsuccess = () => {
        const stored = request.result;
        if (stored === undefined || stored instanceof Blob) resolve(stored);
        else if (stored?.bytes instanceof ArrayBuffer && typeof stored.type === 'string') resolve(new Blob([stored.bytes], { type: stored.type }));
        else reject(new Error('사진을 불러오지 못했어요.'));
      };
      request.onerror = () => reject(new Error('사진을 불러오지 못했어요.'));
    });
  } finally { db.close(); }
}

export async function deleteDemoImage(id: string): Promise<void> {
  const db=await database();
  try {await new Promise<void>((resolve,reject)=>{const transaction=db.transaction('images','readwrite');transaction.objectStore('images').delete(id);transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error('저장된 파일을 삭제하지 못했어요.'));transaction.onabort=()=>reject(new Error('파일 삭제가 중단됐어요.'));});}
  finally {db.close();}
}
