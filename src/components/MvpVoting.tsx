import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Check, Clock3, Trophy, Users, X } from 'lucide-react';
import { useApp } from '../lib/store';
import type { MoimEvent } from '../lib/types';
import { mvpWindow } from '../lib/mvp';
import { errorMessage, formatTime } from '../lib/utils';
import { Avatar, Badge, Button, IconButton, useToast } from './ui';
import './mvp.css';
function wasDismissed(key: string) { try {
    return Boolean(localStorage.getItem(key));
}
catch {
    return false;
} }
function useNow() { const [now, setNow] = useState(Date.now); useEffect(() => { const refresh = () => setNow(Date.now()); const timer = setInterval(refresh, 1000); document.addEventListener('visibilitychange', refresh); return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); }; }, []); return now; }
export function MvpVoting({ event }: {
    event: MoimEvent;
}) {
    const { t } = useI18n();
    const app = useApp(), toast = useToast(), now = useNow();
    const window = mvpWindow(event, now);
    const attending = new Set(app.rsvps.filter(item => item.eventId === event.id && item.status === 'going').map(item => item.memberId));
    const candidates = app.members.filter(member => member.status === 'active' && attending.has(member.id));
    const votes = app.mvpVotes.filter(vote => vote.eventId === event.id && attending.has(vote.memberId) && candidates.some(member => member.id === vote.candidateId));
    const own = votes.find(vote => vote.memberId === app.user?.id);
    const [selected, setSelected] = useState<string | null>(own?.candidateId ?? null), [busy, setBusy] = useState(false);
    useEffect(() => setSelected(own?.candidateId ?? null), [own?.candidateId, event.id]);
    const top = Math.max(0, ...candidates.map(member => votes.filter(vote => vote.candidateId === member.id).length));
    const eligible = app.canParticipate && !!app.user && attending.has(app.user.id);
    const save = async () => { if (!selected)
        return; setBusy(true); try {
        await app.saveMvpVote(event.id, selected);
        toast('MVP 투표를 저장했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(false);
    } };
    return <section className="mvp-section" aria-label={t("MVP 투표")}><div className="section-head"><h3><Trophy size={18}/>{t("MVP 투표")}</h3><Badge tone={window.isOpen ? 'blue' : window.isClosed ? 'gray' : 'orange'}>{window.isOpen ? t("투표 중") : window.isClosed ? t("마감") : t("예정")}</Badge></div>
    <p className="mvp-status">{!window.isOpen && !window.isClosed ? <><Clock3 size={14}/>{t("종료 10분 전 시작 \u00B7")}{formatTime(window.opens)}</> : <>{t("참석자 {0}명 · 응답 {1}명", {"0":candidates.length,"1":votes.length})}</>}</p>
    {candidates.length ? <div className="mvp-candidates">{candidates.map(member => { const count = votes.filter(vote => vote.candidateId === member.id).length; return <button type="button" key={member.id} className={`mvp-candidate ${selected === member.id ? 'is-selected' : ''}`} disabled={!window.isOpen || !eligible || busy} aria-pressed={selected === member.id} aria-label={t("{0} MVP 선택", { "0": member.name })} onClick={() => setSelected(member.id)}><Avatar member={member} size={34}/><strong>{member.name}</strong>{window.isClosed && top > 0 && count === top && <Trophy size={16} className="mvp-winner"/>}<span>{count}{t("표")}</span>{selected === member.id && <Check size={16}/>}</button>; })}</div> : <div className="mvp-empty"><Users size={20}/>{t("참석자가 없어요.")}</div>}
    {window.isOpen && eligible ? <div className="mvp-submit"><span>{t("모임 종료 후 24시간까지")}</span><Button size="sm" icon={Check} disabled={!selected || selected === own?.candidateId} loading={busy} onClick={() => void save()}>{own ? t("투표 변경") : t("투표하기")}</Button></div> : window.isOpen ? <p className="mvp-hint">{t("참석자로 등록한 멤버만 투표할 수 있어요.")}</p> : !window.isClosed ? <p className="mvp-hint">{t("\u2018참여해요\u2019로 등록한 명단이 자동으로 후보가 됩니다.")}</p> : null}
  </section>;
}
export function MvpNotifications() {
    const { t } = useI18n();
    const app = useApp(), now = useNow();
    const [dismissed, setDismissed] = useState<string[]>([]);
    const event = app.events.find(item => { if (!app.canParticipate || !app.user || !mvpWindow(item, now).isOpen)
        return false; const key = `moim-mvp-alert:${app.user.id}:${item.id}:${item.date}:${item.end}`; return !dismissed.includes(key) && !wasDismissed(key) && app.rsvps.some(r => r.eventId === item.id && r.memberId === app.user!.id && r.status === 'going') && !app.mvpVotes.some(v => v.eventId === item.id && v.memberId === app.user!.id); });
    if (!event)
        return null;
    const key = `moim-mvp-alert:${app.user!.id}:${event.id}:${event.date}:${event.end}`;
    const dismiss = () => { try {
        localStorage.setItem(key, 'dismissed');
    }
    catch { /* dismiss stays effective for this session */ } setDismissed(values => [...values, key]); };
    return <div className="mvp-alert" role="status"><span className="mvp-alert-icon"><BellRing size={21}/></span><div><strong>{t("MVP 투표 시작")}</strong><span>{event.title}</span></div><Link to={`/calendar?event=${encodeURIComponent(event.id)}`}><Button size="sm" onClick={dismiss}>{t("투표하기")}</Button></Link><IconButton label={t("MVP 알림 닫기")} icon={X} onClick={dismiss}/></div>;
}
