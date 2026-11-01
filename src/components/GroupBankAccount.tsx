import { useRef, useState } from 'react';
import { Copy, Landmark } from 'lucide-react';
import { useApp } from '../lib/store';
import { useI18n } from '../lib/preferences';
import { Button, Modal, useToast } from './ui';
import './group-bank-account.css';

export function GroupBankAccount() {
  const { settings } = useApp();
  const { t } = useI18n();
  const toast = useToast();
  const copying = useRef(false);
  const [manual, setManual] = useState(false);
  const account = settings.bankAccount;
  if (!account || !settings.bankName) return null;

  async function copy() {
    if (copying.current || !account) return;
    copying.current = true;
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(account); copied = true; }
    } catch { /* In-app browsers may block the Clipboard API. */ }
    if (!copied) {
      const previous = document.activeElement as HTMLElement | null;
      const field = document.createElement('textarea');
      field.value = account; field.readOnly = true;
      field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(field); field.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      field.remove(); previous?.focus();
    }
    copying.current = false;
    if (copied) toast('모임 계좌번호를 복사했어요.');
    else setManual(true);
  }

  return <>
    <section className="card group-bank-account" aria-label={t('모임 계좌')}>
      <h2><Landmark size={17}/>{t('모임 계좌')}</h2>
      <button type="button" onClick={() => void copy()} aria-label={t('모임 계좌번호 복사')}>
        <span className="group-bank-name">{settings.bankName}</span><strong>{account}</strong>
        <span className="group-bank-copy"><Copy size={14}/>{t('복사')}</span>
      </button>
    </section>
    {manual && <Modal title={t('모임 계좌')} onClose={() => setManual(false)} footer={<Button variant="secondary" onClick={() => setManual(false)}>{t('닫기')}</Button>}>
      <p className="group-bank-manual-name">{settings.bankName}</p>
      <input aria-label={t('계좌번호')} value={account} readOnly onFocus={event => event.target.select()} onClick={event => event.currentTarget.select()}/>
    </Modal>}
  </>;
}
