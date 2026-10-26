import { useRef, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { externalBrowserURL, safeLoginURL } from '../lib/external-browser';
import { useI18n } from '../lib/preferences';
import { Button } from './ui';

export function ExternalBrowserLogin() {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const busy = useRef(false);
  const url = safeLoginURL(window.location.href);
  const external = externalBrowserURL(window.location.href, navigator.userAgent);
  if (!url) return null;
  async function copy() {
    if (busy.current || !url) return;
    busy.current = true;
    let success = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); success = true; } } catch { /* Older WebViews use the selection fallback. */ }
    if (!success) {
      const previous = document.activeElement as HTMLElement | null;
      const field = document.createElement('textarea');
      field.value = url; field.readOnly = true; field.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.append(field); field.select();
      try { success = document.execCommand('copy'); } catch { success = false; }
      field.remove(); previous?.focus();
    }
    setCopied(success); setManual(!success); busy.current = false;
  }
  return <div className="external-browser-login">
    <p>{t('카카오톡 메뉴에서 Safari·Chrome으로 열거나 링크를 복사해 주세요.')}</p>
    {external && <a className="button button-primary button-md" href={external}><ExternalLink size={17}/>{t('Chrome에서 열기')}</a>}
    <Button variant="secondary" icon={Copy} onClick={() => void copy()}>{t('링크 복사')}</Button>
    {copied && <small role="status">{t('링크를 복사했어요. Safari·Chrome에서 열어 주세요.')}</small>}
    {manual && <><small role="status">{t('링크를 길게 눌러 복사해 주세요.')}</small><input aria-label={t('로그인 주소')} value={url} readOnly onFocus={event => event.target.select()} onClick={event => event.currentTarget.select()}/></>}
  </div>;
}
