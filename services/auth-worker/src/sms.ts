import {sha256} from './crypto';
import {ConflictError,HttpError} from './types';
import type {Dependencies,Env,FirebaseIdentity,Mutation,StoredDocument} from './types';
import type {SmsProviderResult} from './sms-provider';

type Doc=Record<string,unknown>;
type RecipientStatus='ready'|'accepted'|'rejected'|'unknown'|'processing'|'missing_phone'|'invalid_phone'|'duplicate';
export interface SmsRecipient {memberId:string;name:string;phone:string;status:RecipientStatus}
interface Target {id:string;to:string;members:string[];masked:string;status:RecipientStatus}
export interface SmsPreview {eventId:string;fingerprint:string;message:string;type:'LMS';recipients:SmsRecipient[];readyCount:number;estimatedCost:number;unitPrice:number;enabled:boolean;autoEnabled:boolean}
export function normalizeKoreanPhone(value:unknown):string|null {if(typeof value!=='string')return null;let digits=value.replace(/[\s()+.-]/g,'');if(digits.startsWith('0082'))digits='0'+digits.slice(4);else if(digits.startsWith('82'))digits='0'+digits.slice(2);return /^(?:010\d{8}|01[16789]\d{7,8})$/.test(digits)?digits:null;}
export const maskPhone=(phone:string)=>`${phone.slice(0,3)}-****-${phone.slice(-4)}`;
export const smsConfigured=(env:Env)=>env.SMS_ENABLED==='true'&&!!env.SOLAPI_API_KEY&&!!env.SOLAPI_API_SECRET&&/^\d{8,11}$/.test(env.SOLAPI_SENDER?.replace(/\D/g,'')??'')&&!!env.FIREBASE_PROJECT_ID&&!!env.FIREBASE_CLIENT_EMAIL&&!!env.FIREBASE_PRIVATE_KEY;
const safe=(value:unknown,max:number)=>String(value??'').replace(/[\u0000-\u001f\u007f]|[\u{10000}-\u{10ffff}]|\p{Extended_Pictographic}|\uFE0F|\u200D/gu,' ').trim().slice(0,max);
function messageFor(event:Doc,club:Doc,eventId:string){return `[${safe(club.name,40)||'모임'}] 일정 확정\n${safe(event.title,80)}\n${safe(event.date,10)} ${safe(event.start,5)}–${safe(event.end,5)}\n장소: ${safe(event.location,200)}\nhttps://moim-juno.web.app/calendar?event=${encodeURIComponent(eventId)}`;}
const statusFor=(record:StoredDocument<Doc>|undefined):RecipientStatus=>['accepted','rejected','unknown','processing'].includes(String(record?.data.status))?record!.data.status as RecipientStatus:'ready';
const guard=(collection:string,item:StoredDocument<Doc>):Mutation=>({path:`${collection}/${item.data.id}`,verify:true,version:item.version});

