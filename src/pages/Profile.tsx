import { useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, LogOut, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/preferences';
import { errorMessage } from '../lib/utils';
import { positionLabel } from '../lib/positions';
import { BirthdayField, isValidBirthday } from '../components/BirthdayField';
import { AccountConnections } from '../components/AccountConnections';
import { PreferencesPanel } from '../components/PreferencesPanel';
import { Avatar, Badge, Button, Field, Modal, PageHeader, useToast } from '../components/ui';
import './community.css';

export function Profile(){
  const app=useApp();const {t,language}=useI18n();const office=app.user?positionLabel(app.user):'';const toast=useToast();const profile=app.profiles.find(item=>item.id===app.user?.id);const [name,setName]=useState(app.user?.name??'');const [phone,setPhone]=useState(profile?.phone??'');const [area,setArea]=useState(profile?.area??'');const [birthday,setBirthday]=useState(profile?.birthday??'');const [saving,setSaving]=useState<'profile'|'logout'|null>(null);const [confirmLogout,setConfirmLogout]=useState(false);
  const dirty=useRef(false);const accountId=useRef(app.user?.id);const [hydratedId,setHydratedId]=useState(profile?.id??null);
  const profileReady=!!app.user&&profile?.id===app.user.id&&hydratedId===app.user.id;
  useEffect(()=>{
    const changedAccount=accountId.current!==app.user?.id;
    if(changedAccount){accountId.current=app.user?.id;dirty.current=false;setHydratedId(null);setName(app.user?.name??'');setPhone('');setArea('');setBirthday('');}
    if(!app.user||!profile||profile.id!==app.user.id||(dirty.current&&!changedAccount&&hydratedId===app.user.id))return;
    setName(app.user.name);setPhone(profile.phone);setArea(profile.area);setBirthday(profile.birthday??'');setHydratedId(app.user.id);
  },[app.user?.id,app.user?.name,profile?.id,profile?.phone,profile?.area,profile?.birthday,hydratedId]);
  async function save(e:React.FormEvent){e.preventDefault();if(!app.user||!name.trim()||saving||!profileReady)return;if(!isValidBirthday(birthday)){toast(t('생일을 월-일 형식으로 확인해 주세요.'),'error');return;}setSaving('profile');try{await app.saveProfile(app.user.id,{name:name.trim(),phone:phone.trim(),area:area.trim(),birthday});dirty.current=false;toast(t('내 정보를 저장했어요.'));}catch(error){toast(t(errorMessage(error)),'error');}finally{setSaving(null);}}
  async function logout(){setSaving('logout');try{await app.logout();}catch(error){toast(t(errorMessage(error)),'error');}finally{setSaving(null);setConfirmLogout(false);}}
  return <div className="page profile-page"><PageHeader title={t('내 정보')}/><div className="settings-layout"><div className="settings-main"><section className="card settings-section"><div className="settings-section-title"><span className="settings-icon"><UserRound size={21}/></span><h2>{t('프로필')}</h2></div><div className="settings-profile-summary"><Avatar member={app.user??undefined} size={58}/><div><strong>{app.user?.name}</strong><span>{app.user?.email}</span></div>{office&&<Badge tone={app.isAdmin?'blue':'gray'}>{t(office)}</Badge>}</div>
    <form className="stack" onSubmit={save} onChangeCapture={()=>{dirty.current=true;}}>{!profileReady&&<div className="member-profile-loading" role="status">{t("개인정보 불러오는 중")}</div>}<fieldset className="member-profile-fields" disabled={!profileReady||saving!==null}><Field label={t('이름')} required><input value={name} onChange={e=>setName(e.target.value)} maxLength={30} required/></Field><div className="form-grid"><Field label={t('전화번호')}><input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} maxLength={20} placeholder="010-0000-0000"/></Field><Field label={t('거주 지역')}><input value={area} onChange={e=>setArea(e.target.value)} maxLength={50} placeholder={language==='en'?'e.g. Jungnang-gu, Seoul':'서울 중랑구'}/></Field></div><BirthdayField value={birthday} onChange={value=>{dirty.current=true;setBirthday(value);}}/><Field label={t('직책')}><input value={t(app.user?.position??'')} readOnly className="community-readonly"/></Field><p className="member-privacy"><ShieldCheck size={15}/>{t('전화번호와 거주 지역은 본인과 관리자만 볼 수 있어요.')}</p></fieldset><div className="form-actions"><Button type="submit" icon={Check} loading={saving==='profile'} disabled={!profileReady||saving==='logout'}>{t('저장하기')}</Button></div></form>
  </section><PreferencesPanel/></div><aside className="settings-aside"><section className="card settings-account"><div className="settings-section-title"><Settings2 size={20}/><h2>{t('계정')}</h2></div><AccountConnections/><button className="settings-logout" onClick={()=>setConfirmLogout(true)}><LogOut size={17}/>{t('로그아웃')}<ChevronRight size={17}/></button></section></aside></div>
  {confirmLogout&&<Modal title={t('로그아웃할까요?')} onClose={()=>setConfirmLogout(false)} footer={<><Button variant="secondary" onClick={()=>setConfirmLogout(false)}>{t('취소')}</Button><Button icon={LogOut} loading={saving==='logout'} onClick={()=>void logout()}>{t('로그아웃')}</Button></>}><p className="muted">{t(app.isDemo?'샘플 계정으로 다시 둘러볼 수 있어요.':'같은 계정으로 다시 로그인할 수 있어요.')}</p></Modal>}
  </div>;
}
