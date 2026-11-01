import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, FileSpreadsheet, Upload, X } from 'lucide-react';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/preferences';
import { classifyBankTransactions, type BankImportPlan } from '../lib/bank-import';
import { readBankFile } from '../lib/read-bank-file';
import { errorMessage } from '../lib/utils';
import { Button, Field, Modal, useToast } from './ui';
import './bank-import.css';

export function BankImport({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const app = useApp(); const { t, formatNumber } = useI18n(); const toast = useToast();
  const [file, setFile] = useState<File | null>(null), [password, setPassword] = useState('');
  const [plan, setPlan] = useState<BankImportPlan | null>(null), [error, setError] = useState('');
  const [busy, setBusy] = useState<'read' | 'save' | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const rows = useMemo(() => plan ? classifyBankTransactions(plan.transactions, app.ledger) : [], [plan, app.ledger]);
  const fresh = rows.filter(row => !row.duplicateId);
  const income = fresh.filter(row=>row.transaction.type==='income').reduce((sum,row)=>sum+row.transaction.amount,0);
  const expense = fresh.filter(row=>row.transaction.type==='expense').reduce((sum,row)=>sum+row.transaction.amount,0);
  function close() { if (busy === 'save') return; request.current?.abort(); setPassword(''); onClose(); }
  async function preview(event: React.FormEvent) {
    event.preventDefault();if(!file||busy)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;setBusy('read');setError('');
    try { const result=await readBankFile(file,password,controller.signal);if(!controller.signal.aborted){setPassword('');setPlan(result);} }
    catch(problem){if(!controller.signal.aborted)setError(problem instanceof Error?problem.message:'거래내역을 읽을 수 없어요.');}
    finally{if(!controller.signal.aborted)setBusy(null);}
  }
  async function save() {
    if(!plan||!fresh.length||busy)return;setBusy('save');setError('');
    try{const result=await app.importBankTransactions(plan.transactions);toast(t('{0}건을 반영했어요. 중복 {1}건은 제외했어요.',{'0':result.added,'1':result.skipped}));onSaved();}
    catch(problem){errorMessage(problem);setError('거래내역을 저장하지 못했어요. 연결과 회계 권한을 확인해 주세요.');setBusy(null);}
  }
  return <Modal title={t('엑셀 가져오기')} wide className="bank-import-modal" onClose={close} footer={<><Button icon={X} iconOnly variant="secondary" disabled={busy==='save'} onClick={close}>{t('닫기')}</Button>{plan?<Button icon={Check} loading={busy==='save'} disabled={!fresh.length} onClick={()=>void save()}>{t('{0}건 반영',{'0':fresh.length})}</Button>:<Button type="submit" form="bank-import-form" icon={Upload} loading={busy==='read'} disabled={!file}>{t('내역 확인')}</Button>}</>}>
    {!plan?<form id="bank-import-form" className="stack" onSubmit={preview}>
      <Field label={t('거래내역 엑셀')} required><div className="bank-import-file"><FileSpreadsheet size={24}/><input type="file" accept=".xlsx" aria-label={t('거래내역 엑셀')} disabled={!!busy} onChange={event=>{setFile(event.target.files?.[0]??null);setPassword('');setError('');}}/></div></Field>
      <Field label={t('엑셀 비밀번호')}><input type="password" value={password} onChange={event=>setPassword(event.target.value)} autoComplete="off" disabled={!!busy} placeholder={t('파일에 설정한 비밀번호')}/></Field>
      <p className="field-hint">{t('카카오뱅크 거래내역 .xlsx · 파일과 비밀번호는 저장하지 않아요.')}</p>
    </form>:<div className="bank-import-preview">
      <div className="bank-import-period"><strong>{plan.firstDate}–{plan.lastDate}</strong>{plan.accountHint&&<span>{t('계좌 끝자리 {0}',{'0':plan.accountHint})}</span>}<Button size="sm" variant="ghost" disabled={!!busy} onClick={()=>{setPlan(null);setFile(null);setPassword('');setError('');}}>{t('파일 변경')}</Button></div>
      <div className="bank-import-counts"><div><span>{t('새 내역')}</span><strong>{fresh.length}</strong></div><div><span>{t('중복 제외')}</span><strong>{rows.length-fresh.length}</strong></div><div><span>{t('파일 거래')}</span><strong>{rows.length}</strong></div></div>
      <div className="bank-import-totals"><span>{t('추가 수입')}<strong className="ledger-income">+{formatNumber(income)}{t('원')}</strong></span><span>{t('추가 지출')}<strong className="ledger-expense">−{formatNumber(expense)}{t('원')}</strong></span></div>
      {!fresh.length&&<p className="bank-import-done" role="status">{t('모두 이미 반영된 내역이에요.')}</p>}
      <div className="bank-import-rows" role="region" aria-label={t('가져올 거래내역')}>{rows.map(({transaction:row,duplicateId})=><div className={`bank-import-row ${duplicateId?'is-duplicate':''}`} key={row.id}><div><time>{row.timestamp}</time><strong>{row.description}</strong>{row.memo&&<p>{row.memo}</p>}</div><div><strong className={row.type==='income'?'ledger-income':'ledger-expense'}>{row.type==='income'?'+':'−'}{formatNumber(row.amount)}{t('원')}</strong><span>{duplicateId?t('중복'):t('추가')}</span></div></div>)}</div>
      <details className="bank-import-controls"><summary>{t('파일 합계 확인')}</summary><dl><div><dt>{t('파일 수입')}</dt><dd>{formatNumber(plan.income)}{t('원')}</dd></div><div><dt>{t('파일 지출')}</dt><dd>{formatNumber(plan.expense)}{t('원')}</dd></div><div><dt>{t('조회 시작 잔액')}</dt><dd>{formatNumber(plan.openingBalance)}{t('원')}</dd></div><div><dt>{t('마지막 거래 후 잔액')}</dt><dd>{formatNumber(plan.closingBalance)}{t('원')}</dd></div></dl></details>
    </div>}
    {error&&<p className="auth-error" role="alert">{t(error)}</p>}
  </Modal>;
}
