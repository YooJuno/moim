import { translate } from "../lib/i18n";
import { useI18n } from "../lib/preferences";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, BarChart3, CalendarCheck, Check, ChevronDown, ChevronRight, Clock3, ListChecks, LockKeyhole, Pencil, Plus, RotateCcw, Share2, Trash2, Trophy, Users, X, Save } from 'lucide-react';
import { useApp } from '../lib/store';
import type { Poll, PollSlot, Vote } from '../lib/types';
import { errorMessage, formatDate, formatTime, memberName, shortDate, slotLabel, today, uid } from '../lib/utils';
import { PlacePicker } from '../components/PlacePicker';
import { InviteShare } from '../components/InviteShare';
import { ActionMenu } from '../components/ActionMenu';
import { useDraftClose } from '../components/useDraftClose';
import { AddressField } from '../components/AddressField';
import { TimeInput } from '../components/TimeInput';
import { notifyEventConfirmed } from '../lib/sms';
import { Avatar, Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, useToast } from '../components/ui';
import { MonthNavigation, ScrollingCalendar } from './ScheduleGrid';
import { getHoliday, hasHolidayData } from '../lib/holidays';
import { contiguousEndSlots, expandTimeWindows, pollTimeWindows, timeToMinutes } from '../lib/poll-times';
import { monthlyPollDates, monthlyPollTitle, nextPollMonth } from '../lib/poll-presets';
import { getPollAvailabilityWindows } from '../lib/poll-results';
import { buildPollGridIndex, slotPosition } from '../lib/poll-grid';
import { isPollOpen as isOpen, sortOpenPolls } from '../lib/poll-list';
import type { PollAvailabilityWindow } from '../lib/poll-results';
import './schedule.css';
import './poll-time-grid.css';
import './poll-list.css';
const canManage = (poll: Poll, userId: string | undefined, admin: boolean, allowed: boolean) => admin || (allowed && poll.creatorId === userId);
const localDateTime = (value: string) => { const d = new Date(value); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
function deadlineLabel(poll: Poll, now: number) {
    if (!isOpen(poll, now)) return translate('마감됨');
    return poll.deadline ? translate('{0} 마감', undefined, {'0': `${shortDate(poll.deadline)} · ${formatTime(poll.deadline)}`}) : translate('마감 없음');
}
export function Polls() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const [tab, setTab] = useState<'open' | 'past'>('open');
    const [editing, setEditing] = useState<Poll | 'new' | null>(null);
    const [deleting, setDeleting] = useState<Poll | null>(null);
    const [confirming, setConfirming] = useState<{
        poll: Poll;
        range?: PollAvailabilityWindow;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const selected = app.polls.find(p => p.id === params.get('poll'));
    const voteGroups = useMemo(() => {
        const grouped = new Map<string, Vote[]>();
        for (const vote of app.votes) { const group = grouped.get(vote.pollId) ?? []; group.push(vote); grouped.set(vote.pollId, group); }
        return grouped;
    }, [app.votes]);
    const active = useMemo(() => sortOpenPolls(app.polls, app.votes, app.user?.id, app.canParticipate, app.now), [app.polls, app.votes, app.user?.id, app.canParticipate, app.now]);
    const past = useMemo(() => app.polls.filter(p => !isOpen(p, app.now)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [app.polls, app.now]);
    const visible = tab === 'open' ? active : past;
    // Past results are not needed while looking at ongoing polls (and vice versa).
    const bestWindows = useMemo(() => new Map(visible.map(poll => [poll.id, getPollAvailabilityWindows(poll, voteGroups.get(poll.id) ?? [])[0]])), [visible, voteGroups]);
    const activeCount = useMemo(() => app.members.filter(m => m.status === 'active').length, [app.members]);
    const membersById = useMemo(() => new Map(app.members.map(member => [member.id, member])), [app.members]);
    const closeDetail = () => { const next = new URLSearchParams(params); next.delete('poll'); setParams(next, { replace: true }); };
    const openDetail = (poll: Poll) => { const next = new URLSearchParams(params); next.set('poll', poll.id); setParams(next); };
    useEffect(() => {
        if (params.get('create') === '1' && app.canCreatePoll) {
            setEditing('new');
            const next = new URLSearchParams(params);
            next.delete('create');
            setParams(next, { replace: true });
        }
    }, [params, setParams, app.canCreatePoll]);
    const changeStatus = async (poll: Poll) => {
        setBusy(true);
        try {
            if (!isOpen(poll) && poll.deadline && new Date(poll.deadline).getTime() <= Date.now()) {
                closeDetail();
                setEditing(poll);
                toast('마감일을 변경하면 투표를 다시 열 수 있어요.');
                return;
            }
            await app.savePoll({ ...poll, status: isOpen(poll) ? 'closed' : 'open' }, true);
            toast(isOpen(poll) ? '투표를 마감했어요.' : '투표를 다시 열었어요.');
        }
        catch (error) {
            toast(errorMessage(error), 'error');
        }
        finally {
            setBusy(false);
        }
    };
    return <div className="page polls-page">
    <PageHeader title={t("일정 투표")} action={app.canCreatePoll ? <Button iconOnly icon={Plus} onClick={() => setEditing('new')}>{t("투표 만들기")}</Button> : undefined}/>
    <div className="tabs" aria-label={t("투표 목록")}>
      <button className={`tab ${tab === 'open' ? 'active' : ''}`} aria-pressed={tab === 'open'} onClick={() => setTab('open')}>{t("진행 중")}<span>{active.length}</span></button>
      <button className={`tab ${tab === 'past' ? 'active' : ''}`} aria-pressed={tab === 'past'} onClick={() => setTab('past')}>{t("지난 투표")}<span>{past.length}</span></button>
    </div>
    {visible.length ? <div className="poll-grid">{visible.map(poll => {
                const votes = voteGroups.get(poll.id) ?? [];
                const ownVote = votes.find(v => v.memberId === app.user?.id);
                const staleVote = ownVote?.slotIds.some(id => !poll.slotIds.includes(id));
                const first = bestWindows.get(poll.id);
                const total = activeCount;
                const participating = votes.map(v => membersById.get(v.memberId)).filter((m): m is NonNullable<typeof m> => !!m);
                return <button className="card poll-card" key={poll.id} onClick={() => openDetail(poll)}>
        <div className="poll-card-top"><Badge tone={poll.status === 'confirmed' ? 'green' : isOpen(poll, app.now) ? 'blue' : 'gray'}>{poll.status === 'confirmed' ? t("일정 확정") : isOpen(poll, app.now) ? t("투표 중") : t("마감")}</Badge>{poll.status !== 'confirmed' && <span className="poll-deadline">{isOpen(poll, app.now) && <Clock3 size={13}/>}{deadlineLabel(poll, app.now)}</span>}</div>
        <h2>{poll.title}</h2>{poll.description && <p className="poll-card-description">{poll.description}</p>}
        {first ? <div className="poll-best"><Trophy size={16}/><div><span>{t("가장 많은 인원이 가능한 시간")}</span><strong>{shortDate(first.date)} · {first.start}–{first.end}<em>{first.memberIds.length}{t("명")}</em></strong></div></div> : <div className="poll-best poll-best-empty"><BarChart3 size={18}/><span>{t("첫 번째 가능한 시간을 알려 주세요")}</span></div>}
        <div className="poll-progress"><div style={{ width: `${total ? Math.min(votes.length / total * 100, 100) : 0}%` }}/></div>
        <div className="poll-card-bottom"><div className="poll-avatar-stack">{participating.slice(0, 4).map(member => <Avatar key={member.id} member={member} size={27}/>)}<span>{votes.length}<span className="muted"> / {total}{t("명 참여")}</span></span></div><span className={ownVote ? 'poll-voted' : 'poll-vote-cta'}>{ownVote ? staleVote && isOpen(poll) ? <>{t("선택 확인")}<ChevronRight size={15}/></> : <><Check size={14}/>{t("참여 완료")}</> : isOpen(poll) && app.canParticipate ? <>{t("참여하기")}<ArrowRight size={15}/></> : <>{t("결과 보기")}<ChevronRight size={15}/></>}</span></div>
      </button>;
            })}</div> : <EmptyState icon={ListChecks} title={tab === 'open' ? t("진행 중인 투표가 없어요") : t("지난 투표가 없어요")} action={app.canCreatePoll && tab === 'open' ? <Button icon={Plus} onClick={() => setEditing('new')}>{t("투표 만들기")}</Button> : undefined}/>}
    {selected && !editing && !deleting && !confirming && <PollDetail poll={selected} onClose={closeDetail} onEdit={() => { closeDetail(); setEditing(selected); }} onDelete={() => { closeDetail(); setDeleting(selected); }} onConfirm={range => { closeDetail(); setConfirming({ poll: selected, range }); }} onStatus={() => changeStatus(selected)} busy={busy}/>}
    {editing && <PollEditor poll={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={poll => { setEditing(null); setTab('open'); openDetail(poll); }}/>}
    {confirming && <ConfirmPoll poll={confirming.poll} range={confirming.range} onClose={() => setConfirming(null)}/>}
    {deleting && <Modal title={t("투표를 삭제할까요?")} onClose={() => !busy && setDeleting(null)} footer={<><Button icon={X} iconOnly variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>{t("취소")}</Button><Button icon={Trash2} iconOnly variant="danger" loading={busy} onClick={async () => { setBusy(true); try {
        await app.deletePoll(deleting.id);
        setDeleting(null);
        toast('투표를 삭제했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }}>{t("삭제하기")}</Button></>}><p className="muted">‘{deleting.title}{t("\u2019의 투표와 응답 기록이 삭제돼요.")}</p></Modal>}
  </div>;
}
function PollDetail({ poll, onClose, onEdit, onDelete, onConfirm, onStatus, busy }: {
    poll: Poll;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onConfirm: (range?: PollAvailabilityWindow) => void;
    onStatus: () => void;
    busy: boolean;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const votes = useMemo(() => app.votes.filter(v => v.pollId === poll.id), [app.votes, poll.id]);
    const ownVote = votes.find(v => v.memberId === app.user?.id);
    const [selected, setSelected] = useState<string[]>(ownVote?.slotIds.filter(id => poll.slotIds.includes(id)) ?? []);
    const [unavailable, setUnavailable] = useState(!!ownVote && ownVote.slotIds.length === 0);
    const [saving, setSaving] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const draftSignature = (ids: string[], unavailable: boolean) => JSON.stringify([[...new Set(ids)].sort(), unavailable]);
    const [savedDraft, setSavedDraft] = useState(() => draftSignature(selected, unavailable));
    const grid = useRef<HTMLDivElement>(null);
    const dragScroll = useRef<{ frame: number; x: number; y: number; last: number } | null>(null);
    const touchPress = useRef<{pointerId:number;owner:HTMLButtonElement;id:string;row:number;column:number;x:number;y:number;timer:ReturnType<typeof setTimeout>}|null>(null);
    const dragState = useRef<{
        pointerId: number;
        selecting: boolean;
        row: number;
        column: number;
        visited: Set<string>;
    } | null>(null);
    const dragOwner = useRef<HTMLButtonElement | null>(null);
    const suppressClick = useRef(false);
    useEffect(() => { const ids = ownVote?.slotIds.filter(id => poll.slotIds.includes(id)) ?? [], none = !!ownVote && ownVote.slotIds.length === 0; setSelected(ids); setUnavailable(none); setSavedDraft(draftSignature(ids, none)); }, [poll.id, ownVote?.updatedAt, poll.slotIds.join(',')]);
    const gridIndex = useMemo(() => buildPollGridIndex(poll.slots, votes), [poll.slots, votes]);
    const { dates, times, topCount } = gridIndex;
    const selectedIds = useMemo(() => new Set(selected), [selected]);
    const voterNames = useMemo(() => {
        const names = new Map(app.members.map(member => [member.id, member.name]));
        return new Map([...gridIndex.voters].map(([id, voters]) => [id, voters.map(vote => names.get(vote.memberId) ?? t('멤버')).join(', ') || t('선택한 사람이 없어요')]));
    }, [gridIndex, app.members, t]);
    const open = isOpen(poll);
    const interactive = open && app.canParticipate;
    const draft = useDraftClose(interactive && draftSignature(selected, unavailable) !== savedDraft, saving || busy, onClose);
    const confirm = (range?: PollAvailabilityWindow) => draft.guard(() => onConfirm(range));
    const manageable = canManage(poll, app.user?.id, app.isAdmin, app.canCreatePoll) && poll.status !== 'confirmed';
    const finishDrag = (cancel = false) => {
        if(dragScroll.current)cancelAnimationFrame(dragScroll.current.frame);
        dragScroll.current=null;
        if(touchPress.current)clearTimeout(touchPress.current.timer);
        touchPress.current=null;
        const state = dragState.current;
        const owner = dragOwner.current;
        dragState.current = null;
        dragOwner.current = null;
        if (cancel)
            suppressClick.current = false;
        if (state && owner?.hasPointerCapture(state.pointerId))
            owner.releasePointerCapture(state.pointerId);
    };
    useEffect(() => () => finishDrag(true), [poll.id,poll.slots]);
    useEffect(() => { if (!interactive || saving || busy || shareOpen)
        finishDrag(true); }, [interactive, saving, busy, shareOpen]);
    const toggleSlot = (id: string) => { setUnavailable(false); setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); };
    const toggleDay = (ids: string[]) => {
        finishDrag(true);
        setUnavailable(false);
        setSelected(current => {
            const chosen = new Set(current);
            if (ids.every(id => chosen.has(id))) {
                const day = new Set(ids);
                return current.filter(id => !day.has(id));
            }
            return [...new Set([...current, ...ids])];
        });
    };
    const activateDrag = (owner:HTMLButtonElement,pointerId:number,id:string,row:number,column:number,x:number,y:number) => {
        const selecting = !selected.includes(id);
        dragState.current = { pointerId, selecting, row, column, visited: new Set([id]) };
        dragOwner.current = owner;
        suppressClick.current = true;
        try { owner.setPointerCapture(pointerId); }
        catch { /* Synthetic pointer events have no active capture target. */ }
        setUnavailable(false);
        setSelected(current => selecting ? [...new Set([...current, id])] : current.filter(value => value !== id));
        trackDrag(x,y);
    };
    const beginDrag = (event: React.PointerEvent<HTMLButtonElement>, id: string, row: number, column: number) => {
        if (!interactive || saving || busy || (event.pointerType === 'mouse' && event.button !== 0))return;
        finishDrag(true);
        if(event.pointerType==='touch') {
            const press={pointerId:event.pointerId,owner:event.currentTarget,id,row,column,x:event.clientX,y:event.clientY,timer:setTimeout(()=>{
                if(touchPress.current!==press)return;
                touchPress.current=null;
                activateDrag(press.owner,press.pointerId,press.id,press.row,press.column,press.x,press.y);
            },350)};
            touchPress.current=press;
            return;
        }
        event.preventDefault();activateDrag(event.currentTarget,event.pointerId,id,row,column,event.clientX,event.clientY);
    };
    const paintAt = (x:number,y:number) => {
        const state=dragState.current;if(!state)return;
        const target=document.elementFromPoint(x,y)?.closest<HTMLButtonElement>('[data-slot-id]');
        if (!target || !grid.current?.contains(target))return;
        const targetRow=Number(target.dataset.slotRow),targetColumn=Number(target.dataset.slotColumn);
        const nextIds:string[]=[];
        for(let row=Math.min(state.row,targetRow);row<=Math.max(state.row,targetRow);row++){
            const [start,end]=times[row].split('|');
            for(let column=Math.min(state.column,targetColumn);column<=Math.max(state.column,targetColumn);column++){
                const id=gridIndex.slotAt.get(slotPosition(dates[column],start,end))?.id;
                if(id&&!state.visited.has(id)){state.visited.add(id);nextIds.push(id);}
            }
        }
        if(nextIds.length)setSelected(current=>state.selecting?[...new Set([...current,...nextIds])]:current.filter(id=>!nextIds.includes(id)));
    };
    const trackDrag = (x:number,y:number) => {
        if(!dragState.current)return;
        if(dragScroll.current){dragScroll.current.x=x;dragScroll.current.y=y;return;}
        const scroll={frame:0,x,y,last:0};dragScroll.current=scroll;
        const step=(time:number)=>{
            const element=grid.current;
            if(dragScroll.current!==scroll||!dragState.current||!element)return;
            const rect=element.getBoundingClientRect(),body=element.closest('.modal-body')?.getBoundingClientRect();
            const left=Math.max(rect.left,0),right=Math.min(rect.right,window.innerWidth);
            const top=Math.max(rect.top,body?.top??0,0),bottom=Math.min(rect.bottom,body?.bottom??window.innerHeight,window.innerHeight);
            if(right>left&&bottom>top){
                const speed=(point:number,min:number,max:number)=>point<min+32?-Math.min(1,(min+32-point)/32)*10:point>max-32?Math.min(1,(point-max+32)/32)*10:0;
                const elapsed=scroll.last?Math.min(32,time-scroll.last)/16.67:1;scroll.last=time;
                const beforeX=element.scrollLeft,beforeY=element.scrollTop;
                element.scrollLeft+=speed(scroll.x,left,right)*elapsed;
                element.scrollTop+=speed(scroll.y,top,bottom)*elapsed;
                if(element.scrollLeft!==beforeX||element.scrollTop!==beforeY){
                    const labelWidth=element.querySelector('tbody th')?.getBoundingClientRect().width??0;
                    const headerHeight=element.querySelector('thead')?.getBoundingClientRect().height??0;
                    // Hit-test a visible data cell, beyond the sticky time and date headers.
                    paintAt(Math.min(right-3,Math.max(left+labelWidth+3,scroll.x)),Math.min(bottom-3,Math.max(top+headerHeight+3,scroll.y)));
                }
            }
            scroll.frame=requestAnimationFrame(step);
        };
        scroll.frame=requestAnimationFrame(step);
    };
    const moveDrag = (event:React.PointerEvent<HTMLButtonElement>) => {
        const press=touchPress.current;
        if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>10)finishDrag(true);
        if(!dragState.current||dragState.current.pointerId!==event.pointerId||!interactive||saving||busy)return;
        event.preventDefault();paintAt(event.clientX,event.clientY);trackDrag(event.clientX,event.clientY);
    };
    useEffect(()=>{
        const element=grid.current;if(!element||!interactive||saving||busy||shareOpen)return;
        // A non-passive listener keeps native scrolling available until the hold activates.
        const move=(event:TouchEvent)=>{
            if(event.touches.length!==1){finishDrag(true);return;}
            const touch=event.touches[0],press=touchPress.current;
            if(press&&Math.hypot(touch.clientX-press.x,touch.clientY-press.y)>10)finishDrag(true);
            if(!dragState.current)return;
            if(event.cancelable)event.preventDefault();
            paintAt(touch.clientX,touch.clientY);trackDrag(touch.clientX,touch.clientY);
        };
        const start=(event:TouchEvent)=>{if(event.touches.length!==1)finishDrag(true);};
        const cancel=()=>finishDrag(true);
        element.addEventListener('touchstart',start,{passive:true});
        element.addEventListener('touchmove',move,{passive:false});
        element.addEventListener('touchcancel',cancel);
        return()=>{element.removeEventListener('touchstart',start);element.removeEventListener('touchmove',move);element.removeEventListener('touchcancel',cancel);};
    },[interactive,saving,busy,poll.id,poll.slots,shareOpen]);
    const participantIds = new Set(votes.map(v => v.memberId));
    const waiting = app.members.filter(m => m.status === 'active' && !participantIds.has(m.id));
    const save = async () => { setSaving(true); try {
        await app.saveVote(poll.id, selected);
        setSavedDraft(draftSignature(selected, unavailable));
        toast('가능한 시간을 저장했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } };
    if (shareOpen) return <InviteShare poll={poll} onClose={() => setShareOpen(false)}/>;
    return <><Modal title={poll.title} onClose={draft.close} busy={saving || busy} wide className="poll-detail-modal"
      headerActions={<><Button iconOnly variant="ghost" icon={Share2} aria-label={t("투표 공유")} title={t("투표 공유")} disabled={busy || saving} onClick={() => setShareOpen(true)}>{t("공유")}</Button>
        {manageable && <ActionMenu label={t('투표 메뉴')} disabled={busy || saving} actions={[
          {label:t('투표 수정'),icon:Pencil,onSelect:()=>draft.guard(onEdit)},
          {label:t(open ? '투표 마감' : '다시 열기'),icon:open ? LockKeyhole : RotateCcw,onSelect:()=>draft.guard(onStatus)},
          {label:t('투표 삭제'),icon:Trash2,onSelect:()=>draft.guard(onDelete),danger:true},
        ]}/>}</>}
      footer={<div className="poll-detail-footer"><div className="poll-detail-actions">
        {app.isAdmin && poll.status !== 'confirmed' && <Button iconOnly variant="secondary" icon={CalendarCheck} onClick={() => confirm()} disabled={busy || saving}>{t("일정 확정")}</Button>}
        {interactive ? <Button iconOnly icon={Save} loading={saving} disabled={(!selected.length && !unavailable) || busy} onClick={save}>{ownVote ? t("선택 수정하기") : t("선택 저장하기")}</Button> : <Button icon={X} iconOnly variant="secondary" onClick={draft.close}>{t("닫기")}</Button>}
      </div></div>}>
    <div className="poll-detail-meta"><Badge tone={poll.status === 'confirmed' ? 'green' : open ? 'blue' : 'gray'}>{poll.status === 'confirmed' ? t("일정 확정") : open ? t("투표 중") : t("마감")}</Badge><span><Clock3 size={14}/>{poll.deadline ? <>{formatDate(poll.deadline)} {t("{0} 마감", {"0":formatTime(poll.deadline)})}</> : t("마감 없음")}</span></div>
    {poll.description && <p className="poll-detail-description">{poll.description}</p>}
    {interactive && ownVote?.slotIds.some(id => !poll.slotIds.includes(id)) && <p className="poll-vote-changed">{t("후보 시간이 변경됐어요. 선택을 확인하고 다시 저장해 주세요.")}</p>}
    {poll.status === 'confirmed' && poll.eventId && <a className="poll-confirmed-link" href={`/calendar?event=${encodeURIComponent(poll.eventId)}`}><CalendarCheck size={20}/><span>{t("확정된 일정 확인하기")}</span><ChevronRight size={17}/></a>}
    <button className="poll-participant-toggle" onClick={() => setShowParticipants(!showParticipants)} aria-expanded={showParticipants}><Users size={16}/><span>{t("참여 현황")}<strong>{votes.length}{t("명")}</strong><span className="muted">{t(" · 미응답 {0}명", {"0":waiting.length})}</span></span><ChevronRight size={16} className={showParticipants ? 'rotated' : ''}/></button>
    {showParticipants && <div className="poll-participant-list">{votes.map(vote => { const member = app.members.find(m => m.id === vote.memberId); return <div className="poll-participant-row" key={vote.id}><Avatar member={member} name={member?.name ?? t("멤버")} size={30}/><strong>{member?.name ?? t("멤버")}</strong><span>{vote.slotIds.filter(id => poll.slotIds.includes(id)).length ? t("참여 완료") : vote.slotIds.length ? t("후보 변경 \u00B7 재응답 필요") : t("가능한 시간 없음")}</span></div>; })}{waiting.map(member => <div className="poll-participant-row" key={member.id}><Avatar member={member} size={30}/><strong>{member.name}</strong><span className="muted">{t("미응답")}</span></div>)}</div>}
    <AvailabilityResults poll={poll} votes={votes} onConfirm={confirm} disabled={busy || saving}/>
    <div className="section-head poll-grid-heading"><div><h3>{interactive ? t("시간 선택") : t("투표 결과")}</h3><p className="muted">{interactive ? <><span className="poll-pointer-hint">{t("드래그로 선택")}</span><span className="poll-touch-hint">{t("꾹 눌러 여러 칸 선택")}</span></> : t("{0}명이 응답했어요.", { "0": votes.length })}</p></div><div className="poll-grid-controls"><span className="poll-grid-legend"><i />{t("가능 인원")}</span></div></div>
    <div ref={grid} className="poll-time-scroll"><table className="poll-time-table"><thead className={interactive ? 'has-day-toggles' : undefined}><tr><th scope="col">{t("시간")}</th>{dates.map(date => {
            const ids = gridIndex.dayIds.get(date) ?? [];
            const all = ids.length > 0 && ids.every(id => selectedIds.has(id));
            return <th scope="col" key={date} className={getHoliday(date) || new Date(`${date}T12:00:00`).getDay() === 0 ? 'poll-table-holiday' : new Date(`${date}T12:00:00`).getDay() === 6 ? 'poll-table-saturday' : ''}><strong>{shortDate(date)}</strong><span>{formatDate(date, { weekday: 'short' })}{getHoliday(date) && ` · ${t(getHoliday(date) || "")}`}</span>
              {interactive && <button type="button" className={`poll-day-toggle ${all ? 'button-primary' : ''}`} data-date={date} disabled={saving || busy} aria-pressed={all} aria-label={t("{0} 종일", {"0":formatDate(date, {year:'numeric',month:'long',day:'numeric'})})} onClick={() => toggleDay(ids)}>{all && <Check size={12} aria-hidden="true"/>}{t("종일")}</button>}
            </th>;
        })}</tr></thead><tbody>{times.map((time, rowIndex) => {
            const [start, end] = time.split('|');
            return <tr key={time}><th scope="row"><strong>{start}</strong><span>{end}</span></th>{dates.map((date, columnIndex) => {
                    const slot = gridIndex.slotAt.get(slotPosition(date,start,end));
                    if (!slot)
                        return <td key={date}><div className="poll-slot-missing">—</div></td>;
                    const count = gridIndex.voters.get(slot.id)?.length ?? 0;
                    const chosen = selectedIds.has(slot.id);
                    return <td key={date}><button className={`poll-time-cell ${chosen ? 'is-selected' : ''} ${count > 0 && count === topCount ? 'is-best' : ''}`} style={{ '--slot-intensity': count ? Math.max(.05, count / Math.max(votes.length, 1) * .17) : 0 } as React.CSSProperties} disabled={!interactive || saving || busy} onContextMenu={event=>{if(interactive)event.preventDefault();}} data-slot-id={slot.id} data-slot-row={rowIndex} data-slot-column={columnIndex} onPointerDown={event => beginDrag(event, slot.id, rowIndex, columnIndex)} onPointerMove={moveDrag} onPointerUp={() => finishDrag()} onPointerCancel={() => finishDrag(true)} onLostPointerCapture={() => { if (dragState.current || touchPress.current)
                        finishDrag(true); }} onClick={event => { if (event.detail === 0) {
                        toggleSlot(slot.id);
                        return;
                    } if (suppressClick.current) {
                        suppressClick.current = false;
                        return;
                    } toggleSlot(slot.id); }} aria-pressed={chosen} aria-label={t("{0}, {1}명 가능{2}", { "0": slotLabel(slot), "1": count, "2": chosen ? t(", 선택됨") : '' })} title={voterNames.get(slot.id)}>{chosen && <Check className="poll-cell-selected" size={12} aria-hidden="true"/>}<strong>{count}</strong></button></td>;
                })}</tr>;
        })}</tbody></table></div>
    {interactive && <button className={`poll-unavailable ${unavailable ? 'active' : ''}`} aria-pressed={unavailable} onClick={() => { setUnavailable(!unavailable); setSelected([]); }} disabled={saving}><span className="poll-check-box">{unavailable && <Check size={13}/>}</span>{t("가능한 시간이 없어요")}</button>}

  </Modal>{draft.confirmation}</>;
}
function AvailabilityResults({ poll, votes, onConfirm, disabled }: {
    poll: Poll;
    votes: Vote[];
    onConfirm: (range?: PollAvailabilityWindow) => void;
    disabled: boolean;
}) {
    const { t } = useI18n();
    const app = useApp();
    const windows = useMemo(() => getPollAvailabilityWindows(poll, votes), [poll.id, poll.slots, votes]);
    const [expanded, setExpanded] = useState(false);
    useEffect(() => setExpanded(false), [poll.id]);
    const canConfirm = app.isAdmin && poll.status !== 'confirmed';
    return <section className="poll-availability" aria-label={t("가능한 시간대")}>
      <div className="poll-availability-heading"><h3><button type="button" className="poll-availability-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={`poll-results-${poll.id}`}><span><Clock3 size={16}/>{t("가능한 시간대")}</span><ChevronDown size={16} aria-hidden="true"/></button></h3></div>
      <div id={`poll-results-${poll.id}`} hidden={!expanded}>{expanded && (windows.length ? <div className="poll-availability-list is-expanded">
        {windows.map((window, index) => <article className={`poll-availability-row ${canConfirm ? 'can-confirm' : ''}`} key={JSON.stringify([window.date, window.start, window.end, window.memberIds])} data-date={window.date} data-start={window.start} data-end={window.end} data-duration={window.durationMinutes} data-member-count={window.memberIds.length}>
          <details className="poll-availability-members"><summary className="poll-availability-main">
            <span className={`poll-rank ${index === 0 ? 'first' : ''}`}>{index + 1}</span>
            <span className="poll-availability-time"><span className="poll-availability-date"><strong>{formatDate(window.date, {month:'long',day:'numeric',weekday:'short'})}</strong></span><strong className="poll-availability-range">{window.start}–{window.end}</strong></span>
            <span className="poll-availability-count"><Users size={14}/>{window.memberIds.length}<span className="sr-only">{t("명 가능")}</span></span><ChevronRight className="poll-availability-chevron" size={14}/>
          </summary><div>{window.memberIds.map(id => <span key={id}><Avatar member={app.members.find(member => member.id === id)} name={memberName(app.members, id)} size={25}/>{memberName(app.members, id)}</span>)}</div></details>
          {canConfirm && <Button iconOnly variant="ghost" icon={CalendarCheck} disabled={disabled} onClick={() => onConfirm(window)} aria-label={t("{0} {1}\u2013{2} 일정 확정", { "0": formatDate(window.date), "1": window.start, "2": window.end })}>{t("일정 확정")}</Button>}
        </article>)}
      </div> : <p className="poll-availability-empty">{votes.length ? t("가능한 시간이 없어요") : t("아직 응답한 멤버가 없어요.")}</p>)}</div>
    </section>;
}

type TimeRange = {
    id: string;
    start: string;
    end: string;
};
function PollEditor({ poll, onClose, onSaved }: {
    poll?: Poll;
    onClose: () => void;
    onSaved: (poll: Poll) => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [{ initialWindows, initialMonth, initialDates, firstTimes, initialOverrides }] = useState(() => {
        const initialWindows = pollTimeWindows(poll);
        const initialMonth = poll?.slots[0]?.date.slice(0, 7) ?? nextPollMonth();
        const initialDates = poll ? [...new Set(initialWindows.map(slot => slot.date))].sort() : hasHolidayData(Number(initialMonth.slice(0, 4))) ? monthlyPollDates(initialMonth, today()) : [];
        const firstTimes = (poll ? initialWindows.filter(slot => slot.date === initialDates[0]).map(slot => ({ id: slot.id, start: slot.start, end: slot.end })) : undefined) ?? [{ id: uid(), start: '08:00', end: '24:00' }];
        const signature = (times: TimeRange[]) => times.map(time => `${time.start}/${time.end}`).sort().join(',');
        const initialOverrides = poll ? initialDates.filter(date => signature(initialWindows.filter(slot => slot.date === date)) !== signature(firstTimes)) : [];
        return { initialWindows, initialMonth, initialDates, firstTimes, initialOverrides };
    });
    const [title, setTitle] = useState(poll?.title ?? monthlyPollTitle(initialMonth));
    const [description, setDescription] = useState(poll?.description ?? '');
    const [noDeadline, setNoDeadline] = useState(!poll || poll.deadline === null);
    const slotMinutes = 60 as const;
    const [deadline, setDeadline] = useState(localDateTime(poll?.deadline ?? new Date(Date.now() + 3 * 86400000).toISOString()));
    const [dates, setDates] = useState(initialDates);
    const [presetMonth, setPresetMonth] = useState(initialMonth);
    const [month, setMonth] = useState(() => new Date(`${initialMonth}-01T12:00:00`));
    const [commonTimes, setCommonTimes] = useState<TimeRange[]>(firstTimes);
    const [showOverrides, setShowOverrides] = useState(initialOverrides.length > 0);
    const [overrides, setOverrides] = useState<string[]>(initialOverrides);
    const [dateTimes, setDateTimes] = useState<Record<string, TimeRange[]>>(() => Object.fromEntries(initialDates.map(date => [date, initialWindows.filter(slot => slot.date === date).map(slot => ({ id: slot.id, start: slot.start, end: slot.end }))])));
    const [busy, setBusy] = useState(false);
    const presetAvailable = /^\d{4}-(0[1-9]|1[0-2])$/.test(presetMonth) && hasHolidayData(Number(presetMonth.slice(0, 4)));
    const clearDates = () => { setDates([]); setOverrides([]); setDateTimes({}); };
    const applyMonth = () => {
        try {
            const nextDates = monthlyPollDates(presetMonth, today());
            setDates(nextDates);
            setOverrides([]);
            setDateTimes({});
            setMonth(new Date(`${presetMonth}-01T12:00:00`));
            if (!poll && (!title.trim() || /^\d{4}년 \d{1,2}월 일정 취합$/.test(title)))
                setTitle(monthlyPollTitle(presetMonth));
            if (!nextDates.length)
                toast('오늘 이후의 주말·공휴일이 없어요.');
        }
        catch (error) {
            toast(errorMessage(error), 'error');
        }
    };
    const timesForDate = (date: string) => overrides.includes(date) ? dateTimes[date] ?? commonTimes : commonTimes;
    const currentDraft = JSON.stringify([title, description, noDeadline, noDeadline ? null : deadline,
        commonTimes.map(time => [time.start, time.end]), [...dates].sort().map(date => [date, timesForDate(date).map(time => [time.start, time.end])])]);
    const originalDraft = useRef(currentDraft);
    const draft = useDraftClose(originalDraft.current !== currentDraft, busy, onClose);
    const slotCount = dates.reduce((count, date) => count + timesForDate(date).reduce((sum, time) => sum + Math.max(0, Math.ceil((timeToMinutes(time.end) - timeToMinutes(time.start)) / slotMinutes) || 0), 0), 0);
    const updateTimes = (date: string | null, next: TimeRange[]) => { if (date)
        setDateTimes(current => ({ ...current, [date]: next }));
    else
        setCommonTimes(next); };
    const pickDate = (date: string) => {
        if (dates.includes(date))
            setDates(dates.filter(value => value !== date));
        else if (dates.length < 31)
            setDates([...dates, date].sort());
        else
            toast('날짜는 최대 31일까지 선택할 수 있어요.', 'error');
        const d = new Date(`${date}T12:00:00`);
        if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear())
            setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    };
    const renderTimes = (times: TimeRange[], date: string | null) => <div className="poll-time-editor">
    <div className="poll-shared-time-labels"><span>{t("시작")}</span><span>{t("종료")}</span><span /></div>
    {times.map((time, index) => {
            const endOptions = Array.from({ length: 24 }, (_, hour) => `${String(hour + 1).padStart(2, '0')}:00`);
            if (time.end && !endOptions.includes(time.end))
                endOptions.push(time.end);
            return <div className="poll-shared-time-row" key={time.id}>
        <TimeInput aria-label={t("{0} 시간 {1} 시작", { "0": date ? formatDate(date) : t("공통"), "1": index + 1 })} stepMinutes={60} value={time.start} onChange={start => updateTimes(date, times.map(value => value.id === time.id ? { ...value, start } : value))} required/>
        <span className="poll-time-dash">–</span>
        <select aria-label={t("{0} 시간 {1} 종료", { "0": date ? formatDate(date) : t("공통"), "1": index + 1 })} value={time.end} onChange={e => updateTimes(date, times.map(value => value.id === time.id ? { ...value, end: e.target.value } : value))} required>{endOptions.sort().map(end => <option key={end} value={end}>{end === '24:00' ? t("24:00 (자정)") : end}</option>)}</select>
        <IconButton label={t("{0} 시간 {1} 삭제", { "0": date ?? t("공통"), "1": index + 1 })} icon={X} type="button" disabled={times.length === 1} onClick={() => updateTimes(date, times.filter(value => value.id !== time.id))}/>
      </div>;
        })}
    <Button variant="ghost" size="sm" icon={Plus} type="button" disabled={times.length >= 8 || times.at(-1)?.end === '24:00'} onClick={() => { const start = times.at(-1)?.end ?? '08:00'; const end = `${String(Math.min(Number(start.slice(0, 2)) + 1, 24)).padStart(2, '0')}:00`; updateTimes(date, [...times, { id: uid(), start, end }]); }}>{t("시간대 추가")}</Button>
  </div>;
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!app.user || busy)
            return;
        if (!title.trim()) {
            toast('투표 제목을 입력해 주세요.', 'error');
            return;
        }
        if (!noDeadline && (!deadline || !Number.isFinite(new Date(deadline).getTime()) || new Date(deadline).getTime() <= Date.now())) {
            toast('마감 시간은 현재보다 뒤로 정해 주세요.', 'error');
            return;
        }
        if (!dates.length) {
            toast('캘린더에서 후보 날짜를 골라 주세요.', 'error');
            return;
        }
        if (dates.some(date => date < today())) {
            toast('후보 날짜는 오늘 이후로 정해 주세요.', 'error');
            return;
        }
        if (slotCount > 2000) {
            toast('후보 시간은 전체 2,000개까지 만들 수 있어요.', 'error');
            return;
        }
        const windows: PollSlot[] = dates.flatMap(date => timesForDate(date).map(time => { const original = initialWindows.find(window => window.date === date && window.start === time.start && window.end === time.end); return { id: original?.id ?? uid(), date, start: time.start, end: time.end }; }));
        let nextSlots: PollSlot[];
        try {
            nextSlots = expandTimeWindows(windows, slotMinutes, poll?.slots);
        }
        catch (error) {
            toast(errorMessage(error), 'error');
            return;
        }
        const now = new Date().toISOString();
        const next: Poll = { id: poll?.id ?? uid(), title: title.trim(), description: description.trim(), slots: nextSlots, slotIds: nextSlots.map(slot => slot.id), timeWindows: windows, slotMinutes, deadline: noDeadline ? null : new Date(deadline).toISOString(), status: 'open', creatorId: poll?.creatorId ?? app.user.id, createdAt: poll?.createdAt ?? now, updatedAt: poll?.updatedAt ?? now };
        setBusy(true);
        try {
            await app.savePoll(next, !!poll);
            toast(poll ? '투표를 수정했어요.' : '새 투표를 만들었어요.');
            onSaved(next);
        }
        catch (error) {
            toast(errorMessage(error), 'error');
        }
        finally {
            setBusy(false);
        }
    };
    return <><Modal title={poll ? t("투표 수정") : t("새 일정 투표")} onClose={draft.close} busy={busy} wide footer={<><Button icon={X} iconOnly variant="secondary" disabled={busy} onClick={draft.close}>{t("취소")}</Button><Button iconOnly type="submit" form="poll-editor" loading={busy} icon={Save}>{poll ? t("수정하고 열기") : t("투표 만들기")}</Button></>}><form id="poll-editor" className="stack poll-editor" onSubmit={submit}>
    <Field label={t("투표 제목")} required><input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("어떤 만남을 준비할까요?")} maxLength={80} required autoFocus/></Field>
    <Field label={t("내용")}><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t("멤버에게 전할 내용이 있나요?")} maxLength={2000} rows={2}/></Field>
    <div className="poll-editor-dates">
      <div className="section-head"><h3>{t("후보 날짜")}<span className="muted">{t("{0}일", {"0":dates.length})}</span></h3><Button variant="ghost" size="sm" type="button" onClick={clearDates} disabled={!dates.length}>{t("선택 초기화")}</Button></div>
      <div className="poll-month-preset"><label><span>{t("취합 월")}</span><input type="month" aria-label={t("취합 월")} value={presetMonth} onChange={event => setPresetMonth(event.target.value)}/></label><Button type="button" variant="secondary" size="sm" icon={CalendarCheck} onClick={applyMonth} disabled={!presetAvailable}>{t("주말\u00B7공휴일 자동 선택")}</Button></div>
      {!presetAvailable && <p className="poll-preset-notice">{presetMonth ? t("이 연도의 공휴일 정보가 아직 없어요. 날짜를 직접 골라 주세요.") : t("취합할 월을 골라 주세요.")}</p>}
      <div className="poll-date-picker"><MonthNavigation compact month={month} onChange={setMonth}/><ScrollingCalendar compact month={month} onMonthChange={setMonth} selectedDates={dates} onSelect={pickDate} minDate={today()}/></div>
      {dates.length > 0 && <div className="poll-date-chips">{dates.map(date => <button key={date} type="button" onClick={() => pickDate(date)} className={getHoliday(date) ? 'is-holiday' : ''}>{shortDate(date)} ({formatDate(date, { weekday: 'short' })})<X size={12}/></button>)}</div>}
    </div>
    <div className="poll-common-times"><div className="section-head"><h3>{t("공통 시간대")}</h3><Badge tone="blue">{t("선택한 날짜에 모두 적용")}</Badge></div>{renderTimes(commonTimes, null)}</div>
    <div className="poll-overrides"><button type="button" className="poll-overrides-toggle" aria-expanded={showOverrides} onClick={() => setShowOverrides(!showOverrides)}><Clock3 size={16}/><span>{t("날짜별로 다르게 설정")}</span>{overrides.filter(date => dates.includes(date)).length > 0 && <Badge tone="blue">{t("{0}일", {"0":overrides.filter(date => dates.includes(date)).length})}</Badge>}<ChevronRight size={16} className={showOverrides ? 'rotated' : ''}/></button>{showOverrides && <div className="poll-date-overrides">{!dates.length && <p className="muted">{t("먼저 후보 날짜를 골라 주세요.")}</p>}{dates.map(date => { const overridden = overrides.includes(date); return <div className="poll-date-override" key={date}><div className="section-head"><strong className={getHoliday(date) ? 'calendar-selected-holiday' : ''}>{formatDate(date)}{getHoliday(date) && <small> · {t(getHoliday(date) || "")}</small>}</strong><button type="button" className={`poll-override-switch ${overridden ? 'active' : ''}`} aria-pressed={overridden} onClick={() => { if (overridden)
        setOverrides(overrides.filter(value => value !== date));
    else {
        setOverrides([...overrides, date]);
        setDateTimes(current => ({ ...current, [date]: commonTimes.map(time => ({ ...time, id: uid() })) }));
    } }}>{overridden ? t("별도 설정 중") : t("공통 시간")}</button></div>{overridden ? renderTimes(dateTimes[date] ?? commonTimes, date) : <p className="poll-common-summary">{commonTimes.map(time => `${time.start}–${time.end}`).join(' · ')}</p>}</div>; })}</div>}</div>
    <div className="poll-deadline-editor"><div className="section-head"><h3>{t("투표 마감")}</h3><label className="poll-no-deadline"><input type="checkbox" checked={noDeadline} onChange={event => setNoDeadline(event.target.checked)}/>{t("마감 없음")}</label></div>{!noDeadline && <Field label={t("마감 일시")} required><div className="date-time-input"><input type="date" aria-label={t("마감 날짜")} value={deadline.split("T")[0]} onChange={e => setDeadline(`${e.target.value}T${deadline.split("T")[1] ?? ""}`)} required/><TimeInput aria-label={t("마감 시간")} value={deadline.split("T")[1] ?? ""} onChange={time => setDeadline(`${deadline.split("T")[0]}T${time}`)} required/></div></Field>}</div>
    {poll && <p className="poll-edit-note">{poll.slotMinutes === 30 ? t("기존 후보는 1시간 단위로 변경돼요. 시간을 확인해 주세요. ") : ''}{t("변경한 후보 시간은 새로 투표받아요. 삭제한 후보의 응답은 집계에서 제외돼요.")}</p>}
  </form></Modal>{draft.confirmation}</>;
}
function ConfirmPoll({ poll, range, onClose }: {
    poll: Poll;
    range?: PollAvailabilityWindow;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [, setParams] = useSearchParams();
    const ranked = useMemo(() => {
        const grid = buildPollGridIndex(poll.slots, app.votes.filter(vote => vote.pollId === poll.id));
        return poll.slots.map(slot => ({ slot, count: grid.voters.get(slot.id)?.length ?? 0 })).sort((a, b) => b.count - a.count || a.slot.date.localeCompare(b.slot.date) || a.slot.start.localeCompare(b.slot.start));
    }, [poll.slots, poll.id, app.votes]);
    const [initialRange] = useState(() => range ?? getPollAvailabilityWindows(poll, app.votes)[0]);
    const [slotId, setSlotId] = useState(initialRange?.startSlotId ?? ranked[0]?.slot.id ?? '');
    const ends = contiguousEndSlots(poll.slots, slotId);
    const startSlot = poll.slots.find(slot => slot.id === slotId);
    const defaultEnd = (startId: string) => { const options = contiguousEndSlots(poll.slots, startId); const start = poll.slots.find(slot => slot.id === startId); return options.filter(slot => start && timeToMinutes(slot.end) - timeToMinutes(start.start) <= 120).at(-1)?.id ?? options[0]?.id ?? ''; };
    const [endSlotId, setEndSlotId] = useState(() => initialRange?.endSlotId ?? defaultEnd(ranked[0]?.slot.id ?? ''));
    const chosenEnd = ends.find(slot => slot.id === endSlotId);
    const rangeSlots = ends.slice(0, ends.findIndex(slot => slot.id === endSlotId) + 1);
    const availableCount = app.votes.filter(vote => vote.pollId === poll.id && rangeSlots.length && rangeSlots.every(slot => vote.slotIds.includes(slot.id))).length;
    const [location, setLocation] = useState('');
    const [busy, setBusy] = useState(false);
    const currentDraft = JSON.stringify([slotId, endSlotId, location]);
    const originalDraft = useRef(currentDraft);
    const draft = useDraftClose(originalDraft.current !== currentDraft, busy, onClose);
    return <><Modal title={t("모임 일정 확정")} onClose={draft.close} busy={busy} footer={<><Button icon={X} iconOnly variant="secondary" disabled={busy} onClick={draft.close}>{t("취소")}</Button><Button type="submit" form="poll-confirm" icon={CalendarCheck} loading={busy}>{t("확정하기")}</Button></>}><form id="poll-confirm" className="stack" onSubmit={async (event) => { event.preventDefault(); if (!slotId || !location.trim() || busy)
        return; setBusy(true); try {
        const eventId = await app.confirmPoll(poll.id, slotId, location.trim(), endSlotId);
        toast('일정을 확정하고 캘린더에 추가했어요.');
        if (!app.isDemo && app.isAdmin && app.settings.smsEnabled && app.settings.smsAutoOnConfirm) {
            try {
                await notifyEventConfirmed(eventId);
            }
            catch {
                toast('일정은 확정됐어요. 문자 알림에서 발송 결과를 확인해 주세요.', 'error');
            }
        }
        setParams({});
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }}>
    <div className="poll-confirm-banner"><CalendarCheck size={24}/><div><strong>{poll.title}</strong><p>{t("확정한 일정은 캘린더에 추가돼요.")}</p></div></div>
    <Field label={t("시작 시간")} required><select aria-label={t("시작 시간")} value={slotId} onChange={event => { setSlotId(event.target.value); setEndSlotId(defaultEnd(event.target.value)); }} required>{ranked.map(({ slot, count }) => <option key={slot.id} value={slot.id}>{formatDate(slot.date)} {slot.start} · {count}{t("명 가능")}</option>)}</select></Field>
    <Field label={t("종료 시간")} required><select aria-label={t("종료 시간")} value={endSlotId} onChange={event => setEndSlotId(event.target.value)} required>{ends.map(slot => <option key={slot.id} value={slot.id}>{slot.end} · {startSlot ? timeToMinutes(slot.end) - timeToMinutes(startSlot.start) : 0}{t("분")}</option>)}</select></Field>
    {startSlot && chosenEnd && <p className="poll-confirm-range"><Clock3 size={15}/>{startSlot.start}–{chosenEnd.end}<span>{t("전체 시간 가능 {0}명", {"0":availableCount})}</span></p>}
    <PlacePicker value={location} onChange={setLocation} disabled={busy}/>
    <AddressField includePlaceName label={t("장소")} value={location} onChange={setLocation} maxLength={500} placeholder={t("어디서 만날까요?")} required disabled={busy} autoFocus/>
  </form></Modal>{draft.confirmation}</>;
}
