import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup } from 'firebase/auth';
import { auth, isDemo } from './firebase';
import type { CalendarLink, MoimEvent } from './types';

const API='https://www.googleapis.com/calendar/v3/calendars/primary/events';
const SCOPE='https://www.googleapis.com/auth/calendar.events.owned';
let access:{token:string;ownerId:string;expiresAt:number}|null=null;
if(auth)onAuthStateChanged(auth,user=>{if(access?.ownerId!==user?.uid)access=null;});
export const hasGoogleCalendarAccess=()=>Boolean(auth?.currentUser&&access?.ownerId===auth.currentUser.uid&&access.expiresAt>Date.now());
export async function connectGoogleCalendar():Promise<void>{
  if(isDemo)throw new Error('데모에서는 초대를 보내지 않아요.');
  if(!auth?.currentUser)throw new Error('먼저 로그인해 주세요.');
  const provider=new GoogleAuthProvider();provider.addScope(SCOPE);provider.setCustomParameters({prompt:'consent',login_hint:auth.currentUser.email||''});
  const result=await reauthenticateWithPopup(auth.currentUser,provider);
  const token=GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if(!token)throw new Error('캘린더 연결을 완료하지 못했어요. 다시 연결해 주세요.');
  access={token,ownerId:result.user.uid,expiresAt:Date.now()+50*60*1000};
}
export const calendarSignature=(event:MoimEvent,attendeeIds:string[])=>JSON.stringify([event.title,event.description,event.date,event.start,event.end,event.location,[...new Set(attendeeIds)].sort()]);
export interface CalendarAttendee {id:string;email:string;name:string}
export function buildGoogleCalendarPayload(event:MoimEvent,attendees:CalendarAttendee[]){
  const seen=new Set<string>();
  return {summary:event.title,description:event.description,location:event.location,
    start:{dateTime:`${event.date}T${event.start}:00+09:00`,timeZone:'Asia/Seoul'},end:{dateTime:event.end==='24:00'?new Date(`${event.date}T24:00:00+09:00`).toISOString():`${event.date}T${event.end}:00+09:00`,timeZone:'Asia/Seoul'},
    attendees:attendees.filter(person=>{const email=person.email.trim().toLowerCase();if(!email||seen.has(email))return false;seen.add(email);return true;}).map(person=>({email:person.email.trim().toLowerCase(),displayName:person.name})),
    guestsCanModify:false,guestsCanInviteOthers:false,extendedProperties:{private:{moimEventId:event.id}},reminders:{useDefault:true}};
}
interface GoogleEvent {id:string;htmlLink?:string;status?:string;extendedProperties?:{private?:{moimEventId?:string}};attendees?:{email:string;responseStatus?:string}[]}
class CalendarRequestError extends Error {constructor(public status:number,message:string){super(message);}}
async function request(method:string,path:string,body?:unknown):Promise<GoogleEvent>{
  if(!hasGoogleCalendarAccess()||!access)throw new Error('Google 캘린더를 다시 연결해 주세요.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(`${API}${path}`,{method,headers:{Authorization:`Bearer ${access.token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});
    if(!response.ok){
      if(response.status===401){access=null;throw new CalendarRequestError(401,'연결 시간이 만료됐어요. Google 캘린더를 다시 연결해 주세요.');}
      if(response.status===403)throw new CalendarRequestError(403,'캘린더 접근 권한을 확인한 뒤 다시 연결해 주세요.');
      if(response.status===429)throw new CalendarRequestError(429,'요청이 많아요. 잠시 후 다시 시도해 주세요.');
      throw new CalendarRequestError(response.status,'캘린더에 반영하지 못했어요. 다시 시도해 주세요.');
    }
    return await response.json() as GoogleEvent;
  }catch(error){if(error instanceof CalendarRequestError)throw error;if(error instanceof Error&&error.name==='AbortError')throw new Error('응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.');throw error;}
  finally{clearTimeout(timer);}
}
async function googleId(id:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id)));return `moim${[...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')}`;}
function safeCalendarLink(value?:string){try{const url=new URL(value||'');if(url.protocol!=='https:')return 'https://calendar.google.com/';if(url.hostname==='www.google.com'&&url.pathname.startsWith('/calendar/'))url.hostname='calendar.google.com';return url.hostname==='calendar.google.com'?url.toString():'https://calendar.google.com/';}catch{return 'https://calendar.google.com/';}}
export async function syncGoogleCalendarEvent(event:MoimEvent,attendees:CalendarAttendee[]):Promise<CalendarLink>{
  if(isDemo)throw new Error('데모에서는 초대를 보내지 않아요.');
  if(!auth?.currentUser||!hasGoogleCalendarAccess())throw new Error('Google 캘린더를 먼저 연결해 주세요.');
  const ownerId=auth.currentUser.uid;
  if(event.calendarLink&&event.calendarLink.ownerId!==ownerId)throw new Error('이 일정을 연결한 관리자만 변경할 수 있어요.');
  const selected=attendees.filter(person=>person.id!==ownerId);
  const payload=buildGoogleCalendarPayload(event,selected);
  let id=event.calendarLink?.googleEventId||await googleId(event.id);
  let existing:GoogleEvent|null=null;
  try{existing=await request('GET',`/${encodeURIComponent(id)}`);}catch(error){if(!(error instanceof CalendarRequestError)||![404,410].includes(error.status))throw error;}
  if(existing?.status==='cancelled'){existing=null;id=await googleId(`${event.id}:${crypto.randomUUID()}`);}
  if(existing?.extendedProperties?.private?.moimEventId&&existing.extendedProperties.private.moimEventId!==event.id)throw new Error('다른 캘린더 일정과 중복되어 저장하지 못했어요.');
  const body={...payload,attendees:payload.attendees.map(person=>{const previous=existing?.attendees?.find(value=>value.email.toLowerCase()===person.email);return {...person,...(previous?.responseStatus?{responseStatus:previous.responseStatus}:{})};})};
  let saved:GoogleEvent;
  if(existing)saved=await request('PATCH',`/${encodeURIComponent(id)}?sendUpdates=all`,body);
  else {try{saved=await request('POST','?sendUpdates=all',{...body,id});}catch(error){if(!(error instanceof CalendarRequestError)||error.status!==409)throw error;const conflict=await request('GET',`/${encodeURIComponent(id)}`);if(conflict.extendedProperties?.private?.moimEventId!==event.id)throw new Error('같은 식별자의 일정이 있어 저장하지 못했어요.');saved=await request('PATCH',`/${encodeURIComponent(id)}?sendUpdates=all`,body);}}
  return {ownerId,googleEventId:saved.id||id,htmlLink:safeCalendarLink(saved.htmlLink),syncedAt:new Date().toISOString(),attendeeIds:selected.map(person=>person.id),signature:calendarSignature(event,selected.map(person=>person.id))};
}
