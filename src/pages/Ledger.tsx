import { getLocale } from "../lib/i18n";
import { useI18n } from "../lib/preferences";
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Download, ImagePlus, LoaderCircle, Plus, ReceiptText, Trash2, Wallet, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../lib/store';
import type { LedgerEntry, Receipt } from '../lib/types';
import { errorMessage, formatDate, memberName, today, uid } from '../lib/utils';
import { Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, useToast } from '../components/ui';
import './community.css';
import './ledger-notes.css';
const ledgerCategories = ['회비', '식비', '대관', '준비물', '기타'];
const money = (amount: number) => new Intl.NumberFormat(getLocale()).format(amount);
function csvCell(value: string | number) { const text = String(value); const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll('"', '""')}"`; }
function monthLabel(value: string) { return formatDate(`${value}-01`, {year:"numeric",month:"long"}); }
export function Ledger() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const canManage = app.canParticipate && (app.isAdmin || app.user?.role === 'treasurer');
    const [month, setMonth] = useState(today().slice(0, 7));
    const [allMonths, setAllMonths] = useState(false);
    const [type, setType] = useState<'all' | 'income' | 'expense'>('all');
    const [editor, setEditor] = useState<LedgerEntry | 'new' | null>(null);
    const [receiptEntry, setReceiptEntry] = useState<LedgerEntry | null>(null);
    const balance = app.ledger.reduce((total, item) => total + (item.type === 'income' ? item.amount : -item.amount), 0);
    const monthly = useMemo(() => app.ledger.filter(item => allMonths || item.date.startsWith(month)), [app.ledger, allMonths, month]);
    const income = monthly.filter(item => item.type === 'income').reduce((total, item) => total + item.amount, 0);
    const expense = monthly.filter(item => item.type === 'expense').reduce((total, item) => total + item.amount, 0);
    const entries = monthly.filter(item => type === 'all' || item.type === type).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    function moveMonth(step: number) { const date = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + step, 1); setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`); setAllMonths(false); }
    function download() { if (!entries.length) {
        toast('내보낼 내역이 없어요.', 'error');
        return;
    } const rows = [['날짜', '구분', '분류', '내용', '비고', '금액(원)', '관련 멤버'].map(label=>t(label)), ...entries.map(item => [item.date, item.type === 'income' ? t('수입') : t('지출'), ledgerCategories.includes(item.category) ? t(item.category) : item.category, item.description, item.memo ?? '', item.amount, item.memberId ? memberName(app.members, item.memberId) : ''])]; const blob = new Blob(['\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = t("모임_회계장부_{0}.csv", {"0":allMonths ? t("전체") : month}); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    return <div className="page ledger-page"><PageHeader title={t("회계 장부")} action={<div className="ledger-header-actions"><Button variant="secondary" icon={Download} onClick={download}>{t("내보내기")}</Button>{canManage && <Button icon={Plus} onClick={() => setEditor('new')}>{t("내역 추가")}</Button>}</div>}/>
    <div className="ledger-summary-grid"><div className="card ledger-summary ledger-balance"><div><span className="ledger-summary-icon"><Wallet size={22}/></span><span>{t("현재 잔액")}</span></div><strong>{money(balance)}<small>{t("원")}</small></strong><span>{t("전체 수입 \u2212 전체 지출")}</span></div><div className="card ledger-summary"><div><span className="ledger-summary-icon income"><ArrowDownLeft size={21}/></span><span>{allMonths ? t("전체 수입") : t("선택 기간 수입")}</span></div><strong className="ledger-income">{money(income)}<small>{t("원")}</small></strong><span>{allMonths ? t("전체 기간") : monthLabel(month)}</span></div><div className="card ledger-summary"><div><span className="ledger-summary-icon expense"><ArrowUpRight size={21}/></span><span>{allMonths ? t("전체 지출") : t("선택 기간 지출")}</span></div><strong className="ledger-expense">{money(expense)}<small>{t("원")}</small></strong><span>{allMonths ? t("전체 기간") : monthLabel(month)}</span></div></div>
    <div className="ledger-toolbar"><div className="ledger-month-selector"><IconButton label={t("이전 달")} icon={ChevronLeft} onClick={() => moveMonth(-1)}/><strong>{allMonths ? t("전체 내역") : monthLabel(month)}</strong><IconButton label={t("다음 달")} icon={ChevronRight} onClick={() => moveMonth(1)}/><button className={`ledger-all-months ${allMonths ? 'active' : ''}`} onClick={() => setAllMonths(!allMonths)}>{allMonths ? t("월별 보기") : t("전체 보기")}</button></div><div className="tabs" aria-label={t("수입과 지출 필터")}>{(['all', 'income', 'expense'] as const).map(key => <button key={key} className={`tab ${type === key ? 'active' : ''}`} onClick={() => setType(key)}>{key === 'all' ? t("전체") : key === 'income' ? t("수입") : t("지출")}</button>)}</div></div>
    <div className="card ledger-list"><div className="ledger-list-head"><span>{t("날짜")}</span><span>{t("내역")}</span><span>{t("멤버")}</span><span>{t("금액")}</span>{canManage && <span />}</div>
      {entries.map(item => <div className={`ledger-row ${canManage ? 'manageable' : ''}`} key={item.id}><span className="ledger-date">{formatDate(item.date, { month: '2-digit', day: '2-digit' })}<small>{formatDate(item.date, { weekday: 'short' })}</small></span><div className="ledger-entry-description"><span className={`ledger-entry-icon ${item.type}`}>{item.type === 'income' ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span><div><strong>{item.description}</strong>{item.memo && <p className="ledger-entry-memo" title={item.memo}>{item.memo}</p>}<div><Badge tone={item.type === 'income' ? 'blue' : 'gray'}>{item.type === 'income' ? t("수입") : t("지출")}</Badge><span>{ledgerCategories.includes(item.category) ? t(item.category) : item.category}</span>{item.hasReceipt && <IconButton label={t("영수증 보기")} icon={ReceiptText} onClick={() => setReceiptEntry(item)}/>}</div></div></div><span className="ledger-member">{item.memberId ? memberName(app.members, item.memberId) : '—'}</span><strong className={`ledger-amount ${item.type === 'income' ? 'ledger-income' : 'ledger-expense'}`}>{item.type === 'income' ? '+' : '−'}{money(item.amount)}<small>{t("원")}</small></strong>{canManage && <button className="ledger-edit" onClick={() => setEditor(item)} aria-label={t("{0} 수정", { "0": item.description })}>{t("수정")}</button>}</div>)}
      {entries.length === 0 && <EmptyState icon={ReceiptText} title={t("아직 등록된 내역이 없어요")} description={allMonths ? t("첫 수입이나 지출을 기록해 보세요.") : t("{0}의 {1} 내역이 없어요.", { "0": monthLabel(month), "1": type === 'all' ? t("수입과 지출") : type === 'income' ? t("수입") : t("지출") })} action={canManage ? <Button icon={Plus} onClick={() => setEditor('new')}>{t("내역 추가")}</Button> : undefined}/>}
      {entries.length > 0 && <div className="ledger-list-footer"><span>{t("총 {0}건", {"0":entries.length})}</span><span>{t("선택 기간 수입")}<strong>{money(income)}{t("원")}</strong><i>·</i>{t("지출")}<strong>{money(expense)}{t("원")}</strong></span></div>}
    </div>
    {editor && <LedgerEditor entry={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)}/>}
    {receiptEntry && <ViewReceiptModal entry={receiptEntry} onClose={() => setReceiptEntry(null)}/>}
  </div>;
}
function validateReceiptFile(file: File) { if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WebP 사진을 선택해 주세요.'); if (file.size > 5 * 1024 * 1024)
    throw new Error('영수증 사진은 5MB 이하로 선택해 주세요.'); }
function LedgerEditor({ entry, onClose }: {
    entry?: LedgerEntry;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [type, setType] = useState<'income' | 'expense'>(entry?.type ?? 'income');
    const [date, setDate] = useState(entry?.date ?? today());
    const [category, setCategory] = useState(entry?.category ?? '회비');
    const [amount, setAmount] = useState(entry ? String(entry.amount) : '');
    const [description, setDescription] = useState(entry?.description ?? '');
    const [memo, setMemo] = useState(entry?.memo ?? '');
    const memberId = entry?.memberId ?? '';
    const [saving, setSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const entryId = useRef<string | null>(null);
    if (!entryId.current)
        entryId.current = entry?.id ?? uid();
    const createdAt = useRef(entry?.createdAt ?? new Date().toISOString());
    const entrySaved = useRef(!!entry);
    const entryRevision = useRef(entry?.updatedAt);
    const receiptInput = useRef<HTMLInputElement>(null);
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [receiptLoading, setReceiptLoading] = useState(!!entry?.hasReceipt);
    const [receiptLoadError, setReceiptLoadError] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [draftURL, setDraftURL] = useState('');
    const [receiptRemoved, setReceiptRemoved] = useState(false);
    const [receiptSaveError, setReceiptSaveError] = useState(false);
    const getReceiptRef = useRef(app.getReceipt);
    getReceiptRef.current = app.getReceipt;
    useEffect(() => { if (!entry?.hasReceipt)
        return; let active = true; setReceiptLoading(true); void getReceiptRef.current(entry.id).then(value => { if (active)
        setReceipt(value); }).catch(error => { if (active)
        setReceiptLoadError(errorMessage(error)); }).finally(() => { if (active)
        setReceiptLoading(false); }); return () => { active = false; }; }, [entry?.id, entry?.hasReceipt]);
    useEffect(() => { if (!receiptFile) {
        setDraftURL('');
        return;
    } const url = URL.createObjectURL(receiptFile); setDraftURL(url); return () => URL.revokeObjectURL(url); }, [receiptFile]);
    const preview = receiptRemoved ? '' : draftURL || receipt?.imageURL || '';
    function chooseReceipt(file?: File) { if (!file)
        return; try {
        validateReceiptFile(file);
        setReceiptFile(file);
        setReceiptRemoved(false);
        setReceiptSaveError(false);
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        if (receiptInput.current)
            receiptInput.current.value = '';
    } }
    async function save(e: React.FormEvent) { e.preventDefault(); if (!app.user || saving)
        return; const parsed = Number(amount); if (!Number.isSafeInteger(parsed) || parsed <= 0 || parsed > 10000000000) {
        toast('금액은 1원 이상 100억 원 이하의 정수로 입력해 주세요.', 'error');
        return;
    } if (!description.trim()) {
        toast('내역을 입력해 주세요.', 'error');
        return;
    } if (memo.length > 2000) {
        toast('비고는 2,000자 이내로 입력해 주세요.', 'error');
        return;
    } setSaving(true); setReceiptSaveError(false); let saved = false; try {
        entryRevision.current = await app.saveLedgerEntry({ id: entryId.current!, type, date, category, amount: parsed, description: description.trim(), memo, ...(memberId ? { memberId } : {}), creatorId: entry?.creatorId ?? app.user.id, createdAt: createdAt.current, updatedAt: entryRevision.current ?? new Date().toISOString() }, entrySaved.current);
        entrySaved.current = true;
        saved = true;
        if (receiptFile || receiptRemoved)
            await app.saveReceipt(entryId.current!, receiptRemoved ? null : receiptFile);
        toast(entry ? '회계 내역을 수정했어요.' : '회계 내역을 추가했어요.');
        onClose();
    }
    catch (error) {
        if (saved && (receiptFile || receiptRemoved))
            setReceiptSaveError(true);
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    async function remove() { if (!entrySaved.current || saving)
        return; setSaving(true); try {
        await app.deleteLedgerEntry(entryId.current!);
        toast('회계 내역을 삭제했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <Modal title={entry ? t("회계 내역 수정") : t("회계 내역 추가")} onClose={() => !saving && onClose()} footer={<>{entrySaved.current && <Button variant="ghost" icon={Trash2} onClick={() => setConfirmDelete(true)} disabled={saving}>{t("삭제")}</Button>}<Button variant="secondary" disabled={saving} onClick={onClose}>{t("취소")}</Button><Button form="ledger-form" type="submit" loading={saving}>{t("저장")}</Button></>}>
    <form id="ledger-form" className="stack" onSubmit={save}><div className="ledger-type-picker"><button type="button" className={type === 'income' ? 'active income' : ''} onClick={() => { setType('income'); if (!entry)
        setCategory('회비'); }}><ArrowDownLeft size={18}/>{t("수입")}</button><button type="button" className={type === 'expense' ? 'active expense' : ''} onClick={() => { setType('expense'); if (!entry)
        setCategory('식비'); }}><ArrowUpRight size={18}/>{t("지출")}</button></div><div className="form-grid"><Field label={t("날짜")} required><input type="date" value={date} onChange={e => setDate(e.target.value)} required min="1900-01-01" max="2100-12-31"/></Field><Field label={t("분류")}><select value={category} onChange={e => setCategory(e.target.value)}>{!ledgerCategories.includes(category) && <option value={category}>{category}</option>}{ledgerCategories.map(item => <option key={item} value={item}>{t(item)}</option>)}</select></Field></div><Field label={t("금액")} required><div className="ledger-amount-input"><input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" required min={1} max={10000000000} step={1}/><span>{t("원")}</span></div></Field><Field label={t("내역")} required><input value={description} onChange={e => setDescription(e.target.value)} placeholder={type === 'income' ? t("예) 11월 회비 입금") : t("예) 정기 모임 식사비")} maxLength={100} required/></Field>
    <Field label={t("비고")}><textarea className="ledger-memo-input" aria-label={t("비고")} value={memo} onChange={e => setMemo(e.target.value)} placeholder={t("추가로 남길 내용을 입력해 주세요.")} rows={3} maxLength={2000}/></Field>
    <div className="ledger-receipt-field"><div className="ledger-receipt-field-heading"><span>{t("영수증 사진")}</span><Button variant="secondary" size="sm" icon={ImagePlus} disabled={saving} onClick={() => receiptInput.current?.click()}>{preview ? t("사진 변경") : t("사진 첨부")}</Button></div><input ref={receiptInput} type="file" aria-label={t("영수증 사진")} accept="image/jpeg,image/png,image/webp" hidden onChange={e => chooseReceipt(e.target.files?.[0])}/>
      {receiptLoading && !receiptFile && !receiptRemoved && <div className="ledger-receipt-loading"><LoaderCircle size={17} className="spin"/>{t("영수증 불러오는 중")}</div>}
      {preview && <div className="ledger-receipt-draft"><img src={preview} alt={t("영수증 미리보기")}/><IconButton label={t("첨부 영수증 삭제")} icon={X} disabled={saving} onClick={() => { setReceiptFile(null); setReceiptRemoved(true); setReceiptSaveError(false); }}/><span>{receiptFile?.name ?? receipt?.fileName}</span></div>}
      {receiptRemoved && <p className="ledger-receipt-note">{t("저장하면 영수증이 삭제돼요.")}</p>}{!preview && !receiptLoading && !receiptRemoved && <p className="ledger-receipt-note">{t("JPG, PNG, WebP \u00B7 최대 5MB")}</p>}
      {receiptLoadError && !receiptFile && !receiptRemoved && <p className="ledger-receipt-error" role="alert">{receiptLoadError}{" "}{t("기존 영수증은 유지돼요.")}</p>}
      {receiptSaveError && <p className="ledger-receipt-error" role="alert">{t("내역은 저장됐어요. 영수증을 다시 저장해 주세요.")}</p>}
    </div>
    {confirmDelete && <div className="community-confirm"><span>{t("이 회계 내역을 삭제할까요?")}</span><Button size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>{t("취소")}</Button><Button size="sm" variant="danger" loading={saving} onClick={() => void remove()}>{t("삭제")}</Button></div>}</form>
  </Modal>;
}
function ViewReceiptModal({ entry, onClose }: {
    entry: LedgerEntry;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const canManage = app.canParticipate && (app.isAdmin || app.user?.role === 'treasurer');
    const [receipt, setReceipt] = useState<Receipt | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [zoomed, setZoomed] = useState(false);
    const [revision, setRevision] = useState(0);
    const fileInput = useRef<HTMLInputElement>(null);
    const getReceiptRef = useRef(app.getReceipt);
    getReceiptRef.current = app.getReceipt;
    useEffect(() => { let active = true; setLoading(true); setError(''); void getReceiptRef.current(entry.id).then(value => { if (active)
        setReceipt(value); }).catch(problem => { if (active)
        setError(errorMessage(problem)); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [entry.id, revision]);
    async function replaceReceipt(file?: File) { if (!file || busy)
        return; try {
        validateReceiptFile(file);
    }
    catch (problem) {
        toast(errorMessage(problem), 'error');
        return;
    } setBusy(true); try {
        await app.saveReceipt(entry.id, file);
        setRevision(value => value + 1);
        setZoomed(false);
        toast('영수증을 변경했어요.');
    }
    catch (problem) {
        toast(errorMessage(problem), 'error');
    }
    finally {
        setBusy(false);
        if (fileInput.current)
            fileInput.current.value = '';
    } }
    async function removeReceipt() { if (busy)
        return; setBusy(true); try {
        await app.saveReceipt(entry.id, null);
        toast('영수증을 삭제했어요.');
        onClose();
    }
    catch (problem) {
        toast(errorMessage(problem), 'error');
    }
    finally {
        setBusy(false);
    } }
    return <Modal title={t("영수증")} onClose={() => !busy && onClose()} wide footer={<>{canManage && <><Button variant="ghost" icon={ImagePlus} loading={busy && !confirmDelete} disabled={loading} onClick={() => fileInput.current?.click()}>{t("사진 변경")}</Button>{receipt && <Button variant="ghost" icon={Trash2} disabled={busy || loading} onClick={() => setConfirmDelete(true)}>{t("영수증 삭제")}</Button>}</>}<Button variant="secondary" disabled={busy} onClick={onClose}>{t("닫기")}</Button></>}>
    <div className="ledger-receipt-view"><div className="ledger-receipt-view-heading"><div><strong>{entry.description}</strong><span>{formatDate(entry.date)} · {money(entry.amount)}{t("원")}</span></div>{receipt && <IconButton label={zoomed ? t("영수증 맞춤 보기") : t("영수증 확대 보기")} icon={zoomed ? ZoomOut : ZoomIn} onClick={() => setZoomed(!zoomed)}/>}</div>
      {loading ? <div className="ledger-receipt-loading"><LoaderCircle size={22} className="spin"/>{t("영수증 불러오는 중")}</div> : error ? <div className="ledger-receipt-load-error"><p role="alert">{error}</p><Button variant="secondary" size="sm" onClick={() => setRevision(value => value + 1)}>{t("다시 불러오기")}</Button></div> : receipt ? <><button type="button" className={`ledger-receipt-image ${zoomed ? 'is-zoomed' : ''}`} onClick={() => setZoomed(!zoomed)} aria-label={zoomed ? t("영수증 맞춤 보기") : t("영수증 확대 보기")} aria-pressed={zoomed}><img src={receipt.imageURL} alt={t("{0} 영수증", { "0": entry.description })}/></button><p className="ledger-receipt-file-name">{receipt.fileName}</p></> : <EmptyState icon={ReceiptText} title={t("등록된 영수증이 없어요")}/>}
      {canManage && <input ref={fileInput} type="file" aria-label={t("영수증 사진 변경")} accept="image/jpeg,image/png,image/webp" hidden onChange={e => void replaceReceipt(e.target.files?.[0])}/>}
      {confirmDelete && <div className="community-confirm"><span>{t("영수증을 삭제할까요?")}</span><Button variant="secondary" size="sm" disabled={busy} onClick={() => setConfirmDelete(false)}>{t("취소")}</Button><Button variant="danger" size="sm" loading={busy} onClick={() => void removeReceipt()}>{t("삭제")}</Button></div>}
    </div>
  </Modal>;
}
