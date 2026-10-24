import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { CalendarPlus, Check, LoaderCircle } from 'lucide-react';
import { useApp } from '../lib/store';
import type { MoimEvent } from '../lib/types';
import { addToKakaoCalendar, getAccountProviders, startSocialAuth, useAuthProviderConfig } from '../lib/social-auth';
import { errorMessage, formatDate } from '../lib/utils';
import { Button, Modal, useToast } from './ui';
export function KakaoCalendarButton({ event }: {
    event: MoimEvent;
}) {
    const { t } = useI18n();
    const app = useApp();
    const config = useAuthProviderConfig();
    const [open, setOpen] = useState(false);
    const attending = app.rsvps.some(rsvp => rsvp.eventId === event.id && rsvp.memberId === app.user?.id && rsvp.status === 'going');
    if (app.isDemo || !config.enabled || !config.calendar.kakao || !attending)
        return null;
    return <><Button variant="secondary" icon={CalendarPlus} onClick={() => setOpen(true)}>{t("카카오 캘린더")}</Button>{open && <KakaoCalendarDialog event={event} onClose={() => setOpen(false)}/>}</>;
}
function KakaoCalendarDialog({ event, onClose }: {
    event: MoimEvent;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const toast = useToast();
    const [ready, setReady] = useState<boolean | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        let active = true;
        setReady(null);
        setError('');
        void getAccountProviders().then(result => { if (active)
            setReady(result.calendar.kakao); }).catch(problem => { if (active)
            setError(errorMessage(problem)); });
        return () => { active = false; };
    }, [revision]);
    async function save() {
        if (busy || ready === null)
            return;
        setBusy(true);
        setError('');
        try {
            if (!ready) {
                await startSocialAuth('kakao', 'link');
                return;
            }
            const result = await addToKakaoCalendar(event.id);
            toast(result.alreadySynced ? '이미 캘린더에 반영된 일정이에요.' : '내 카카오 캘린더에 반영했어요.');
            onClose();
        }
        catch (problem) {
            setError(errorMessage(problem));
        }
        finally {
            setBusy(false);
        }
    }
    return <Modal title={t("카카오 캘린더에 추가")} onClose={() => !busy && onClose()} footer={<><Button variant="secondary" disabled={busy} onClick={onClose}>{t("닫기")}</Button>{error && ready === null ? <Button onClick={() => setRevision(value => value + 1)}>{t("다시 확인")}</Button> : <Button icon={ready ? Check : CalendarPlus} loading={busy} disabled={ready === null} onClick={() => void save()}>{ready ? t("내 캘린더에 반영") : t("캘린더 연결")}</Button>}</>}><div className="stack">{ready === null && !error ? <div className="row muted"><LoaderCircle size={18} className="spin"/>{t("연결 확인 중")}</div> : <><strong>{event.title}</strong><p>{formatDate(event.date)} · {event.start}–{event.end}<br />{event.location}</p><p className="muted">{ready ? t("내 카카오 캘린더에 이 일정을 추가하거나 변경사항을 반영해요.") : t("카카오 계정 연결과 캘린더 접근 동의가 필요해요. 연결한 뒤 일정에서 다시 추가해 주세요.")}</p></>}{error && <p className="auth-error" role="alert">{error}</p>}</div></Modal>;
}
