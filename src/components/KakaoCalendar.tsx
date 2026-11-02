import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus, Check, LoaderCircle, X } from 'lucide-react';
import { useApp } from '../lib/store';
import type { MoimEvent } from '../lib/types';
import { setKakaoCalendarAutomatic, getAccountProviders, startSocialAuth, useAuthProviderConfig } from '../lib/social-auth';
import { errorMessage, formatDate } from '../lib/utils';
import { Button, Modal, useToast } from './ui';
import { CalendarConnectionButton } from './CalendarConnectionButton';
export function KakaoCalendarButton({ event }: {
    event: MoimEvent;
}) {
    const app = useApp();
    const config = useAuthProviderConfig();
    const [open, setOpen] = useState(false);
    const [params, setParams] = useSearchParams();
    const [access, setAccess] = useState<{uid:string;available:boolean;automatic:boolean}|null>(null);
    const [revision, setRevision] = useState(0);
    const attending = app.rsvps.some(rsvp => rsvp.eventId === event.id && rsvp.memberId === app.user?.id && rsvp.status === 'going');
    useEffect(() => {
        if (app.isDemo || !app.user || !app.canParticipate || !config.enabled || !config.calendar.kakao || !attending) { setAccess(null); return; }
        const uid = app.user.id; let active = true;
        void getAccountProviders().then(result => { if (active) setAccess({uid,available:result.calendar.available !== false,automatic:result.calendar.kakao && result.calendar.automatic === true}); }).catch(problem => { if (active) { setAccess(null); errorMessage(problem); } });
        return () => { active = false; };
    }, [app.isDemo,app.user?.id,app.canParticipate,config.enabled,config.calendar.kakao,attending,revision]);
    const available = !app.isDemo && app.canParticipate && config.enabled && config.calendar.kakao && attending && access?.uid === app.user?.id && access?.available;
    useEffect(() => {
        if (!available || params.get('event') !== event.id || params.get('kakao') !== '1') return;
        setOpen(true); const next = new URLSearchParams(params); next.delete('kakao'); setParams(next,{replace:true});
    }, [available,params,event.id,setParams]);
    if (!available) return null;
    return <><CalendarConnectionButton provider="kakao" state={access?.automatic ? 'connected' : undefined} onClick={() => setOpen(true)}/>{open && <KakaoCalendarDialog event={event} onClose={() => {setOpen(false);setRevision(value => value + 1);}}/>}</>;
}
function KakaoCalendarDialog({ event, onClose }: {
    event: MoimEvent;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const toast = useToast();
    const [ready, setReady] = useState<{consented:boolean;automatic:boolean}|null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setReady(null);
        setError('');
        void getAccountProviders().then(result => { if (active)
            setReady({consented:result.calendar.kakao,automatic:result.calendar.automatic===true}); }).catch(problem => { if (active)
            setError(errorMessage(problem)); });
        return () => { active = false; };
    }, [revision]);
    async function save() {
        if (busy || ready === null)
            return;
        setBusy(true);
        setError('');
        try {
            if (!ready.consented) {
                await startSocialAuth('kakao', 'link', { calendar: true, automatic: true, eventId: event.id });
                return;
            }
            await setKakaoCalendarAutomatic(!ready.automatic, event.id);
            toast(ready.automatic ? '캘린더 자동 반영을 껐어요.' : '참여 일정이 자동으로 반영돼요.');
            onClose();
        }
        catch (problem) {
            setError(errorMessage(problem));
        }
        finally {
            setBusy(false);
        }
    }
    return <Modal title={t("카카오 캘린더 연결")} onClose={() => !busy && onClose()} footer={<><Button icon={X} iconOnly variant="secondary" disabled={busy} onClick={onClose}>{t("닫기")}</Button>{error && ready === null ? <Button onClick={() => setRevision(value => value + 1)}>{t("다시 확인")}</Button> : <Button variant={ready?.automatic ? "secondary" : "primary"} icon={ready?.automatic ? Check : CalendarPlus} loading={busy} disabled={ready === null} onClick={() => void save()}>{ready?.automatic ? t("자동 반영 끄기") : t("자동 반영 연결")}</Button>}</>}><div className="stack">{ready === null && !error ? <div className="row muted"><LoaderCircle size={18} className="spin"/>{t("연결 확인 중")}</div> : <><strong>{event.title}</strong><p>{formatDate(event.date)} · {event.start}–{event.end}<br />{event.location}</p>{ready?.automatic && <strong className="text-success">{t("자동 반영 연결됨")}</strong>}<p className="muted">{t("한 번 연결하면 참여 일정의 확정·변경이 카카오 캘린더에 자동 반영돼요.")}</p><p className="muted">{t("불참으로 바꾸거나 일정이 삭제되면 캘린더에서도 삭제돼요.")}</p><p className="muted">{t("시작 30분 전 알림이 설정돼요. 톡캘린더 알림을 켜 주세요.")}</p></>}{error && <p className="auth-error" role="alert">{error}</p>}</div></Modal>;
}
