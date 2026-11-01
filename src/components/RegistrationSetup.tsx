import { useEffect, useRef, useState } from 'react';
import { Check, LogOut, UserRound } from 'lucide-react';
import { needsMemberName } from '../../shared/member-name';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/preferences';
import { registrationComplete, validSignupPhone } from '../lib/registration';
import { errorMessage } from '../lib/utils';
import { BirthdayField } from './BirthdayField';
import { Button, Field, useToast } from './ui';
import './registration.css';

export function RegistrationSetup() {
  const app = useApp();
  const { t } = useI18n();
  const toast = useToast();
  const profile = app.profiles.find(profile => profile.id === app.user?.id);
  const [name, setName] = useState(needsMemberName(app.user?.name) ? '' : app.user!.name);
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [area, setArea] = useState(profile?.area ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? app.user?.birthday ?? '');
  const [busy, setBusy] = useState(false);
  const dirty = useRef(false);
  useEffect(() => {
    if (!profile || dirty.current) return;
    setPhone(profile.phone); setArea(profile.area); setBirthday(profile.birthday ?? app.user?.birthday ?? '');
  }, [profile?.id, profile?.phone, profile?.area, profile?.birthday, app.user?.birthday]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!app.user || !profile || busy) return;
    if (needsMemberName(name)) { toast('이름을 입력해 주세요.', 'error'); return; }
    if (!validSignupPhone(phone)) { toast('전화번호를 확인해 주세요.', 'error'); return; }
    if (!registrationComplete(name, { phone, area, birthday })) { toast('이름·전화번호·거주 지역·생일을 모두 입력해 주세요.', 'error'); return; }
    setBusy(true);
    try {
      await app.saveProfile(app.user.id, { name: name.trim(), phone: phone.trim(), area: area.trim(), birthday });
      toast('가입 정보를 저장했어요.');
    } catch (error) { toast(errorMessage(error), 'error'); }
    finally { setBusy(false); }
  }
  return <main className="auth-screen registration-screen"><div className="auth-card">
    <UserRound size={26} aria-hidden="true"/><h1>{t('가입 정보')}</h1>
    <form className="stack auth-form" onSubmit={save} onChangeCapture={() => { dirty.current = true; }}>
      {!profile && <p role="status" className="muted">{t('개인정보 불러오는 중')}</p>}
      {app.error && <p role="alert" className="auth-error">{t(app.error)}</p>}
      <fieldset className="member-profile-fields stack" disabled={!profile || busy}>
        <Field label={t('이름')} required><input value={name} onChange={event => setName(event.target.value)} maxLength={30} autoComplete="name" placeholder={t('이름')} required autoFocus/></Field>
        <Field label={t('전화번호')} required><input type="tel" inputMode="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} autoComplete="tel" placeholder="010-0000-0000" required/></Field>
        <Field label={t('거주 지역')} required><input value={area} onChange={event => setArea(event.target.value)} maxLength={100} autoComplete="address-level2" placeholder={t('서울 중랑구')} required/></Field>
        <BirthdayField value={birthday} required onChange={value => { dirty.current = true; setBirthday(value); }}/>
      </fieldset>
      <p className="field-hint">{t('전화번호와 거주 지역은 본인과 관리자만 볼 수 있어요.')}</p>
      <Button type="submit" icon={Check} loading={busy} disabled={!profile}>{t('저장하고 계속')}</Button>
    </form>
    <Button variant="ghost" icon={LogOut} disabled={busy} onClick={() => void app.logout().catch(error => toast(errorMessage(error), 'error'))}>{t('로그아웃')}</Button>
  </div></main>;
}
