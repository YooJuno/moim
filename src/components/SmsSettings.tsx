import { useI18n } from "../lib/preferences";
import { useEffect, useState } from 'react';
import { Check, MessageSquare } from 'lucide-react';
import { useApp } from '../lib/store';
import { getAuthAPIURL } from '../lib/social-auth';
import { errorMessage } from '../lib/utils';
import { Badge, Button, useToast } from './ui';
import './event-sms.css';
export function SmsSettings() {
    const { t } = useI18n();
    const app = useApp(), toast = useToast();
    const [enabled, setEnabled] = useState(app.settings.smsEnabled === true), [automatic, setAutomatic] = useState(app.settings.smsAutoOnConfirm === true), [saving, setSaving] = useState(false), [serverReady, setServerReady] = useState(false);
    useEffect(() => { setEnabled(app.settings.smsEnabled === true); setAutomatic(app.settings.smsAutoOnConfirm === true); }, [app.settings.smsEnabled, app.settings.smsAutoOnConfirm]);
    useEffect(() => { const base = getAuthAPIURL(); if (!base || app.isDemo)
        return; const controller = new AbortController(); void fetch(new URL('config', base), { signal: controller.signal, credentials: 'omit', cache: 'no-store' }).then(response => response.ok ? response.json() : null).then(data => setServerReady(data?.notifications?.sms === true)).catch(() => { }); return () => controller.abort(); }, [app.isDemo]);
    if (!app.isAdmin)
        return null;
    async function save() { if (saving)
        return; setSaving(true); try {
        await app.saveSettings({ ...app.settings, smsEnabled: enabled, smsAutoOnConfirm: enabled && automatic });
        toast('문자 알림 설정을 저장했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <section className="card settings-section sms-settings" aria-label={t("문자 알림 설정")}><div className="settings-section-title"><span className="settings-icon"><MessageSquare size={20}/></span><h2>{t("문자 알림")}</h2><Badge tone={serverReady ? 'green' : 'gray'}>{app.isDemo ? t("데모") : serverReady ? t("서버 연결됨") : t("서버 설정 필요")}</Badge></div><label className="sms-setting-row"><span><strong>{t("문자 알림 사용")}</strong><small>{t("관리자가 대상과 예상 비용을 확인하고 발송해요.")}</small></span><input type="checkbox" checked={enabled} disabled={saving} onChange={event => { setEnabled(event.target.checked); if (!event.target.checked)
        setAutomatic(false); }}/></label><label className={`sms-setting-row ${!enabled ? 'is-disabled' : ''}`}><span><strong>{t("일정 확정 시 자동 발송")}</strong><small>{t("확정한 전체 시간에 가능한 멤버에게 보내요.")}</small></span><input type="checkbox" checked={enabled && automatic} disabled={!enabled || saving} onChange={event => setAutomatic(event.target.checked)}/></label><p className="event-sms-price">{t("LMS 1건 45원 + VAT 기준. 계정별 실제 단가는 달라질 수 있어요.")}</p>{automatic && enabled && <p className="event-sms-notice">{t("일정 확정 후 별도 확인 없이 유료 문자를 접수해요.")}</p>}{!serverReady && !app.isDemo && <p className="event-sms-price">{t("서버에 SOLAPI 키와 발신번호를 등록해야 발송할 수 있어요.")}</p>}<div className="form-actions"><Button icon={Check} loading={saving} onClick={() => void save()}>{t("문자 설정 저장")}</Button></div></section>;
}
