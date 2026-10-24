import type { Category, Member, PollSlot, Role } from './types';
export const categoryLabels: Record<Category, string> = {notice:'공지사항',chat:'자유게시판',info:'정보 나눔',gallery:'사진첩'};
export const roleLabels: Record<Role, string> = {leader:'관리자',treasurer:'회계 담당',member:'일반'};
export const uid = () => crypto.randomUUID();
export const today = () => localDate(new Date());
export function localDate(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function formatDate(value: string, options?: Intl.DateTimeFormatOptions) { return new Intl.DateTimeFormat('ko-KR',options ?? {month:'long',day:'numeric',weekday:'short'}).format(new Date(value.length===10 ? `${value}T12:00:00` : value)); }
export function shortDate(value: string) { return formatDate(value,{month:'numeric',day:'numeric'}); }
export function relativeDate(value: string) { const diff=Date.now()-new Date(value).getTime(); if(diff<60_000)return '방금 전'; if(diff<3_600_000)return `${Math.floor(diff/60_000)}분 전`; if(diff<86_400_000)return `${Math.floor(diff/3_600_000)}시간 전`; if(diff<7*86_400_000)return `${Math.floor(diff/86_400_000)}일 전`; return shortDate(value); }
export function slotLabel(slot: PollSlot) { return `${formatDate(slot.date)} ${slot.start}–${slot.end}`; }
export function memberName(members: Member[], id: string) { return members.find(m=>m.id===id)?.name ?? '멤버'; }
export function errorMessage(error: unknown) { if(error instanceof Error) { if(error.message.includes('permission-denied'))return '이 작업을 할 권한이 없어요.'; if(error.message.includes('auth/popup-closed'))return '로그인 창이 닫혔어요. 다시 시도해 주세요.'; if(error.message.includes('auth/popup-blocked'))return '팝업이 차단됐어요. 로그인 팝업을 허용해 주세요.'; if(error.message.includes('auth/unauthorized-domain'))return '이 주소에서는 로그인할 수 없어요. 관리자에게 알려 주세요.'; if(error.message.includes('auth/operation-not-allowed')||error.message.includes('auth/configuration-not-found'))return '로그인 준비 중이에요. 관리자에게 알려 주세요.'; if(error.message.includes('auth/network-request-failed')||error.message.includes('unavailable'))return '연결이 원활하지 않아요. 잠시 후 다시 시도해 주세요.'; return error.message; } return '잠시 후 다시 시도해 주세요.'; }
