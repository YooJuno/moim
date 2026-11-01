import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate.min.js';
import { parseBankSheets, type BankSheet } from '../lib/bank-import';

const scope = self as unknown as { onmessage: ((event: MessageEvent<{ bytes: ArrayBuffer; password: string }>) => void) | null; postMessage(value: unknown): void };
scope.onmessage = async ({ data }) => {
  const encrypted = new Uint8Array(data.bytes).slice(0, 4).join(',') === '208,207,17,224';
  if (encrypted && !data.password) { scope.postMessage({ error: '엑셀 비밀번호를 입력해 주세요.' }); return; }
  let workbook;
  try { workbook = await XlsxPopulate.fromDataAsync(data.bytes, { password: data.password }); }
  catch { scope.postMessage({ error: encrypted ? '비밀번호가 맞지 않거나 파일을 열 수 없어요.' : '엑셀 파일을 열 수 없어요. 원본 파일을 확인해 주세요.' }); return; }
  data.password = '';
  try {
    const sheets: BankSheet[] = [];
    for (const sheet of workbook.sheets().slice(0, 5)) {
      const range = sheet.usedRange(); if (!range) continue;
      if (range.endCell().rowNumber() > 5050 || range.endCell().columnNumber() > 30) throw new Error('거래내역 원본 파일을 선택해 주세요.');
      sheets.push({ name: sheet.name(), firstRow: range.startCell().rowNumber(), rows: range.value() });
    }
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data.bytes)), value => value.toString(16).padStart(2,'0')).join('');
    scope.postMessage({ plan: await parseBankSheets(sheets, hash) });
  } catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : '거래내역을 읽을 수 없어요.' }); }
};
