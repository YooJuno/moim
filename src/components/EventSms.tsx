import { getLocale } from "../lib/i18n";
import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { Check, LoaderCircle, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { useApp } from '../lib/store';
import type { MoimEvent } from '../lib/types';
import { errorMessage } from '../lib/utils';
import { previewEventSms, sendEventSms } from '../lib/sms';
import type { SmsPreview, SmsStatus } from '../lib/sms';
import { Badge, Button, Modal, useToast } from './ui';
import './event-sms.css';
const labels: Record<SmsStatus, string> = { ready: '발송 대상', accepted: '접수 완료', rejected: '접수 거절', unknown: '결과 확인 필요', processing: '처리 확인 필요', missing_phone: '전화번호 없음', invalid_phone: '번호 확인 필요', duplicate: '중복 번호 제외' };
export function EventSms({ event, onClose }: {
    event: MoimEvent;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp(), toast = useToast();
    const [preview, setPreview] = useState<SmsPreview | null>(null), [loading, setLoading] = useState(true), [sending, setSending] = useState(false), [error, setError] = useState<string | null>(null);
    async function refresh() { setLoading(true); setError(null); try {
        setPreview(await previewEventSms(event.id));
    }
    catch (reason) {
        setError(errorMessage(reason));
    }
    finally {
        setLoading(false);
    } }
    useEffect(() => { if (!app.isDemo && app.isAdmin)
        void refresh();
    else
        setLoading(false); }, [event.id]);
    async function send() { if (!preview || sending)
        return; setSending(true); setError(null); try {
        const result = await sendEventSms(event.id, preview.fingerprint);
        setPreview(result.preview);
        const accepted = result.results.filter(item => item.status === 'accepted').length;
        toast(`${accepted}건을 접수했어요. 실제 수신 결과는 SOLAPI에서 확인해 주세요.`);
    }
    catch (reason) {
        const message = errorMessage(reason);
        await refresh();
        setError(message);
    }
    finally {
        setSending(false);
    } }
    return <Modal title={t("일정 문자 알림")} onClose={() => !sending && onClose()} footer={<><Button variant="secondary" disabled={sending} onClick={onClose}>{t("닫기")}</Button><Button icon={Send} loading={sending} disabled={app.isDemo || !app.isAdmin || loading || !preview?.enabled || !preview.readyCount} onClick={() => void send()}>{preview?.readyCount ? t("{0}건 유료 발송", { "0": preview.readyCount }) : t("문자 보내기")}</Button></>}><div className="event-sms"><div className="event-sms-title"><MessageSquare size={22}/><div><strong>{event.title}</strong><span>{event.date} · {event.start}–{event.end}</span></div><Badge>LMS</Badge></div>
  {app.isDemo ? <p className="event-sms-notice">{t("데모에서는 문자를 보내지 않아요.")}</p> : !app.isAdmin ? <p className="event-sms-notice">{t("관리자만 문자를 보낼 수 있어요.")}</p> : <>
   {loading && <p className="event-sms-loading"><LoaderCircle size={18} className="spin"/>{t("발송 대상을 확인하는 중이에요.")}</p>}
   {error && <p className="event-sms-error" role="alert">{error}</p>}
   {preview && <><div className="event-sms-summary"><strong>{t("발송 대상 {0}건", {"0":preview.readyCount})}</strong><span>{t("예상 {0}원", {"0":preview.estimatedCost.toLocaleString(getLocale())})}<small>{t("VAT 포함")}</small></span></div><p className="event-sms-price">{t("LMS 1건 {0}원 + VAT 기준 · 계정별 실제 단가는 달라질 수 있어요.", {"0":preview.unitPrice.toLocaleString(getLocale())})}</p>{!preview.enabled && <p className="event-sms-notice">{t("서버와 모임 설정에서 문자 알림을 켜 주세요.")}</p>}<pre className="event-sms-message">{preview.message}</pre><div className="event-sms-recipients">{preview.recipients.length ? preview.recipients.map(recipient => <div key={recipient.memberId}><span><strong>{recipient.name}</strong><small>{recipient.phone || t("등록된 번호 없음")}</small></span><span className={`event-sms-status is-${recipient.status}`}>{recipient.status === 'accepted' && <Check size={13}/>} {t(labels[recipient.status])}</span></div>) : <p>{t("문자 발송 대상이 없어요.")}</p>}</div><p className="event-sms-price">{t("참여 예정 멤버와 확정된 전체 시간에 투표한 멤버가 대상이에요. 불참 응답은 제외해요.")}</p></>}
   <Button variant="ghost" size="sm" icon={RefreshCw} disabled={loading || sending} onClick={() => void refresh()}>{t("미리보기 새로고침")}</Button>
  </>}
 </div></Modal>;
}
