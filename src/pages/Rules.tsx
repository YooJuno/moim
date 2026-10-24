import { useI18n } from "../lib/preferences";
import { useState } from 'react';
import { BookOpen, Check, Pencil, ShieldCheck } from 'lucide-react';
import { useApp } from '../lib/store';
import { formatDate, errorMessage, memberName } from '../lib/utils';
import { Avatar, Button, EmptyState, PageHeader, useToast } from '../components/ui';
function linkedText(text: string) { return text.split(/(https:\/\/[^\s]+)/g).map((part, index) => part.startsWith('https://') ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a> : part); }
export function Rules() {
    const { t } = useI18n();
    const { bylaws, members, isAdmin, saveBylaws } = useApp();
    const [editing, setEditing] = useState(false), [content, setContent] = useState(''), [saving, setSaving] = useState(false);
    const toast = useToast();
    const save = async () => { if (!content.trim()) {
        toast('회칙 내용을 입력해 주세요.', 'error');
        return;
    } setSaving(true); try {
        await saveBylaws(content.trim());
        setEditing(false);
        toast('회칙을 저장했어요.');
    }
    catch (e) {
        toast(errorMessage(e), 'error');
    }
    finally {
        setSaving(false);
    } };
    return <div className="page rules-page"><PageHeader title={t("회칙")} action={isAdmin && !editing ? <Button icon={Pencil} variant="secondary" onClick={() => { setContent(bylaws.content); setEditing(true); }}>{t("회칙 수정")}</Button> : undefined}/>
    <div className="rules-layout"><section className="card rules-document"><div className="rules-document-title"><span className="feature-icon feature-icon-blue"><BookOpen size={24}/></span><div><h2>{t("모임 회칙")}</h2>{bylaws.updatedAt && <span className="muted">{t("{0} 업데이트", {"0":formatDate(bylaws.updatedAt, {year:"numeric",month:"long",day:"numeric"})})}</span>}</div></div>
    {editing ? <><label className="field"><span className="field-label">{t("회칙 내용")}</span><textarea className="rules-editor" aria-label={t("회칙 내용")} rows={24} maxLength={40000} value={content} onChange={e => setContent(e.target.value)} placeholder={t("제1조 목적\n\n회칙 내용을 입력하세요.")}/></label><div className="form-actions"><Button variant="secondary" disabled={saving} onClick={() => setEditing(false)}>{t("취소")}</Button><Button icon={Check} loading={saving} onClick={save}>{t("저장")}</Button></div></> : bylaws.content ? <div className="rules-content">{bylaws.content.split(/\n\s*\n/).map((section, i) => { const [heading, ...body] = section.split('\n'); const isHeading = /^(제\s*\d+\s*조|\d+[.)]|#)/.test(heading); return <div className="rules-section" key={i}>{isHeading ? <><h3>{heading.replace(/^#+\s*/, '')}</h3><p>{linkedText(body.join('\n'))}</p></> : <p>{linkedText(section)}</p>}</div>; })}</div> : <EmptyState icon={BookOpen} title={t("아직 등록된 회칙이 없어요")} description={isAdmin ? t("회칙 수정을 눌러 작성해 주세요.") : t("회칙이 등록되면 이곳에서 확인할 수 있어요.")}/>}
    </section><aside className="rules-aside card"><ShieldCheck size={23}/><h3>{t("마지막 수정")}</h3>{bylaws.editorId ? <div className="rules-editor-info"><Avatar member={members.find(m => m.id === bylaws.editorId)} size={30}/><div><strong>{memberName(members, bylaws.editorId)}</strong><span>{t("마지막 수정")}</span></div></div> : <p className="muted">{t("관리자가 회칙을 관리해요.")}</p>}</aside></div>
  </div>;
}
