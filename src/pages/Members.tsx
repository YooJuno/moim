import { useI18n } from "../lib/preferences";
import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Clock3, Link2, Search, ShieldCheck, SlidersHorizontal, UserPlus, Users, X } from 'lucide-react';
import { useApp } from '../lib/store';
import type { Member, MemberStatus, Role } from '../lib/types';
import { errorMessage, formatDate, roleLabels } from '../lib/utils';
import { POSITIONS, isPosition, positionLabel, positionRank } from '../lib/positions';
import { Avatar, Badge, Button, EmptyState, Field, Modal, PageHeader, useToast } from '../components/ui';
import { BirthdayField, birthdayLabel, isValidBirthday } from '../components/BirthdayField';
import './community.css';
export function Members() {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [tab, setTab] = useState<MemberStatus>('active');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);
    const active = app.members.filter(member => member.status === 'active');
    const pending = app.members.filter(member => member.status === 'pending');
    const members = app.members.filter(member => member.status === (app.isAdmin ? tab : 'active') && member.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a, b) => positionRank(b.position) - positionRank(a.position) || a.name.localeCompare(b.name, 'ko'));
    async function approve(member: Member) { setBusy(member.id); try {
        await app.updateMember(member.id, { status: 'active' });
        toast(t('{0} 님의 가입을 승인했어요.', {'0':member.name}));
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setBusy(null);
    } }
    return <div className="page members-page">
    <PageHeader title={t("멤버")} action={<div className="member-header-actions"><span className="member-total"><Users size={17}/><strong>{active.length}</strong>{t("명")}</span>{app.isAdmin && <Button icon={UserPlus} onClick={() => setAdding(true)}>{t("멤버 추가")}</Button>}</div>}/>
    <div className="member-summary-grid"><div className="card member-summary"><span className="member-summary-icon blue"><Users size={21}/></span><div><span>{t("전체 멤버")}</span><strong>{active.length}<small>{t("명")}</small></strong></div></div><div className="card member-summary"><span className="member-summary-icon violet"><ShieldCheck size={21}/></span><div><span>{t("운영진")}</span><strong>{active.filter(member => isPosition(member.position)).length}<small>{t("명")}</small></strong></div></div>{app.isAdmin && <button className="card member-summary member-pending-summary" onClick={() => setTab('pending')}><span className="member-summary-icon orange"><Clock3 size={21}/></span><div><span>{t("가입 대기")}</span><strong>{pending.length}<small>{t("명")}</small></strong></div><ChevronRight size={19}/></button>}</div>
    <div className="member-toolbar">{app.isAdmin ? <div className="tabs" aria-label={t("가입 상태")}><button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>{t("멤버")}</button><button className={`tab ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>{t("가입 대기")}{pending.length > 0 && <span className="member-tab-count">{pending.length}</span>}</button><button className={`tab ${tab === 'rejected' ? 'active' : ''}`} onClick={() => setTab('rejected')}>{t("승인 거절")}</button></div> : <strong>{t("멤버")}</strong>}<label className="community-search"><Search size={18}/><input type="search" placeholder={t("이름으로 검색")} aria-label={t("멤버 이름 검색")} value={search} onChange={e => setSearch(e.target.value)}/></label></div>
    <div className="card member-list"><div className={`member-list-head ${!app.isAdmin ? 'member-public-head' : ''}`}><span>{t("이름")}</span><span>{t("직책")}</span>{app.isAdmin && <span>{t("연락처 · 거주 지역")}</span>}<span>{tab === 'pending' ? t("가입 신청일") : t("등록일")}</span><span /></div>
      {members.map(member => {
            const profile = app.profiles.find(item => item.id === member.id);
            const own = member.id === app.user?.id;
            return <div className={`member-row ${!app.isAdmin ? 'member-public-row' : ''}`} key={member.id}>
        <button className="member-person" onClick={() => setSelected(member.id)}><Avatar member={member} size={43}/><div><strong>{member.name}{own && <span className="member-me">{t("나")}</span>}{member.isRoster && <span className="member-unlinked">{t("미연결")}</span>}</strong>{(app.isAdmin || own) && <span>{member.isRoster ? t("Google 계정 미연결") : member.email}</span>}</div></button>
        <div className="member-role-badges">{positionLabel(member) && <Badge tone={member.position === '총무' ? 'green' : isPosition(member.position) || member.role === 'leader' ? 'blue' : 'gray'}>{t(positionLabel(member))}</Badge>}</div>
        {app.isAdmin && <div className="member-contact"><span>{profile?.phone || t("연락처 미등록")}</span><span>{profile?.area || t("지역 미등록")}{profile?.birthday && <small> · {birthdayLabel(profile.birthday)}</small>}</span></div>}
        <span className="member-joined">{formatDate(member.joinedAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}</span>
        <div className="member-row-action">{app.isAdmin && member.status !== 'active' ? <Button size="sm" variant="secondary" icon={Check} loading={busy === member.id} onClick={() => void approve(member)}>{t("승인")}</Button> : <button className="member-manage" aria-label={`${member.name} ${app.isAdmin ? t("관리") : t("프로필 보기")}`} onClick={() => setSelected(member.id)}>{app.isAdmin ? <SlidersHorizontal size={17}/> : <ChevronRight size={18}/>}</button>}</div>
      </div>;
        })}
      {members.length === 0 && <EmptyState icon={tab === 'pending' ? Clock3 : Users} title={search ? t("검색 결과가 없어요") : tab === 'pending' ? t("가입 대기 중인 사람이 없어요") : tab === 'rejected' ? t("승인 거절한 사람이 없어요") : t("아직 멤버가 없어요")} description={search ? t("이름을 다시 확인해 주세요.") : undefined}/>}
    </div>
    {selected && app.members.find(member => member.id === selected) && <MemberDetail key={selected} member={app.members.find(member => member.id === selected)!} onClose={() => setSelected(null)}/>}
    {adding && <AddRosterMember onClose={() => setAdding(false)}/>}
  </div>;
}
function MemberDetail({ member, onClose }: {
    member: Member;
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const profile = app.profiles.find(item => item.id === member.id);
    const own = app.user?.id === member.id;
    const editable = app.canParticipate && (app.isAdmin || own);
    const [name, setName] = useState(member.name);
    const [phone, setPhone] = useState(profile?.phone ?? '');
    const [area, setArea] = useState(profile?.area ?? '');
    const [birthday, setBirthday] = useState(profile?.birthday ?? '');
    const [position, setPosition] = useState<string>(isPosition(member.position) ? member.position : '');
    const [role, setRole] = useState<Role>(member.role);
    const [canCreatePoll, setCanCreatePoll] = useState(member.canCreatePoll);
    const [saving, setSaving] = useState(false);
    const [confirmReject, setConfirmReject] = useState(false);
    const [rosterId, setRosterId] = useState('');
    const dirty = useRef(false);
    const [hydratedId, setHydratedId] = useState(profile?.id ?? null);
    const profileReady = !editable || (profile?.id === member.id && hydratedId === member.id);
    useEffect(() => { if (!profile || (dirty.current && hydratedId === member.id))
        return; setPhone(profile.phone); setArea(profile.area); setBirthday(profile.birthday ?? ''); setHydratedId(member.id); }, [member.id, profile?.id, profile?.phone, profile?.area, profile?.birthday, hydratedId]);
    const rosters = app.members.filter(item => item.isRoster && item.status === 'active');
    const linking = app.isAdmin && !member.isRoster && member.status === 'pending' && rosters.length > 0;
    async function save(e: React.FormEvent) { e.preventDefault(); if (!name.trim() || saving || !profileReady)
        return; if (!isValidBirthday(birthday)) {
        toast('생일을 월-일 형식으로 확인해 주세요.', 'error');
        return;
    } setSaving(true); try {
        await app.saveProfile(member.id, { name: name.trim(), phone: phone.trim(), area: area.trim(), birthday });
        if (app.isAdmin)
            await app.updateMember(member.id, { ...(!own && !member.isRoster ? { role, canCreatePoll } : {}), position: position.trim() });
        toast('멤버 정보를 저장했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    async function status(status: MemberStatus) { setSaving(true); try {
        await app.updateMember(member.id, { status });
        toast(status === 'active' ? '가입을 승인했어요.' : '가입 신청을 거절했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    async function link() { if (!rosterId || saving)
        return; setSaving(true); try {
        await app.linkRosterMember(rosterId, member.id);
        toast('기존 명단을 연결하고 가입을 승인했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <Modal title={app.isAdmin ? t("멤버 관리") : t("프로필")} onClose={() => !saving && onClose()} footer={editable ? <><Button variant="secondary" disabled={saving} onClick={onClose}>{t("닫기")}</Button><Button form="member-form" type="submit" loading={saving} disabled={!profileReady}>{t("저장")}</Button></> : undefined}>
    <div className="member-detail-avatar"><Avatar member={member} size={72}/><strong>{member.name}</strong><div className="member-detail-badges">{positionLabel(member) && <Badge tone={isPosition(member.position) || member.role === 'leader' ? 'blue' : 'gray'}>{t(positionLabel(member))}</Badge>}{member.isRoster && <Badge tone="orange">{t("미연결")}</Badge>}</div></div>
    {linking && <div className="member-link-section"><h3><Link2 size={16}/>{t("기존 명단 연결")}</h3><Field label={t("연결할 기존 멤버")}><select value={rosterId} onChange={e => setRosterId(e.target.value)} disabled={saving}><option value="">{t("명단에서 선택")}</option>{rosters.map(item => { const contact = app.profiles.find(value => value.id === item.id); return <option key={item.id} value={item.id}>{item.name}{item.position ? ` · ${t(item.position)}` : ''}{contact?.phone ? ` · ${contact.phone}` : ''}</option>; })}</select></Field><p>{t("선택한 명단의 정보를 이 Google 계정에 연결해요.")}</p><Button variant="secondary" size="sm" icon={Link2} disabled={!rosterId || saving} onClick={() => void link()}>{t("명단 연결하고 승인")}</Button></div>}
    {editable ? <form id="member-form" className="stack" onSubmit={save} onChangeCapture={() => { dirty.current = true; }}>{!profileReady && <div className="member-profile-loading" role="status">{t("개인정보 불러오는 중")}</div>}<fieldset className="member-profile-fields" disabled={!profileReady || saving}>
      <Field label={t("이름")} required><input value={name} onChange={e => setName(e.target.value)} maxLength={30} required/></Field>
      {!member.isRoster && <Field label={t("이메일")}><input value={member.email} readOnly className="community-readonly"/></Field>}
      <div className="form-grid"><Field label={t("전화번호")}><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="010-0000-0000" maxLength={20}/></Field><Field label={t("거주 지역")}><input value={area} onChange={e => setArea(e.target.value)} placeholder={t("서울 마포구")} maxLength={50}/></Field></div>
      <BirthdayField value={birthday} onChange={value => { dirty.current = true; setBirthday(value); }}/>
      {app.isAdmin && <><div className="community-divider"/><Field label={t("직책")}><select value={position} onChange={e => setPosition(e.target.value)}><option value=""></option>{POSITIONS.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></Field>{!member.isRoster && <><Field label={t("권한")}><select value={role} onChange={e => setRole(e.target.value as Role)} disabled={own}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{t(label)}</option>)}</select></Field><label className="member-permission"><span><strong>{t("일정 투표 만들기")}</strong><small>{role === 'leader' ? t("관리자는 모든 일정을 관리할 수 있어요.") : t("새 투표를 만들고 본인의 투표를 관리할 수 있어요.")}</small></span><input type="checkbox" role="switch" checked={role === 'leader' || canCreatePoll} disabled={own || role === 'leader'} onChange={e => setCanCreatePoll(e.target.checked)}/></label></>}</>}
      {app.isAdmin && member.status !== 'active' && <div className="member-approval-actions"><Button variant="secondary" icon={X} disabled={saving} onClick={() => setConfirmReject(true)}>{t("승인 거절")}</Button><Button icon={Check} loading={saving} onClick={() => void status('active')}>{t("가입 승인")}</Button></div>}
      {confirmReject && <div className="community-confirm"><span>{t("가입 신청을 거절할까요?")}</span><Button size="sm" variant="secondary" onClick={() => setConfirmReject(false)}>{t("취소")}</Button><Button size="sm" variant="danger" loading={saving} onClick={() => void status('rejected')}>{t("거절")}</Button></div>}
    </fieldset></form> : <div className="member-public-detail">{positionLabel(member) && <div><Users size={18}/><span>{t(positionLabel(member))}</span></div>}<div><Check size={18}/><span>{t("{0} 등록", {"0":formatDate(member.joinedAt)})}</span></div></div>}
    {editable && <p className="member-privacy"><ShieldCheck size={14}/>{t("연락처와 거주 지역은 본인과 관리자만 볼 수 있어요.")}</p>}
  </Modal>;
}
function AddRosterMember({ onClose }: {
    onClose: () => void;
}) {
    const { t } = useI18n();
    const app = useApp();
    const toast = useToast();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [area, setArea] = useState('');
    const [birthday, setBirthday] = useState('');
    const [position, setPosition] = useState('');
    const [saving, setSaving] = useState(false);
    async function save(e: React.FormEvent) { e.preventDefault(); if (!name.trim() || saving)
        return; if (!isValidBirthday(birthday)) {
        toast('생일을 월-일 형식으로 확인해 주세요.', 'error');
        return;
    } setSaving(true); try {
        await app.addRosterMember({ name: name.trim(), phone: phone.trim(), area: area.trim(), ...(birthday ? { birthday } : {}), ...(position.trim() ? { position: position.trim() } : {}) });
        toast('멤버를 명단에 추가했어요.');
        onClose();
    }
    catch (error) {
        toast(errorMessage(error), 'error');
    }
    finally {
        setSaving(false);
    } }
    return <Modal title={t("멤버 추가")} onClose={() => !saving && onClose()} footer={<><Button variant="secondary" disabled={saving} onClick={onClose}>{t("취소")}</Button><Button form="roster-form" type="submit" icon={UserPlus} loading={saving}>{t("추가")}</Button></>}><form id="roster-form" className="stack" onSubmit={save}><Field label={t("이름")} required><input value={name} onChange={e => setName(e.target.value)} maxLength={30} required autoFocus/></Field><div className="form-grid"><Field label={t("전화번호")}><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="010-0000-0000"/></Field><Field label={t("거주 지역")}><input value={area} onChange={e => setArea(e.target.value)} maxLength={50} placeholder={t("서울 마포구")}/></Field></div><BirthdayField value={birthday} onChange={setBirthday}/><Field label={t("직책")}><select value={position} onChange={e => setPosition(e.target.value)}><option value=""></option>{POSITIONS.map(value => <option key={value} value={value}>{t(value)}</option>)}</select></Field><p className="member-roster-note">{t("Google 계정은 가입 신청 후 관리자가 연결해요.")}</p></form></Modal>;
}
