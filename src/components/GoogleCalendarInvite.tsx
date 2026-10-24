import { useI18n } from "../lib/preferences";
import { useState } from 'react';
import { CalendarCheck, CalendarPlus, Check, Clock3, ExternalLink, Link2, MapPin, Send, Users } from 'lucide-react';
import { useApp } from '../lib/store';
import type { CalendarLink, MoimEvent } from '../lib/types';
import { calendarSignature, connectGoogleCalendar, hasGoogleCalendarAccess, syncGoogleCalendarEvent } from '../lib/google-calendar';
import { errorMessage, formatDate, memberName } from '../lib/utils';
import { Avatar, Badge, Button, Modal, useToast } from './ui';
function safeCalendarUrl(value: string | undefined): string | undefined {
    if (!value)
        return undefined;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === 'calendar.google.com' && !url.username && !url.password ? url.href : undefined;
    }
    catch {
        return undefined;
    }
}
export function GoogleCalendarInvite({ event, onClose }: {
    event: MoimEvent;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const eligible = app.members.filter(member => member.status === 'active' && member.id !== app.user?.id && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email));
    const goingIds = app.rsvps.filter(rsvp => rsvp.eventId === event.id && rsvp.status === 'going').map(rsvp => rsvp.memberId);
    const [selected, setSelected] = useState<string[]>(() => {
        const defaults = event.calendarLink?.attendeeIds ?? goingIds;
        return eligible.filter(member => defaults.includes(member.id)).map(member => member.id);
    });
    const [connected, setConnected] = useState(() => hasGoogleCalendarAccess());
    const [busy, setBusy] = useState<'connect' | 'sync' | null>(null);
    const [pendingLink, setPendingLink] = useState<CalendarLink | null>(null);
    const [saveError, setSaveError] = useState(false);
    const link = event.calendarLink;
    const foreignOwner = !!link && link.ownerId !== app.user?.id;
    const signature = calendarSignature(event, selected);
    const changed = !link || signature !== link.signature;
    const htmlLink = safeCalendarUrl(link?.htmlLink);
    const recipients = eligible.filter(member => selected.includes(member.id));
    const disabled = app.isDemo || foreignOwner || busy !== null || !connected || (!changed && !!link && !pendingLink);
    const submitLabel = pendingLink ? '연결 정보 저장' : recipients.length ? link ? '변경하고 초대 보내기' : '추가하고 초대 보내기' : '내 캘린더에 추가';
    const connect = async () => {
        if (app.isDemo || foreignOwner || busy)
            return;
        setBusy('connect');
        try {
            await connectGoogleCalendar();
            setConnected(hasGoogleCalendarAccess());
            toast('Google 캘린더를 연결했어요.');
        }
        catch (error) {
            toast(errorMessage(error), 'error');
        }
        finally {
            setBusy(null);
        }
    };
    const sync = async () => {
        if (disabled || !app.isAdmin)
            return;
        setBusy('sync');
        setSaveError(false);
        let nextLink = pendingLink;
        try {
            if (!nextLink) {
                nextLink = await syncGoogleCalendarEvent(event, recipients.map(member => ({ id: member.id, email: member.email, name: member.name })));
                setPendingLink(nextLink);
            }
            if (!nextLink)
                throw new Error('캘린더 연결 정보를 받지 못했어요.');
            await app.saveCalendarLink(event.id, nextLink);
            toast(recipients.length ? 'Google 캘린더에 반영하고 초대를 보냈어요.' : 'Google 캘린더에 반영했어요.');
            onClose();
        }
        catch (error) {
            if (nextLink) {
                setSaveError(true);
                toast('캘린더에는 반영됐지만 연결 정보를 저장하지 못했어요. 다시 저장해 주세요.', 'error');
            }
            else {
                setConnected(hasGoogleCalendarAccess());
                toast(errorMessage(error), 'error');
            }
        }
        finally {
            setBusy(null);
        }
    };
    if (!app.isAdmin)
        return null;
    return <Modal title={t("Google 캘린더")} onClose={() => !busy && onClose()} footer={<><Button variant="secondary" disabled={busy !== null} onClick={onClose}>{t("닫기")}</Button><Button icon={recipients.length ? Send : CalendarPlus} loading={busy === 'sync'} disabled={disabled} onClick={sync}>{t(submitLabel)}</Button></>}>
    <div className="google-calendar-event"><div className="google-calendar-symbol"><CalendarPlus size={23}/></div><div><strong>{event.title}</strong><p><Clock3 size={13}/>{formatDate(event.date)} · {event.start}–{event.end}</p>{event.location && <p><MapPin size={13}/>{event.location}</p>}</div></div>
    {link && <div className="google-calendar-last-sync"><span><CalendarCheck size={14}/>{t("마지막 반영 {0}", {"0":formatDate(link.syncedAt, {month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false})})}</span>{changed ? <Badge tone="orange">{t("변경사항 있음")}</Badge> : <Badge tone="green">{t("최신 상태")}</Badge>}{htmlLink && <a href={htmlLink} target="_blank" rel="noopener noreferrer" aria-label={t("Google 캘린더에서 일정 열기")}><ExternalLink size={15}/></a>}</div>}
    {foreignOwner ? <div className="google-calendar-owner"><Link2 size={17}/><p>{t("{0} 님의 Google 캘린더에 연결된 일정이에요. 연결한 관리자가 변경할 수 있어요.", {"0":memberName(app.members, link!.ownerId)})}</p></div> : <div className="google-calendar-connection"><div><span className={`google-calendar-connection-dot ${connected ? 'connected' : ''}`}/><strong>{connected ? t("Google 캘린더 연결됨") : t("Google 계정 연결")}</strong></div><Button variant="secondary" size="sm" icon={connected ? Check : Link2} disabled={app.isDemo || busy !== null} loading={busy === 'connect'} onClick={connect}>{connected ? t("다시 연결") : t("Google 캘린더 연결")}</Button></div>}
    {app.isDemo && <p className="google-calendar-demo">{t("데모에서는 초대를 보내지 않아요.")}</p>}
    {saveError && <p className="google-calendar-save-error" role="alert">{t("캘린더 반영은 완료했어요. 연결 정보를 다시 저장해 주세요.")}</p>}
    <div className="google-calendar-recipients-head"><h3><Users size={16}/>{t("초대할 멤버")}<span>{recipients.length}{t("명")}</span></h3><div><button type="button" disabled={foreignOwner || busy !== null || !!pendingLink || selected.length === eligible.length} onClick={() => setSelected(eligible.map(member => member.id))}>{t("모두 선택")}</button><button type="button" disabled={foreignOwner || busy !== null || !!pendingLink || !selected.length} onClick={() => setSelected([])}>{t("선택 해제")}</button></div></div>
    <div className="google-calendar-members">{eligible.length ? eligible.map(member => {
            const rsvp = app.rsvps.find(item => item.eventId === event.id && item.memberId === member.id);
            return <label className="google-calendar-member" key={member.id}><input type="checkbox" aria-label={t("{0} 초대", { "0": member.name })} checked={selected.includes(member.id)} disabled={foreignOwner || busy !== null || !!pendingLink} onChange={() => setSelected(current => current.includes(member.id) ? current.filter(id => id !== member.id) : [...current, member.id])}/><Avatar member={member} size={33}/><span className="google-calendar-member-info"><strong>{member.name}</strong><span>{member.email}</span></span>{rsvp?.status === 'going' ? <Badge tone="green">{t("참여 예정")}</Badge> : rsvp?.status === 'notGoing' ? <Badge tone="gray">{t("불참")}</Badge> : null}</label>;
        }) : <p className="google-calendar-empty">{t("초대할 멤버가 없어요.")}</p>}</div>
    <p className="google-calendar-notice">{link ? t("선택한 명단으로 참석자를 갱신해요.") : t("선택한 이메일로 초대가 전송돼요.")}</p>
  </Modal>;
}
