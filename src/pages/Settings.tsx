import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Camera, Check, RotateCcw, Users, X } from 'lucide-react';
import { useApp } from '../lib/store';
import { errorMessage } from '../lib/utils';
import { prepareGroupPhoto } from '../lib/group-photo';
import { Badge, Button, Field, IconButton, Modal, PageHeader, useToast } from '../components/ui';
import { SavedPlacesManager } from '../components/SavedPlacesManager';
import { SmsSettings } from '../components/SmsSettings';
import { ErrorLogPanel } from '../components/ErrorLogPanel';
import './community.css';
export function Settings() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const photoInput = useRef<HTMLInputElement>(null);
    const [name, setName] = useState(app.settings.name);
    const [description, setDescription] = useState(app.settings.description);
    const [photoURL, setPhotoURL] = useState(app.settings.photoURL ?? '');
    const [processingPhoto, setProcessingPhoto] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    useEffect(() => { setName(app.settings.name); setDescription(app.settings.description); setPhotoURL(app.settings.photoURL ?? ''); }, [app.settings.name, app.settings.description, app.settings.photoURL]);
    async function save(e: React.FormEvent) { e.preventDefault(); if (!name.trim() || processingPhoto || saving)
        return; setSaving(true); try {
        await app.saveSettings({ name: name.trim(), description: description.trim(), ...(photoURL ? { photoURL } : {}) });
        toast('모임 정보를 저장했어요.');
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    async function changePhoto(file?: File) { if (!file)
        return; setProcessingPhoto(true); try {
        setPhotoURL(await prepareGroupPhoto(file));
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setProcessingPhoto(false);
        if (photoInput.current)
            photoInput.current.value = '';
    } }
    if (!app.isAdmin)
        return <Navigate to="/profile" replace/>;
    return <div className="page settings-page"><PageHeader title={t("모임 설정")}/><div className="settings-layout"><div className="settings-main"><section className="card settings-section"><div className="settings-section-title"><span className="settings-icon violet"><Users size={21}/></span><h2>{t("모임 정보")}</h2></div><form className="stack" onSubmit={save}>
    <div className="settings-group-photo-field"><span className="field-label">{t("대표 사진")}</span><div className="settings-group-photo-row"><div className="settings-group-photo-preview">{photoURL ? <img src={photoURL} alt={t("대표 사진 미리보기")}/> : <Users size={36}/>} {photoURL && <IconButton label={t("모임 사진 삭제")} icon={X} disabled={processingPhoto || saving} onClick={() => setPhotoURL('')}/>}</div><div><Button variant="secondary" size="sm" icon={Camera} loading={processingPhoto} disabled={saving} onClick={() => photoInput.current?.click()}>{t("사진 변경")}</Button><span>{t("최대 5MB")}</span></div><input ref={photoInput} type="file" aria-label={t("모임 대표 사진")} accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={e => void changePhoto(e.target.files?.[0])}/></div></div>
    <Field label={t("모임 이름")} required><input value={name} onChange={e => setName(e.target.value)} maxLength={30} required/></Field><Field label={t("한 줄 소개")}><textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={100} rows={2}/></Field><div className="form-actions"><Button type="submit" icon={Check} loading={saving} disabled={processingPhoto}>{t("저장하기")}</Button></div>
  </form></section><SavedPlacesManager /><SmsSettings /><ErrorLogPanel /></div>{app.isDemo && <aside className="settings-aside"><section className="card settings-demo"><Badge tone="orange">{t("데모 모드")}</Badge><p>{t("변경 내용은 이 브라우저에 저장돼요.")}</p><Button variant="secondary" icon={RotateCcw} onClick={() => setConfirmReset(true)}>{t("샘플 데이터 초기화")}</Button></section></aside>}</div>
  {confirmReset && <Modal title={t("샘플 데이터를 초기화할까요?")} onClose={() => setConfirmReset(false)} footer={<><Button variant="secondary" onClick={() => setConfirmReset(false)}>{t("취소")}</Button><Button variant="danger" icon={RotateCcw} onClick={() => { app.resetDemo(); setConfirmReset(false); toast('샘플 데이터를 초기화했어요.'); }}>{t("초기화")}</Button></>}><p className="muted">{t("이 브라우저에서 작성한 글과 투표가 지워지고 처음 상태로 돌아가요.")}</p></Modal>}
  </div>;
}
