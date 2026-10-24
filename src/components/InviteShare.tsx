import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, Clock3, Copy, Link2, MapPin, MessageCircle, Share2, UsersRound } from 'lucide-react';
import { useApp } from '../lib/store';
import type { MoimEvent } from '../lib/types';
import { errorMessage, formatDate } from '../lib/utils';
import { kakaoShareConfigured, prepareKakaoShare, shareWithKakao } from '../lib/kakao-share';
import { Button, Modal, useToast } from './ui';
import './invite-share.css';

export function InviteShare({ event, onClose }: { event?: MoimEvent; onClose: () => void }) {
  const { settings } = useApp();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'native' | 'kakao' | null>(null);
  const [kakaoReady, setKakaoReady] = useState(false);
  const [kakaoFailed, setKakaoFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const url = new URL(event ? `/calendar?event=${encodeURIComponent(event.id)}` : '/', window.location.origin).href;
  const title = event ? `${settings.name} · ${event.title}` : settings.name;
  const text = event ? `${formatDate(event.date)} ${event.start}–${event.end}${event.location ? `\n${event.location}` : ''}` : '모임 초대';
  useEffect(() => {
    let alive = true;
    if (kakaoShareConfigured) void prepareKakaoShare().then(() => { if (alive) setKakaoReady(true); }).catch(() => { if (alive) setKakaoFailed(true); });
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, []);

  const copy = async () => {
    let success = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); success = true; } } catch { /* Try selection-based copy when clipboard permissions are unavailable. */ }
    if (!success) {
      const previous = document.activeElement as HTMLElement | null;
      const textarea = document.createElement('textarea'); textarea.value = url; textarea.setAttribute('readonly', ''); textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(textarea); textarea.select();
      try { success = document.execCommand('copy'); } catch { success = false; }
      textarea.remove(); previous?.focus();
    }
    if (!success) { input.current?.select(); toast('링크를 선택했어요. 직접 복사해 주세요.', 'error'); return; }
    setCopied(true); toast('링크를 복사했어요.'); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setCopied(false), 2500);
  };
  const nativeShare = async () => {
    if (busy) return;
    const data = { title, text, url };
    if (!navigator.share || (navigator.canShare && !navigator.canShare(data))) { await copy(); return; }
    setBusy('native');
    try { await navigator.share(data); }
    catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) await copy(); }
    finally { setBusy(null); }
  };
  const kakaoShare = async () => {
    if (busy || !kakaoShareConfigured || !kakaoReady) return;
    setBusy('kakao');
    try { await shareWithKakao({ title, text, url, event: !!event }); }
    catch (error) { toast(errorMessage(error), 'error'); }
    finally { setBusy(null); }
  };

  return <Modal title={event ? '일정 공유' : '모임 초대'} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>닫기</Button>}>
    <div className="invite-summary"><div className="invite-symbol">{event ? <CalendarDays size={25} /> : <UsersRound size={25} />}</div><div><span>{event ? settings.name : '우리 모임'}</span><strong>{event?.title ?? settings.name}</strong>{event && <><p><Clock3 size={13} />{formatDate(event.date)} · {event.start}–{event.end}</p>{event.location && <p><MapPin size={13} />{event.location}</p>}</>}</div></div>
    <div className="invite-url"><Link2 size={17} /><input ref={input} aria-label="공유 링크" value={url} readOnly onFocus={e => e.currentTarget.select()} /></div>
    <div className="invite-actions"><Button variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy()} disabled={busy !== null}>{copied ? '복사됨' : '링크 복사'}</Button><Button icon={Share2} loading={busy === 'native'} disabled={busy === 'kakao'} onClick={() => void nativeShare()}>공유하기</Button></div>
    {kakaoShareConfigured && <Button className="invite-kakao" variant="secondary" icon={MessageCircle} loading={!kakaoReady && !kakaoFailed || busy === 'kakao'} disabled={!kakaoReady || busy === 'native'} onClick={() => void kakaoShare()}>카카오톡 공유</Button>}
    {kakaoFailed && <p className="invite-share-error">카카오톡 공유를 불러오지 못했어요. 링크를 복사해 주세요.</p>}
    <p className="invite-caption">로그인 후 관리자 승인이 필요해요.</p>
  </Modal>;
}
