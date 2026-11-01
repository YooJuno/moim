import { MAX_BANK_FILE_BYTES, type BankImportPlan } from './bank-import';

export async function readBankFile(file: File, password: string, signal: AbortSignal): Promise<BankImportPlan> {
  if (!/\.xlsx$/i.test(file.name)) throw new Error('카카오뱅크 .xlsx 파일을 선택해 주세요.');
  if (!file.size || file.size > MAX_BANK_FILE_BYTES) throw new Error('엑셀 파일은 5MB 이하로 선택해 주세요.');
  const bytes = await file.arrayBuffer();
  if (signal.aborted) throw new DOMException('Canceled', 'AbortError');
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../workers/bank-import.worker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate(); };
    const abort = () => { cleanup(); reject(new DOMException('Canceled', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('파일 확인 시간이 초과됐어요. 조회 기간을 나눠 다시 시도해 주세요.')); }, 45000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => { cleanup(); reject(new Error('엑셀을 읽지 못했어요. 다시 시도해 주세요.')); };
    worker.onmessage = (event: MessageEvent<{ error?: string; plan?: BankImportPlan }>) => { cleanup(); if (event.data.error || !event.data.plan) reject(new Error(event.data.error || '거래내역을 읽을 수 없어요.')); else resolve(event.data.plan); };
    worker.postMessage({ bytes, password }, [bytes]);
  });
}
