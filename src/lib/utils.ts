import type { Category, Member, PollSlot, Role } from './types';
import { formatI18nDate, getLanguage, getLocale, translate } from './i18n';
import { errorCode, reportError } from './telemetry';
export const categoryLabels: Record<Category, string> = {notice:'공지사항',chat:'자유게시판',info:'정보 나눔',gallery:'사진첩'};
export const roleLabels: Record<Role, string> = {leader:'관리자',treasurer:'회계 담당',member:'일반'};
export const uid = () => crypto.randomUUID();
export const today = () => localDate(new Date());
export function localDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) { return formatI18nDate(value,getLanguage(),options ?? {month:'long',day:'numeric',weekday:'short'}); }
export function formatTime(value: Date|string|number) { return formatI18nDate(value,getLanguage(),{hour:'2-digit',minute:'2-digit'}); }
export function shortDate(value: string) { return formatDate(value,{month:'numeric',day:'numeric'}); }
export function relativeDate(value: string) { const diff=Date.now()-new Date(value).getTime(); if(getLanguage()==='en'){if(diff<60_000)return 'Just now';const relative=new Intl.RelativeTimeFormat(getLocale(),{numeric:'auto'});if(diff<3_600_000)return relative.format(-Math.floor(diff/60_000),'minute');if(diff<86_400_000)return relative.format(-Math.floor(diff/3_600_000),'hour');if(diff<7*86_400_000)return relative.format(-Math.floor(diff/86_400_000),'day');return shortDate(value);} if(diff<60_000)return '방금 전'; if(diff<3_600_000)return `${Math.floor(diff/60_000)}분 전`; if(diff<86_400_000)return `${Math.floor(diff/3_600_000)}시간 전`; if(diff<7*86_400_000)return `${Math.floor(diff/86_400_000)}일 전`; return shortDate(value); }
export function slotLabel(slot: PollSlot) { return `${formatDate(slot.date)} ${slot.start}–${slot.end}`; }
export function memberName(members: Member[], id: string) { return members.find(m=>m.id===id)?.name ?? (getLanguage()==='en'?'Member':'멤버'); }
export function errorMessage(error: unknown) {
  const code = errorCode(error);
  reportError(error, {kind:code.startsWith('auth/') ? 'auth':'handled',context:'operation'});
  const authMessages: Record<string,string> = {
    'auth/popup-closed-by-user':'로그인 창이 닫혔어요. 다시 시도해 주세요.',
    'auth/popup-blocked':'팝업이 차단됐어요. 팝업을 허용하거나 Safari·Chrome에서 열어 주세요.',
    'auth/cancelled-popup-request':'로그인이 이미 진행 중이에요. 열린 로그인 창을 확인해 주세요.',
    'auth/web-storage-unsupported':'브라우저의 쿠키와 사이트 저장 공간을 허용한 뒤 다시 시도해 주세요.',
    'auth/operation-not-supported-in-this-environment':'Safari나 Chrome에서 이 사이트를 열어 로그인해 주세요.',
    'auth/member-load-timeout':'로그인 정보를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
    'auth/auth-state-timeout':'로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.',
    'auth/session-changed':'로그인 계정이 변경됐어요. 다시 시도해 주세요.',
    'auth/unauthorized-domain':'이 주소에서는 로그인할 수 없어요. 관리자에게 알려 주세요.',
    'auth/operation-not-allowed':'로그인 준비 중이에요. 관리자에게 알려 주세요.',
    'auth/configuration-not-found':'로그인 준비 중이에요. 관리자에게 알려 주세요.',
    'auth/network-request-failed':'연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.',
    'auth/too-many-requests':'로그인 요청이 많아요. 잠시 후 다시 시도해 주세요.',
    'auth/user-disabled':'이 계정으로 로그인할 수 없어요. 관리자에게 알려 주세요.',
  };
  let message = authMessages[code] ?? (error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.');
  if (code==='permission-denied' || code==='firestore/permission-denied' || message.includes('permission-denied')) message='이 작업을 할 권한이 없어요.';
  else if (code==='unavailable' || code==='firestore/unavailable' || message.includes('unavailable')) message='연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.';
  return translate(message);
}
