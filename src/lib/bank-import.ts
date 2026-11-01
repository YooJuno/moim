import type { LedgerEntry } from './types';

export const MAX_BANK_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_BANK_IMPORT_ROWS = 400;
export interface BankTransaction {
  id: string; legacyId: string; sourceRow: number; timestamp: string; date: string; createdAt: string;
  type: 'income' | 'expense'; amount: number; balance: number; description: string; memo: string; category: string;
}
export interface BankImportPlan {
  transactions: BankTransaction[]; firstDate: string; lastDate: string; income: number; expense: number;
  openingBalance: number; closingBalance: number; accountHint: string;
}
export interface BankSheet { name: string; firstRow: number; rows: unknown[][] }
const digest = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), value => value.toString(16).padStart(2, '0')).join('');
const text = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const number = (value: unknown) => {
  const raw = text(value).replaceAll(',', '');
  if (!/^-?\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw new Error('거래 금액을 읽을 수 없어요. 원본 파일을 확인해 주세요.');
  return Number(raw);
};
export const bankLegacyKey = (entry: Pick<LedgerEntry, 'date'|'createdAt'|'type'|'amount'|'description'>) => JSON.stringify([entry.date, entry.createdAt, entry.type, entry.amount, entry.description.trim()]);
export function classifyBankTransactions(transactions: BankTransaction[], ledger: LedgerEntry[]) {
  const byId = new Map(ledger.map(entry => [entry.id, entry]));
  const legacy = new Map<string, string[]>();
  for (const entry of ledger) if (/^bank-[a-f0-9]{16}-\d+$/.test(entry.id)) {
    const key = bankLegacyKey(entry); legacy.set(key, [...legacy.get(key) ?? [], entry.id]);
  }
  const used = new Set<string>();
  return transactions.map(transaction => {
    const duplicateId = [transaction.id, transaction.legacyId].find(id => byId.has(id) && !used.has(id)) ?? legacy.get(bankLegacyKey(transaction))?.find(id => !used.has(id));
    if (duplicateId) used.add(duplicateId);
    return { transaction, duplicateId };
  });
}

export async function parseBankSheets(sheets: BankSheet[], fileHash: string): Promise<BankImportPlan> {
  const fields = ['거래일시','구분','거래금액','거래후잔액','거래구분','내용','메모'];
  let source: BankSheet | undefined, header = -1, columns: number[] = [];
  for (const sheet of sheets) {
    header = sheet.rows.slice(0, 40).findIndex(row => fields.every(field => row.some(value => text(value).replace(/\s/g,'') === field)));
    if (header >= 0) { source = sheet; columns = fields.map(field => sheet.rows[header].findIndex(value => text(value).replace(/\s/g,'') === field)); break; }
  }
  if (!source) throw new Error('카카오뱅크 거래내역 원본 엑셀을 선택해 주세요.');
  const account = source.rows.slice(0, header).find(row => row.some(value => text(value).includes('계좌번호')))?.map(text).join('|').replace(/\s/g,'');
  if (!account) throw new Error('계좌번호가 포함된 카카오뱅크 원본 파일을 선택해 주세요.');
  const accountHash = await digest(account);
  const transactions: BankTransaction[] = [];
  for (let index = header + 1; index < source.rows.length; index++) {
    const row = source.rows[index]; const values = columns.map(column => row[column]);
    if (values.every(value => !text(value))) continue;
    const [stamp, direction, rawAmount, rawBalance, , rawDescription, rawMemo] = values;
    if (!['입금','출금'].includes(text(direction))) {
      if (/^20\d\d[.-]/.test(text(stamp))) throw new Error(`${source.firstRow + index}행의 입출금 구분을 확인해 주세요.`);
      continue;
    }
    const timestamp = text(stamp).replaceAll('.', '-');
    if (!/^20\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) throw new Error('거래 일시를 읽을 수 없어요. 원본 파일을 확인해 주세요.');
    const parsed = new Date(`${timestamp.replace(' ', 'T')}+09:00`);
    if (!Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 9 * 3600000).toISOString().slice(0,19).replace('T',' ') !== timestamp) throw new Error('거래 일시가 올바르지 않아요.');
    const amount = Math.abs(number(rawAmount)), balance = number(rawBalance);
    const type = text(direction) === '입금' ? 'income' : 'expense';
    const description = text(rawDescription) || text(direction), memo = text(rawMemo);
    if (!amount || amount > 1e10 || description.length > 1000 || memo.length > 2000) throw new Error('거래 금액이나 내용이 가져오기 범위를 넘었어요.');
    const categoryText = `${description} ${memo}`;
    const category = /회비/.test(categoryText) ? '회비' : /대관|농구장|체육관/.test(categoryText) ? '대관' : /상비약|농구공|비품/.test(categoryText) ? '준비물' : /식비|식사|음료|간식/.test(categoryText) ? '식비' : '기타';
    const id = `banktx-${await digest(JSON.stringify([accountHash,timestamp,type,amount,balance]))}`;
    transactions.push({ id, legacyId: `bank-${fileHash.slice(0,16)}-${String(source.firstRow + index).padStart(4,'0')}`, sourceRow: source.firstRow + index, timestamp, date: timestamp.slice(0,10), createdAt: parsed.toISOString(), type, amount, balance, description, memo, category });
    if (transactions.length > MAX_BANK_IMPORT_ROWS) throw new Error('한 번에 400건까지 가져올 수 있어요. 조회 기간을 나눠 주세요.');
  }
  if (!transactions.length) throw new Error('가져올 거래내역이 없어요.');
  if (new Set(transactions.map(transaction => transaction.id)).size !== transactions.length) throw new Error('동일한 거래가 반복돼요. 원본 내역을 확인해 주세요.');
  const delta = (transaction: BankTransaction) => transaction.type === 'income' ? transaction.amount : -transaction.amount;
  const reconciles = (rows: BankTransaction[]) => rows.every((row,index) => index === 0 || (rows[index - 1].timestamp <= row.timestamp && rows[index - 1].balance + delta(row) === row.balance));
  const ordered = reconciles(transactions) ? transactions : [...transactions].reverse();
  if (!reconciles(ordered)) throw new Error('거래 금액과 잔액이 맞지 않아요. 수정하지 않은 원본 파일을 선택해 주세요.');
  return { transactions: ordered, firstDate: ordered[0].date, lastDate: ordered.at(-1)!.date, income: ordered.filter(row=>row.type==='income').reduce((sum,row)=>sum+row.amount,0), expense: ordered.filter(row=>row.type==='expense').reduce((sum,row)=>sum+row.amount,0), openingBalance: ordered[0].balance - delta(ordered[0]), closingBalance: ordered.at(-1)!.balance, accountHint: account.match(/\d{4}(?!.*\d)/)?.[0] ?? '' };
}
