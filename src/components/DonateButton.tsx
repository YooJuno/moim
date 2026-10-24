import { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useI18n } from '../lib/preferences';
import { Button, Modal, useToast } from './ui';
import './donate-button.css';

const account = '3333063670931';

export function DonateButton() {
  const { t } = useI18n();
  const toast = useToast();
  const [manual, setManual] = useState(false);
  const copying = useRef(false);
  const details = `${t('카카오뱅크')} · 유준호 · ${account}`;

  async function copy() {
    if (copying.current) return;
    copying.current = true;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(account);
        copied = true;
      }
    } catch { /* Fall back for browsers without clipboard permission. */ }
    if (!copied) {
      const previous = document.activeElement as HTMLElement | null;
      const field = document.createElement('textarea');
      field.value = account;
      field.readOnly = true;
      field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(field);
      field.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      field.remove();
      previous?.focus();
    }
    copying.current = false;
    if (copied) toast('카카오뱅크 · 유준호 · 계좌번호를 복사했어요.');
    else setManual(true);
  }

  return <>
    <button type="button" className="donate-button" title={`${details} · ${t('계좌번호 복사')}`} aria-label={t('후원 계좌번호 복사')} onClick={() => void copy()}><Heart size={12} strokeWidth={1.7}/><span>{t('후원')}</span></button>
    {manual && <Modal title={t('후원 계좌')} onClose={() => setManual(false)} footer={<Button variant="secondary" onClick={() => setManual(false)}>{t('닫기')}</Button>}><p className="donate-account-owner">{t('카카오뱅크')} · 유준호</p><input aria-label={t('계좌번호')} value={account} readOnly onFocus={event => event.target.select()} onClick={event => event.currentTarget.select()}/></Modal>}
  </>;
}
