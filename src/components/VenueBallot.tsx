import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Info, MapPin, Pencil, Plus, RotateCcw, Trash2, Trophy, Utensils, X } from 'lucide-react';
import { useApp } from '../lib/store';
import type { BallotOption, EventBallot, MoimEvent } from '../lib/types';
import { errorMessage, uid } from '../lib/utils';
import { Badge, Button, Field, IconButton, Modal, useToast } from './ui';
import { AddressField } from './AddressField';
import './venue-ballot.css';
export function VenueBallot({ event }: {
    event: MoimEvent;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const ballot = app.ballots.find(item => item.id === `${event.id}-venue` && item.kind === 'venue');
    const responses = app.ballotResponses.filter(response => response.ballotId === ballot?.id);
    const own = responses.find(response => response.memberId === app.user?.id);
    const validResponses = responses.filter(response => ballot?.optionIds.includes(response.optionId));
    const [choice, setChoice] = useState(own?.optionId ?? '');
    const [editing, setEditing] = useState<EventBallot | 'new' | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const canManage = !!ballot && (app.isAdmin || (app.canCreatePoll && ballot.creatorId === app.user?.id));
    const open = ballot?.status === 'open';
    const confirmed = ballot?.status === 'confirmed';
    const removedChoice = !!own && !ballot?.optionIds.includes(own.optionId);
    useEffect(() => { setChoice(own?.optionId ?? ''); }, [own?.optionId, ballot?.id]);
    useEffect(() => { if (choice && !ballot?.optionIds.includes(choice))
        setChoice(''); }, [ballot?.optionIds, choice]);
    const count = (optionId: string) => validResponses.filter(response => response.optionId === optionId).length;
    const leadingCount = ballot ? Math.max(0, ...ballot.options.map(option => count(option.id))) : 0;
    async function vote() { if (!ballot || !choice || busy)
        return; setBusy('vote'); try {
        await app.saveBallotResponse(ballot.id, choice);
        toast(own ? '투표를 변경했어요.' : '투표했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(null);
    } }
    async function changeStatus() { if (!ballot || busy)
        return; setBusy('status'); try {
        await app.saveBallot({ ...ballot, status: ballot.status === 'open' ? 'closed' : 'open' }, true);
        toast(ballot.status === 'open' ? '장소 투표를 마감했어요.' : '장소 투표를 다시 열었어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(null);
    } }
    async function remove() { if (!ballot || busy)
        return; setBusy('delete'); try {
        await app.deleteBallot(ballot.id);
        setDeleting(false);
        toast('장소 투표를 삭제했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(null);
    } }
    return <section className="venue-ballot" aria-label={t("장소 투표")}><div className="venue-ballot-heading"><h3><MapPin size={17}/>{t("장소 투표")}</h3>{ballot ? <Badge tone={confirmed ? 'green' : open ? 'blue' : 'gray'}>{confirmed ? t("장소 확정") : open ? t("투표 중") : t("마감")}</Badge> : app.canCreatePoll && <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing('new')}>{t("만들기")}</Button>}</div>
    {!ballot ? <div className="venue-ballot-empty"><MapPin size={23}/><span>{t("등록된 장소 후보가 없어요.")}</span></div> : <>
      <div className="venue-ballot-meta"><span>{validResponses.length}{t("명 투표")}</span>{own && !removedChoice && <span><Check size={12}/>{t("내 투표 완료")}</span>}</div>
      {removedChoice && <p className="venue-ballot-revote"><Info size={14}/>{t("선택한 후보가 삭제됐어요. 다시 투표해 주세요.")}</p>}
      <div className="venue-options" role="radiogroup" aria-label={t("장소 후보")}>{ballot.options.map(option => {
                const votes = count(option.id);
                const selected = choice === option.id;
                const winner = confirmed && ballot.selectedOptionId === option.id;
                return <button key={option.id} type="button" role="radio" aria-checked={selected} aria-label={t("{0}{1}, {2}표", { "0": option.label, "1": option.detail ? `, ${option.detail}` : '', "2": votes })} disabled={!app.canParticipate || !open || busy !== null} className={`venue-option ${selected ? 'is-selected' : ''} ${winner ? 'is-winner' : ''}`} onClick={() => setChoice(option.id)}>
        <div className="venue-option-main"><span className="venue-option-radio">{selected ? <Check size={12}/> : winner ? <Trophy size={13}/> : null}</span><div className="venue-option-details"><div><strong>{option.label}</strong>{winner ? <Badge tone="green">{t("확정")}</Badge> : votes > 0 && votes === leadingCount ? <span className="venue-option-leading">{t("최다 득표")}</span> : null}{own?.optionId === option.id && <span className="venue-option-own">{t("내 선택")}</span>}</div>{option.detail && <span><MapPin size={11}/>{option.detail}</span>}{option.menu && <span><Utensils size={11}/>{option.menu}</span>}</div><strong className="venue-option-count">{votes}<small>{t("표")}</small></strong></div>
        <span className="venue-option-bar"><i style={{ width: `${validResponses.length ? votes / validResponses.length * 100 : 0}%` }}/></span>
      </button>;
            })}</div>
      <div className="venue-ballot-actions">{open && app.canParticipate && <Button size="sm" icon={Check} loading={busy === 'vote'} disabled={busy !== null || !choice || (own?.optionId === choice && !removedChoice)} onClick={() => void vote()}>{own?.optionId === choice && !removedChoice ? t("투표 완료") : own ? t("투표 변경") : t("투표하기")}</Button>}{!open && <span className="venue-ballot-closed"><CheckCircle2 size={14}/>{confirmed ? t("확정된 장소예요.") : t("투표가 마감됐어요.")}</span>}{app.isAdmin && !confirmed && <Button variant="secondary" size="sm" icon={MapPin} disabled={busy !== null} onClick={() => setConfirming(true)}>{t("장소 확정")}</Button>}</div>
      {canManage && !confirmed && <div className="venue-ballot-tools"><Button variant="ghost" size="sm" icon={Pencil} disabled={busy !== null} onClick={() => setEditing(ballot)}>{t("후보 수정")}</Button><Button variant="ghost" size="sm" icon={open ? CheckCircle2 : RotateCcw} loading={busy === 'status'} disabled={busy !== null} onClick={() => void changeStatus()}>{open ? t("투표 마감") : t("다시 열기")}</Button><IconButton label={t("장소 투표 삭제")} icon={Trash2} disabled={busy !== null} onClick={() => setDeleting(true)}/></div>}
    </>}
    {editing && <VenueEditor event={event} ballot={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)}/>}
    {deleting && <Modal title={t("장소 투표를 삭제할까요?")} onClose={() => !busy && setDeleting(false)} footer={<><Button variant="secondary" disabled={!!busy} onClick={() => setDeleting(false)}>{t("취소")}</Button><Button variant="danger" loading={busy === 'delete'} onClick={() => void remove()}>{t("삭제")}</Button></>}><p className="muted">{t("장소 후보와 투표 기록이 삭제돼요.")}</p></Modal>}
    {confirming && ballot && <VenueConfirmation ballot={ballot} onClose={() => setConfirming(false)}/>}
  </section>;
}
function VenueEditor({ event, ballot, onClose }: {
    event: MoimEvent;
    ballot?: EventBallot;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [options, setOptions] = useState<BallotOption[]>(ballot?.options.map(option => ({ ...option })) ?? [{ id: uid(), label: '', detail: '', menu: '' }, { id: uid(), label: '', detail: '', menu: '' }]);
    const [saving, setSaving] = useState(false);
    function edit(id: string, key: 'label' | 'detail' | 'menu', value: string) { setOptions(current => current.map(option => option.id === id ? { ...option, [key]: value } : option)); }
    async function save(e: React.FormEvent) { e.preventDefault(); if (!app.user || saving)
        return; if (options.length < 2 || options.length > 30 || options.some(option => !option.label.trim())) {
        toast('장소 이름을 입력하고 후보를 2개 이상 등록해 주세요.', 'error');
        return;
    } if (options.some(option => option.label.trim().length + (option.detail?.trim().length ?? 0) > 497)) {
        toast('장소 이름과 주소는 합쳐서 497자 이내로 입력해 주세요.', 'error');
        return;
    } const labels = options.map(option => `${option.label.trim()}\u0000${option.detail?.trim() ?? ''}`); if (new Set(labels).size !== labels.length) {
        toast('이름과 주소가 같은 후보가 있어요.', 'error');
        return;
    } setSaving(true); const now = new Date().toISOString(); const cleanOptions = options.map(option => ({ id: option.id, label: option.label.trim(), ...(option.detail?.trim() ? { detail: option.detail.trim() } : {}), ...(option.menu?.trim() ? { menu: option.menu.trim() } : {}) })); const next: EventBallot = { id: ballot?.id ?? `${event.id}-venue`, eventId: event.id, kind: 'venue', title: '장소 투표', options: cleanOptions, optionIds: cleanOptions.map(option => option.id), status: ballot?.status ?? 'open', creatorId: ballot?.creatorId ?? app.user.id, createdAt: ballot?.createdAt ?? now, updatedAt: ballot?.updatedAt ?? now }; try {
        await app.saveBallot(next, !!ballot);
        toast(ballot ? '장소 후보를 수정했어요.' : '장소 투표를 만들었어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <Modal title={ballot ? t("장소 후보 수정") : t("장소 투표 만들기")} onClose={() => !saving && onClose()} wide footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>{t("취소")}</Button><Button type="submit" form="venue-editor" loading={saving}>{ballot ? t("저장") : t("투표 만들기")}</Button></>}><form id="venue-editor" className="venue-editor" onSubmit={save}>
    <div className="venue-editor-options">{options.map((option, index) => <div key={option.id} className="venue-editor-option"><div className="venue-editor-option-heading"><strong><span>{index + 1}</span>{t("장소 후보")}</strong><IconButton label={t("후보 {0} 삭제", { "0": index + 1 })} icon={X} disabled={options.length <= 2 || saving} onClick={() => setOptions(current => current.filter(item => item.id !== option.id))}/></div><Field label={t("장소 이름")} required><input value={option.label} onChange={e => edit(option.id, 'label', e.target.value)} placeholder={t("장소 이름")} maxLength={100} required/></Field><AddressField value={option.detail ?? ''} onChange={value => edit(option.id, 'detail', value)} searchName={option.label} onPlaceSelect={result => { if (!option.label.trim()) edit(option.id, 'label', result.name.slice(0, 100)); }} disabled={saving}/><Field label={t("메뉴")}><input value={option.menu ?? ''} onChange={e => edit(option.id, 'menu', e.target.value)} placeholder={t("대표 메뉴 또는 준비할 음식")} maxLength={200}/></Field></div>)}</div>
    <Button variant="secondary" icon={Plus} disabled={options.length >= 30 || saving} onClick={() => setOptions(current => [...current, { id: uid(), label: '', detail: '', menu: '' }])}>{t("후보 추가")}<span className="venue-editor-count">{options.length}/30</span></Button>{ballot && <p className="venue-editor-note">{t("삭제한 후보의 응답은 집계에서 제외돼요. 기존 후보의 응답은 유지돼요.")}</p>}
  </form></Modal>;
}
function VenueConfirmation({ ballot, onClose }: {
    ballot: EventBallot;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const responses = app.ballotResponses.filter(response => response.ballotId === ballot.id && ballot.optionIds.includes(response.optionId));
    const count = (id: string) => responses.filter(response => response.optionId === id).length;
    const ranked = [...ballot.options].sort((a, b) => count(b.id) - count(a.id));
    const [selected, setSelected] = useState(ranked[0]?.id ?? '');
    const [saving, setSaving] = useState(false);
    const option = ballot.options.find(item => item.id === selected);
    async function confirm() { if (!selected || saving)
        return; setSaving(true); try {
        await app.confirmVenue(ballot.id, selected);
        toast('모임 장소를 확정했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <Modal title={t("장소 확정")} onClose={() => !saving && onClose()} footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>{t("취소")}</Button><Button icon={Check} loading={saving} disabled={!option} onClick={() => void confirm()}>{t("장소 확정")}</Button></>}><div className="stack"><Field label={t("확정할 장소")}><select value={selected} onChange={e => setSelected(e.target.value)}>{ranked.map(item => <option key={item.id} value={item.id}>{item.label} · {count(item.id)}{t("표")}</option>)}</select></Field>{option && <div className="venue-confirm-preview"><MapPin size={22}/><div><strong>{option.label}</strong>{option.detail && <span>{option.detail}</span>}{option.menu && <small>{option.menu}</small>}</div></div>}<p className="venue-editor-note">{t("모임 일정의 장소에 반영되고 투표가 마감돼요.")}</p></div></Modal>;
}