export function createSmsService(env:Env,deps:Dependencies,verify:(request:Request)=>Promise<FirebaseIdentity>) {
 async function administrator(request:Request){const actor=await verify(request);const member=await deps.store.get(`members/${actor.uid}`);if(member?.data.status!=='active'||member.data.role!=='leader')throw new HttpError(403,'sms_admin_required');return {actor,adminGuard:{path:`members/${actor.uid}`,verify:true,version:member.version} as Mutation};}
 async function prepare(eventId:string){
  if(!/^[A-Za-z0-9:_-]{1,128}$/.test(eventId)||!deps.store.query)throw new HttpError(503,'sms_unavailable');
  const event=await deps.store.get(`events/${eventId}`),club=await deps.store.get('settings/club');if(!event)throw new HttpError(404,'event_not_found');
  const members=await deps.store.query('members','status','active');if(members.length>30)throw new HttpError(422,'sms_audience_too_large');
  const rsvps=await deps.store.query('rsvps','eventId',eventId);let votes:StoredDocument<Doc>[]=[];let poll:StoredDocument<Doc>|null=null;
  if(typeof event.data.pollId==='string'){poll=await deps.store.get(`polls/${event.data.pollId}`);votes=await deps.store.query('votes','pollId',event.data.pollId);}
  const slots=(Array.isArray(poll?.data.slots)?poll.data.slots:[]) as {id:string;date:string;start:string;end:string}[];
  const range=slots.filter(slot=>slot.date===event.data.date&&slot.start>=String(event.data.start)&&slot.end<=String(event.data.end)).sort((a,b)=>a.start.localeCompare(b.start));
  const wholeRange=!!range.length&&range[0].start===event.data.start&&range.at(-1)!.end===event.data.end&&range.every((slot,index)=>!index||range[index-1].end===slot.start);
  const eligible=members.filter(member=>{const rsvp=rsvps.find(item=>item.data.memberId===member.data.id);if(rsvp?.data.status==='notGoing')return false;if(rsvp?.data.status==='going')return true;const vote=votes.find(item=>item.data.memberId===member.data.id);return wholeRange&&Array.isArray(vote?.data.slotIds)&&range.every(slot=>(vote!.data.slotIds as string[]).includes(slot.id));});
  const profiles=await Promise.all(eligible.map(member=>deps.store.get(`profiles/${member.data.id}`)));
  const message=messageFor(event.data,club?.data??{},eventId);if(new TextEncoder().encode(message).length>1900)throw new HttpError(422,'sms_message_too_long');
  const signature=await sha256(JSON.stringify([eventId,message,env.SOLAPI_SENDER?.replace(/\D/g,'')]));
  const logs=await deps.store.query('smsDeliveries','eventId',eventId);const recipients:SmsRecipient[]=[];const byPhone=new Map<string,Target>();const revision:unknown[]=[];
  for(let index=0;index<eligible.length;index++){
   const member=eligible[index],profile=profiles[index];const memberId=String(member.data.id),name=safe(member.data.name,30);const raw=profile?.data.phone;const to=normalizeKoreanPhone(raw);revision.push([memberId,member.version,profile?.version??null,to]);
   if(!to){recipients.push({memberId,name,phone:'',status:raw?'invalid_phone':'missing_phone'});continue;}
   const other=byPhone.get(to);if(other){other.members.push(memberId);recipients.push({memberId,name,phone:maskPhone(to),status:'duplicate'});continue;}
   const id=await sha256(`${eventId}\0${signature}\0${to}`);const status=statusFor(logs.find(log=>log.data.id===id));byPhone.set(to,{id,to,members:[memberId],masked:maskPhone(to),status});recipients.push({memberId,name,phone:maskPhone(to),status});
  }
  const unit=Number(env.SOLAPI_LMS_UNIT_PRICE??45);const unitPrice=Number.isFinite(unit)&&unit>0?unit:45;
  const targets=[...byPhone.values()];const ready=targets.filter(target=>target.status==='ready');
  const fingerprint=await sha256(JSON.stringify([event.version,club?.version,signature,revision,rsvps.map(item=>[item.data.id,item.version]),votes.map(item=>[item.data.id,item.version])]));
  const guards:Mutation[]=[{path:`events/${eventId}`,verify:true,version:event.version},...members.map(item=>guard('members',item)),...eligible.flatMap((_,index)=>profiles[index]?[{path:`profiles/${eligible[index].data.id}`,verify:true,version:profiles[index]!.version}]:[]),...rsvps.map(item=>guard('rsvps',item)),...eligible.filter(member=>!rsvps.some(item=>item.data.memberId===member.data.id)).map(member=>({path:`rsvps/${eventId}_${member.data.id}`,verify:true,createOnly:true})),...votes.map(item=>guard('votes',item)),...(poll?[{path:`polls/${event.data.pollId}`,verify:true,version:poll.version}]:[]),...(club?[{path:'settings/club',verify:true,version:club.version}]:[])];
  const preview:SmsPreview={eventId,fingerprint,message,type:'LMS',recipients,readyCount:ready.length,estimatedCost:Math.round(ready.length*unitPrice*1.1*100)/100,unitPrice,enabled:smsConfigured(env)&&club?.data.smsEnabled===true,autoEnabled:club?.data.smsAutoOnConfirm===true};
  return {preview,targets:ready,guards};
 }
 return {async preview(request:Request,eventId:string){await administrator(request);return (await prepare(eventId)).preview;},async send(request:Request,eventId:string,value:Doc){
  const {actor,adminGuard}=await administrator(request);const data=await prepare(eventId);if(value.fingerprint!==data.preview.fingerprint)throw new HttpError(409,'sms_preview_stale');if(!data.preview.enabled||!deps.sendSms)throw new HttpError(503,'sms_not_enabled');if(value.automatic===true&&!data.preview.autoEnabled)throw new HttpError(403,'sms_auto_disabled');if(!data.targets.length)return {preview:data.preview,results:[]};
  const now=new Date(deps.now()).toISOString();const writes=data.targets.map(target=>({path:`smsDeliveries/${target.id}`,createOnly:true,data:{id:target.id,eventId,memberIds:target.members,maskedPhone:target.masked,status:'processing',actorId:actor.uid,createdAt:now,updatedAt:now}}));
  try{await deps.store.commit([...data.guards,adminGuard,...writes]);}catch(error){if(error instanceof ConflictError)throw new HttpError(409,'sms_preview_stale');throw error;}
  let results:SmsProviderResult[];try{results=await deps.sendSms(data.targets.map(target=>({id:target.id,to:target.to,text:data.preview.message})));}catch{results=data.targets.map(target=>({id:target.id,status:'unknown'}));}
  const complete=data.targets.map(target=>{const result=results.find(item=>item.id===target.id)??{id:target.id,status:'unknown' as const};return {path:`smsDeliveries/${target.id}`,data:{...writes.find(write=>write.data.id===target.id)!.data,status:result.status,...(result.messageId?{messageId:result.messageId}:{}),...(result.groupId?{groupId:result.groupId}:{}),...(result.code?{providerCode:result.code}:{}),updatedAt:new Date(deps.now()).toISOString()}};});
  // If recording fails the existing processing claim remains: callers must not resend automatically.
  await deps.store.commit(complete);const nextRecipients=data.preview.recipients.map(recipient=>{const target=data.targets.find(item=>item.members.includes(recipient.memberId));const result=target?results.find(item=>item.id===target.id):undefined;return result&&recipient.status==='ready'?{...recipient,status:result.status}:recipient;});return {preview:{...data.preview,recipients:nextRecipients,readyCount:0,estimatedCost:0},results:results.map(({id,status,messageId,groupId,code})=>({id,status,messageId,groupId,code}))};
 }};
}
