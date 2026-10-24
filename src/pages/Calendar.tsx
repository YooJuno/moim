import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Cake, Check, ChevronRight, Clock3, Download, MapPin, Pencil, Plus, Share2, MessageSquare, Trash2, Users, X } from 'lucide-react';
import { useApp } from '../lib/store';
import type { MoimEvent } from '../lib/types';
import { errorMessage, formatDate, localDate, memberName, today, uid } from '../lib/utils';
import { birthdaysInMonth, birthdaysOnDate } from '../lib/birthdays';
import { getHoliday } from '../lib/holidays';
import { Avatar, Badge, Button, EmptyState, Field, IconButton, Modal, PageHeader, useToast } from '../components/ui';
import { InviteShare } from '../components/InviteShare';
import { PlacePicker } from '../components/PlacePicker';
import { AddressField } from '../components/AddressField';
import { TimeInput } from '../components/TimeInput';
import { MapLinks } from '../components/MapLinks';
import { GoogleCalendarInvite } from '../components/GoogleCalendarInvite';
import { KakaoCalendarButton } from '../components/KakaoCalendar';
import { EventSms } from '../components/EventSms';
import { VenueBallot } from '../components/VenueBallot';
import { MvpVoting } from '../components/MvpVoting';
import { calendarSignature } from '../lib/google-calendar';
import { MonthGrid, MonthNavigation } from './ScheduleGrid';
import './schedule.css';
export function Calendar() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [params, setParams] = useSearchParams();
    const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    const [selectedDate, setSelectedDate] = useState<string | null>(params.get('date'));
    const [editing, setEditing] = useState<MoimEvent | 'new' | null>(null);
    const [deleting, setDeleting] = useState<MoimEvent | null>(null);
    const [busy, setBusy] = useState(false);
    const selected = app.events.find(event => event.id === params.get('event'));
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const monthEvents = app.events.filter(event => event.date.startsWith(monthKey)).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const birthdayPeople = selectedDate ? birthdaysOnDate(app.members, selectedDate).map(member => ({ member, date: selectedDate })) : birthdaysInMonth(app.members, monthKey);
    const visibleEvents = selectedDate ? app.events.filter(event => event.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start)) : monthEvents;
    const closeDetail = () => { const next = new URLSearchParams(params); next.delete('event'); setParams(next, { replace: true }); };
    const openDetail = (event: MoimEvent) => { const next = new URLSearchParams(params); next.set('event', event.id); next.delete('date'); setParams(next); };
    useEffect(() => { if (selected) {
        const date = new Date(`${selected.date}T12:00:00`);
        setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
        setSelectedDate(selected.date);
    } }, [selected?.id]);
    useEffect(() => { const dateParam = params.get('date'); if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && !Number.isNaN(new Date(`${dateParam}T12:00:00`).getTime())) {
        const d = new Date(`${dateParam}T12:00:00`);
        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        setSelectedDate(dateParam);
    } }, [params]);
    useEffect(() => { if (params.get('create') === '1' && app.isAdmin) {
        setEditing('new');
        const next = new URLSearchParams(params);
        next.delete('create');
        setParams(next, { replace: true });
    } }, [params, setParams, app.isAdmin]);
    const pickDate = (date: string) => { setSelectedDate(current => current === date ? null : date); if (!date.startsWith(monthKey)) {
        const d = new Date(`${date}T12:00:00`);
        setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    } };
    const changeMonth = (value: Date) => { setMonth(value); setSelectedDate(null); const next = new URLSearchParams(params); next.delete('date'); setParams(next, { replace: true }); };
    return <div className="page calendar-page">
    <PageHeader title={t("모임 일정")} action={app.isAdmin ? <Button icon={Plus} onClick={() => setEditing('new')}>{t("일정 만들기")}</Button> : undefined}/>
    <div className="calendar-layout">
      <section className="card calendar-main" aria-label={t("모임 캘린더")}><div className="calendar-toolbar"><MonthNavigation month={month} onChange={changeMonth}/><Button variant="secondary" size="sm" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); setSelectedDate(today()); }}>{t("오늘")}</Button></div><MonthGrid month={month} selectedDates={selectedDate ? [selectedDate] : []} onSelect={pickDate} events={app.events} birthdayMembers={app.members}/><div className="calendar-legend"><span><i />{t("모임 일정")}</span><span className="calendar-holiday-legend">{t("공휴일")}</span><span>{t("날짜를 누르면 일정을 볼 수 있어요.")}</span></div></section>
      <aside className="calendar-agenda"><div className="section-head"><h2>{selectedDate ? formatDate(selectedDate) : t("{0}의 일정", { "0": formatDate(localDate(month), {month:"long"}) })}<span className="calendar-agenda-count">{visibleEvents.length}</span></h2>{selectedDate && <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>{t("전체 보기")}</Button>}</div>{selectedDate && getHoliday(selectedDate) && <p className="calendar-selected-holiday">{t(getHoliday(selectedDate) || "")}</p>}
        {birthdayPeople.length > 0 && <section className="card calendar-birthdays" aria-label={t("생일 일정")}><h3><Cake size={17}/>{selectedDate ? t("생일") : t("{0} 생일", { "0": formatDate(localDate(month), {month:"long"}) })}</h3>{birthdayPeople.map(({ member, date }) => <button key={member.id} className="calendar-birthday-row" onClick={() => { setSelectedDate(date); const next = new URLSearchParams(params); next.set('date', date); next.delete('event'); setParams(next); }}><Avatar member={member} size={31}/><strong>{member.name}</strong><span>{formatDate(date, { month: 'long', day: 'numeric' })}</span></button>)}</section>}
        {visibleEvents.length ? <div className="calendar-agenda-list">{visibleEvents.map(event => { const going = app.rsvps.filter(rsvp => rsvp.eventId === event.id && rsvp.status === 'going'); const ownRsvp = app.rsvps.find(rsvp => rsvp.eventId === event.id && rsvp.memberId === app.user?.id); const past = `${event.date}T${event.end}` < `${today()}T${new Date().toTimeString().slice(0, 5)}`; return <button className="card event-agenda-card" key={event.id} onClick={() => openDetail(event)}><div className="event-agenda-date"><span>{formatDate(event.date, {month:"short"})}</span><strong>{new Date(`${event.date}T12:00:00`).getDate()}</strong><small>{formatDate(event.date, { weekday: 'short' })}</small></div><div className="event-agenda-info"><div className="event-agenda-tags">{past ? <Badge tone="gray">{t("지난 모임")}</Badge> : ownRsvp?.status === 'going' ? <Badge tone="green">{t("참여 예정")}</Badge> : event.pollId ? <Badge tone="blue">{t("투표로 확정")}</Badge> : <Badge tone="gray">{t("모임 일정")}</Badge>}</div><h3>{event.title}</h3><p><Clock3 size={13}/>{event.start}–{event.end}</p><p><MapPin size={13}/>{event.location || t("장소 추후 안내")}</p><div className="event-agenda-attendees"><Users size={13}/><span>{going.length}{t("명 참여")}</span><ChevronRight size={15}/></div></div></button>; })}</div> : <div className="card calendar-agenda-empty"><EmptyState icon={CalendarDays} title={selectedDate ? t("등록된 일정이 없어요") : t("이번 달 일정이 없어요")} action={app.isAdmin ? <Button variant="secondary" size="sm" icon={Plus} onClick={() => setEditing('new')}>{t("일정 추가")}</Button> : undefined}/></div>}

      </aside>
    </div>
    {selected && !editing && !deleting && <EventDetail event={selected} onClose={closeDetail} onEdit={() => { closeDetail(); setEditing(selected); }} onDelete={() => { closeDetail(); setDeleting(selected); }}/>}
    {editing && <EventEditor event={editing === 'new' ? undefined : editing} initialDate={selectedDate ?? today()} onClose={() => setEditing(null)} onSaved={event => { setEditing(null); openDetail(event); }}/>}
    {deleting && <Modal title={t("일정을 삭제할까요?")} onClose={() => !busy && setDeleting(null)} footer={<><Button variant="secondary" disabled={busy} onClick={() => setDeleting(null)}>{t("취소")}</Button><Button variant="danger" loading={busy} onClick={async () => { setBusy(true); try {
        await app.deleteEvent(deleting.id);
        setDeleting(null);
        toast('일정을 삭제했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }}>{t("삭제하기")}</Button></>}><p className="muted">‘{deleting.title}{t("\u2019의 일정과 참여 응답이 삭제돼요.")}{deleting.pollId && <><br />{t("연결된 투표는 마감 상태로 돌아가고, 응답 기록은 보관돼요.")}</>}{deleting.calendarLink && <><br />{t("Google 캘린더의 일정은 별도로 삭제해 주세요.")}</>}</p></Modal>}
  </div>;
}
function EventDetail({ event, onClose, onEdit, onDelete }: {
    event: MoimEvent;
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [busy, setBusy] = useState<'going' | 'notGoing' | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [shareOpen, setShareOpen] = useState(false);
    const [smsOpen, setSmsOpen] = useState(false);
    const rsvps = app.rsvps.filter(rsvp => rsvp.eventId === event.id);
    const own = rsvps.find(rsvp => rsvp.memberId === app.user?.id);
    const going = rsvps.filter(rsvp => rsvp.status === 'going');
    const notGoing = rsvps.filter(rsvp => rsvp.status === 'notGoing');
    const save = async (status: 'going' | 'notGoing') => { setBusy(status); try {
        await app.saveRsvp(event.id, status);
        toast(status === 'going' ? '참여 의사를 전달했어요.' : '불참 의사를 전달했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(null);
    } };
    if (smsOpen)
        return <EventSms event={event} onClose={() => setSmsOpen(false)}/>;
    if (shareOpen)
        return <InviteShare event={event} onClose={() => setShareOpen(false)}/>;
    if (calendarOpen)
        return <GoogleCalendarInvite event={event} onClose={() => setCalendarOpen(false)}/>;
    return <Modal title={event.title} onClose={onClose} footer={<div className="event-detail-footer"><div>{app.isAdmin && <><IconButton label={t("일정 수정")} icon={Pencil} onClick={onEdit}/><IconButton label={t("일정 삭제")} icon={Trash2} onClick={onDelete}/><IconButton label={t("문자 알림")} icon={MessageSquare} onClick={() => setSmsOpen(true)}/></>}<IconButton label={t("일정 공유")} icon={Share2} onClick={() => setShareOpen(true)}/><IconButton label={t("캘린더 파일 저장")} icon={Download} onClick={() => downloadEvent(event)}/></div><Button variant="secondary" onClick={onClose}>{t("닫기")}</Button></div>}>
    <div className="event-detail-date"><div className="event-date-icon"><CalendarDays size={24}/></div><div><strong>{formatDate(event.date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</strong><p>{event.start}–{event.end}{getHoliday(event.date) && <span className="event-holiday">{t(getHoliday(event.date) || "")}</span>}</p></div>{event.pollId && <Badge tone="blue">{t("투표로 확정")}</Badge>}</div>
    <div className="event-location"><MapPin size={19}/><span>{event.location || t("장소 추후 안내")}</span></div>{event.location && <MapLinks location={event.location}/>}
    {event.description && <p className="event-description">{event.description}</p>}
    <div className="event-rsvp"><h3>{t("참석 여부")}</h3><div className="event-rsvp-buttons"><Button variant={own?.status === 'going' ? 'primary' : 'secondary'} icon={Check} loading={busy === 'going'} disabled={!app.canParticipate || (busy !== null && busy !== 'going')} onClick={() => save('going')}>{t("참여해요")}</Button><Button variant={own?.status === 'notGoing' ? 'primary' : 'secondary'} icon={X} loading={busy === 'notGoing'} disabled={!app.canParticipate || (busy !== null && busy !== 'notGoing')} onClick={() => save('notGoing')}>{t("어려워요")}</Button></div>{own && <p className="muted">{own.status === 'going' ? t("참여 예정으로 등록했어요.") : t("불참으로 등록했어요.")}{" "}{t("언제든 바꿀 수 있어요.")}</p>}</div>
    {app.isAdmin && <div className="event-google-calendar"><Button variant="secondary" icon={CalendarPlus} onClick={() => setCalendarOpen(true)}>{t("Google 캘린더")}</Button>{event.calendarLink && <span className={event.calendarLink.signature !== calendarSignature(event, event.calendarLink.attendeeIds) ? 'needs-update' : ''}>{event.calendarLink.signature !== calendarSignature(event, event.calendarLink.attendeeIds) ? t("변경사항 있음") : t("연결됨")}</span>}</div>}
    <KakaoCalendarButton event={event}/>
    <div className="event-people"><h3>{t("참여 예정")}<span>{going.length}{t("명")}</span></h3>{going.length ? <div className="event-people-list">{going.map(rsvp => <div key={rsvp.id}><Avatar member={app.members.find(m => m.id === rsvp.memberId)} name={memberName(app.members, rsvp.memberId)} size={34}/><span>{memberName(app.members, rsvp.memberId)}</span></div>)}</div> : <p className="muted">{t("첫 참여자가 되어 주세요.")}</p>}{notGoing.length > 0 && <details className="event-declined"><summary>{t("불참 {0}명", {"0":notGoing.length})}</summary><p>{notGoing.map(rsvp => memberName(app.members, rsvp.memberId)).join(', ')}</p></details>}</div>
    <VenueBallot event={event}/>
    <MvpVoting event={event}/>
  </Modal>;
}
function EventEditor({ event, initialDate, onClose, onSaved }: {
    event?: MoimEvent;
    initialDate: string;
    onClose: () => void;
    onSaved: (event: MoimEvent) => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [title, setTitle] = useState(event?.title ?? '');
    const [date, setDate] = useState(event?.date ?? initialDate);
    const [start, setStart] = useState(event?.start ?? '18:00');
    const [end, setEnd] = useState(event?.end ?? '21:00');
    const [location, setLocation] = useState(event?.location ?? '');
    const [description, setDescription] = useState(event?.description ?? '');
    const [busy, setBusy] = useState(false);
    const [month, setMonth] = useState(() => { const d = new Date(`${date}T12:00:00`); return new Date(d.getFullYear(), d.getMonth(), 1); });
    return <Modal title={event ? t("일정 수정") : t("새 모임 일정")} onClose={() => !busy && onClose()} wide footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{t("취소")}</Button><Button type="submit" form="event-editor" icon={Check} loading={busy}>{event ? t("수정하기") : t("일정 만들기")}</Button></>}><form id="event-editor" className="stack" onSubmit={async (e) => { e.preventDefault(); if (!app.user || busy)
        return; if (!title.trim() || !date || !start || !end || start >= end) {
        toast('제목과 날짜, 시작·종료 시간을 확인해 주세요.', 'error');
        return;
    } setBusy(true); const next: MoimEvent = { id: event?.id ?? uid(), title: title.trim(), description: description.trim(), date, start, end, location: location.trim(), creatorId: event?.creatorId ?? app.user.id, createdAt: event?.createdAt ?? new Date().toISOString(), ...(event?.pollId ? { pollId: event.pollId } : {}), ...(event?.calendarLink ? { calendarLink: event.calendarLink } : {}) }; try {
        await app.saveEvent(next);
        toast(event ? '일정을 수정했어요.' : '새 일정을 만들었어요.');
        onSaved(next);
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } }}>
    <Field label={t("일정 제목")} required><input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder={t("어떤 만남인가요?")} required autoFocus/></Field>
    <div className="event-editor-date"><h3>{t("날짜")}<span className="muted">{formatDate(date)}</span></h3><div className="poll-date-picker"><MonthNavigation compact month={month} onChange={setMonth}/><MonthGrid compact month={month} selectedDates={[date]} onSelect={value => { setDate(value); const d = new Date(`${value}T12:00:00`); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}/></div></div>
    <div className="form-grid"><Field label={t("시작 시간")} required><TimeInput value={start} onChange={setStart} required/></Field><div className="event-end-field"><Field label={t("종료 시간")} required><TimeInput value={end} disabled={end === '24:00'} onChange={setEnd} allowMidnight required/></Field><label className="event-midnight"><input type="checkbox" checked={end === '24:00'} onChange={e => setEnd(e.target.checked ? '24:00' : '')}/>{t("자정 (24:00)")}</label></div></div>
    <PlacePicker value={location} onChange={setLocation} disabled={busy}/>
    <AddressField includePlaceName label={t("장소")} value={location} onChange={setLocation} maxLength={500} placeholder={t("장소 이름 또는 주소")} required disabled={busy}/>
    <Field label={t("상세 내용")}><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={4000} rows={3} placeholder={t("준비물, 안내사항 등")}/></Field>
  </form></Modal>;
}
function downloadEvent(event: MoimEvent) {
    const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const utc = (date: string, time: string) => new Date(`${date}T${time}:00+09:00`).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MOIM//Meeting//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', `UID:${event.id}@moim.local`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, `DTSTART:${utc(event.date, event.start)}`, `DTEND:${utc(event.date, event.end)}`, `SUMMARY:${escape(event.title)}`, `LOCATION:${escape(event.location)}`, `DESCRIPTION:${escape(event.description)}`, 'END:VEVENT', 'END:VCALENDAR'];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${event.title.replace(/[<>:"/\\|?*]/g, '') || '모임'}.ics`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
