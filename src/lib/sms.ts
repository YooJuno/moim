import {auth} from './firebase';
import {getAuthAPIURL} from './social-auth';
export type SmsStatus='ready'|'accepted'|'rejected'|'unknown'|'processing'|'missing_phone'|'invalid_phone'|'duplicate';
export interface SmsRecipient {memberId:string;name:string;phone:string;status:SmsStatus}
export interface SmsPreview {eventId:string;fingerprint:string;message:string;type:'LMS';recipients:SmsRecipient[];readyCount:number;estimatedCost:number;unitPrice:number;enabled:boolean;autoEnabled:boolean}
const messages:Record<string,string>={sms_admin_required:'관리자만 문자를 보낼 수 있어요.',sms_preview_stale:'일정이나 대상이 변경됐어요. 미리보기를 다시 확인해 주세요.',sms_not_enabled:'문자 발송 설정을 먼저 완료해 주세요.',sms_audience_too_large:'문자 대상은 한 번에 30명까지 확인할 수 있어요.',sms_auto_disabled:'자동 문자 알림이 꺼져 있어요.',sms_unavailable:'문자 알림 서버를 연결해 주세요.'};
async function smsRequest<T>(eventId:string,action:'preview'|'send',body:Record<string,unknown>={}):Promise<T>{
 const base=getAuthAPIURL();if(!base||!auth)throw new Error('문자 알림 서버를 연결해 주세요.');await auth.authStateReady();const user=auth.currentUser;if(!user)throw new Error('로그인이 필요해요.');
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),30000);
 try{const token=await user.getIdToken();if(auth.currentUser?.uid!==user.uid)throw new Error('로그인 계정이 변경됐어요. 다시 확인해 주세요.');const response=await fetch(new URL(`notifications/sms/events/${encodeURIComponent(eventId)}/${action}`,base),{method:'POST',credentials:'omit',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json();if(auth.currentUser?.uid!==user.uid)throw new Error('로그인 계정이 변경됐어요. 다시 확인해 주세요.');if(!response.ok)throw new Error(messages[data.error]??'문자 처리 결과를 확인하지 못했어요. 발송 내역을 확인해 주세요.');return data as T;}
 catch(error){if(error instanceof Error&&error.name!=='AbortError'&&error.name!=='TypeError')throw error;throw new Error('연결이 끊겼어요. 다시 보내기 전에 발송 내역을 확인해 주세요.');}finally{clearTimeout(timer);}
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const statuses:SmsStatus[]=['ready','accepted','rejected','unknown','processing','missing_phone','invalid_phone','duplicate'];
export function parseSmsPreview(value:unknown,eventId:string):SmsPreview {
 if(!object(value)||value.eventId!==eventId||typeof value.fingerprint!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(value.fingerprint)||typeof value.message!=='string'||value.message.length>2000||value.type!=='LMS'||!Array.isArray(value.recipients)||value.recipients.length>200||!Number.isInteger(value.readyCount)||Number(value.readyCount)<0||Number(value.readyCount)>30||typeof value.estimatedCost!=='number'||!Number.isFinite(value.estimatedCost)||value.estimatedCost<0||typeof value.unitPrice!=='number'||!Number.isFinite(value.unitPrice)||value.unitPrice<=0||typeof value.enabled!=='boolean'||typeof value.autoEnabled!=='boolean')throw new Error('문자 미리보기 응답을 확인하지 못했어요.');
 for(const item of value.recipients)if(!object(item)||typeof item.memberId!=='string'||typeof item.name!=='string'||typeof item.phone!=='string'||(item.phone!==''&&!/^01[016789]-\*{4}-\d{4}$/.test(item.phone))||!statuses.includes(item.status as SmsStatus))throw new Error('문자 대상 응답을 확인하지 못했어요.');
 return value as unknown as SmsPreview;
}
export async function previewEventSms(eventId:string):Promise<SmsPreview>{return parseSmsPreview(await smsRequest<unknown>(eventId,'preview'),eventId);}
export async function sendEventSms(eventId:string,fingerprint:string,automatic=false):Promise<{preview:SmsPreview;results:{id:string;status:'accepted'|'rejected'|'unknown'}[]}>{
 const value=await smsRequest<unknown>(eventId,'send',{fingerprint,...(automatic?{automatic:true}:{})});if(!object(value)||!Array.isArray(value.results)||value.results.length>30||value.results.some(item=>!object(item)||typeof item.id!=='string'||!['accepted','rejected','unknown'].includes(String(item.status))))throw new Error('문자 처리 응답을 확인하지 못했어요. 발송 내역을 확인해 주세요.');
 return {preview:parseSmsPreview(value.preview,eventId),results:value.results as {id:string;status:'accepted'|'rejected'|'unknown'}[]};
}
/** Called only after an administrator explicitly enables server and club automatic notifications. */
export async function notifyEventConfirmed(eventId:string):Promise<void>{if(!getAuthAPIURL())return;const preview=await previewEventSms(eventId);if(!preview.enabled||!preview.autoEnabled||!preview.readyCount)return;await sendEventSms(eventId,preview.fingerprint,true);}
