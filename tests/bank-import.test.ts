import { describe, expect, it } from 'vitest';
import { classifyBankTransactions, parseBankSheets, type BankSheet } from '../src/lib/bank-import';
import type { LedgerEntry } from '../src/lib/types';

const sheet = (): BankSheet => ({ name:'카카오뱅크 거래내역',firstRow:4,rows:[['조회기간','2026.11.01'],['계좌번호','3333-**-1234567'],['거래일시','구분','거래금액','거래 후 잔액','거래구분','내용','메모'],['2026.11.01 09:00:00','입금','20,000','20,000','일반입금','테스트 회원','11월 회비'],['2026.11.01 10:00:00','출금','-5,000','15,000','일반이체','테스트 체육관','대관료']] });
const hash = 'a'.repeat(64);
describe('bank transaction imports',()=>{
  it('preserves timestamps, signs and notes and reconciles every bank balance',async()=>{
    const plan=await parseBankSheets([sheet()],hash);
    expect(plan).toMatchObject({income:20000,expense:5000,openingBalance:0,closingBalance:15000});
    expect(plan.transactions[0]).toMatchObject({sourceRow:7,legacyId:`bank-${hash.slice(0,16)}-0007`,createdAt:'2026-11-01T00:00:00.000Z',description:'테스트 회원',memo:'11월 회비'});
    const reverse=sheet();reverse.rows.splice(3,2,...reverse.rows.slice(3).reverse());
    expect((await parseBankSheets([reverse],hash)).transactions.map(row=>row.id)).toEqual(plan.transactions.map(row=>row.id));
  });
  it('uses stable transaction IDs across overlapping exports, not file names, row numbers or export dates',async()=>{
    const first=await parseBankSheets([sheet()],hash);const partial=sheet();partial.firstRow=10;partial.rows=partial.rows.slice(0,3).concat(partial.rows.slice(4));
    const second=await parseBankSheets([partial],'b'.repeat(64));
    expect(second.transactions[0].id).toBe(first.transactions[1].id);
    const existing=first.transactions.map(row=>({...row,creatorId:'actor',updatedAt:'now'} as LedgerEntry));
    expect(classifyBankTransactions(second.transactions,existing)[0].duplicateId).toBe(first.transactions[1].id);
  });
  it('recognizes the previously imported legacy entries without modifying edited notes or categories',async()=>{
    const plan=await parseBankSheets([sheet()],hash);
    const existing=plan.transactions.map(row=>({...row,id:row.legacyId,category:'직접 분류',memo:'직접 수정한 비고',creatorId:'actor',updatedAt:'now'} as LedgerEntry));
    const rows=classifyBankTransactions(plan.transactions,existing);
    expect(rows.every(row=>row.duplicateId)).toBe(true);
    expect(existing[0].memo).toBe('직접 수정한 비고');
  });
  it('does not discard a manual entry with the same day, amount and description',async()=>{
    const plan=await parseBankSheets([sheet()],hash);const row=plan.transactions[0];
    expect(classifyBankTransactions([row],[{...row,id:'manual-entry',creatorId:'actor',updatedAt:'now'}])[0].duplicateId).toBeUndefined();
  });
  it('rejects corrupt balances, invalid dates and repeated ambiguous transactions before any write',async()=>{
    for(const [column,value] of [[3,'10,000'],[0,'2026.02.30 09:00:00']] as const){const source=sheet();source.rows[4][column]=value;await expect(parseBankSheets([source],hash)).rejects.toThrow();}
    const duplicate=sheet();duplicate.rows.push(duplicate.rows[4]);await expect(parseBankSheets([duplicate],hash)).rejects.toThrow('동일한 거래');
    await expect(parseBankSheets([{name:'잘못된 파일',firstRow:1,rows:[['목록']]}],hash)).rejects.toThrow('원본 엑셀');
  });
});
