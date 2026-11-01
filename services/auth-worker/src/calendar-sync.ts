import {decrypt,encrypt,randomToken,sha256} from './crypto';
import {calendarAllowed} from './calendar-access';
import {ConflictError,HttpError} from './types';
import type {Dependencies,Env,FirebaseIdentity,Mutation,StoredDocument} from './types';
type Data=Record<string,unknown>;
type Snapshot=StoredDocument<Data>|null;
interface Token {accessToken:string;refreshToken?:string;expiresAt:number;scopes:string[]}
export interface SyncProgress {pending:boolean;busy:boolean;synced:number;skipped:number;failed:number}
const BATCH_SIZE=6;
const validId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(value);
const empty=(pending=false,busy=false):SyncProgress=>({pending,busy,synced:0,skipped:0,failed:0});
const put=(path:string,data:Data,old:Snapshot):Mutation=>({path,data,...(old?{version:old.version}:{createOnly:true})});
const check=(path:string,old:Snapshot):Mutation=>({path,verify:true,...(old?{version:old.version}:{createOnly:true})});
const encryptedToken=(record:Snapshot)=>record?.data.encrypted as Parameters<typeof decrypt>[0];
export function calendarPayload(event:Data):Data {
 const start=new Date(`${event.date}T${event.start}:00+09:00`),end=new Date(`${event.date}T${event.end}:00+09:00`);
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||start.getUTCMinutes()%5||end.getUTCMinutes()%5)throw new HttpError(422,'kakao_time_requires_five_minutes');
 return {title:String(event.title??'').slice(0,50),time:{start_at:start.toISOString(),end_at:end.toISOString(),time_zone:'Asia/Seoul',all_day:false,lunar:false},description:`${String(event.description??'')}\n\n장소: ${String(event.location??'')}`.slice(0,5000),location:{name:String(event.location??'').slice(0,100)},reminders:[30]};
}
export function eligibleForEvent(event:Data,rsvp:Data|undefined,poll:Data|undefined,vote:Data|undefined):boolean {
 if(rsvp?.status==='notGoing')return false;if(rsvp?.status==='going')return true;
 const slots=(Array.isArray(poll?.slots)?poll.slots:[]) as {id:string;date:string;start:string;end:string}[];
 const range=slots.filter(slot=>slot.date===event.date&&slot.start>=String(event.start)&&slot.end<=String(event.end)).sort((a,b)=>a.start.localeCompare(b.start));
 return !!range.length&&range[0].start===event.start&&range.at(-1)!.end===event.end&&range.every((slot,index)=>!index||range[index-1].end===slot.start)&&Array.isArray(vote?.slotIds)&&range.every(slot=>(vote!.slotIds as string[]).includes(slot.id));
}
export function createCalendarSyncService(env:Env,deps:Dependencies,verify:(request:Request)=>Promise<FirebaseIdentity>){
 const store=deps.store;
 const many=async(paths:string[])=>store.getMany?store.getMany(paths):new Map(await Promise.all([...new Set(paths)].map(async path=>[path,await store.get(path)] as const)));
 async function queue(eventId:string,uid:string){
  if(!validId(eventId)||!validId(uid))throw new HttpError(400,'invalid_calendar_request');
  const id=`${eventId}_${uid}`,path=`calendarSyncRequests/${id}`;
  for(let attempt=0;attempt<3;attempt++){const old=await store.get(path);try{await store.commit([put(path,{id,eventId,requestedBy:uid,status:'pending',requestedAt:new Date(deps.now()).toISOString()},old)]);return id;}catch(error){if(!(error instanceof ConflictError)||attempt===2)throw error;}}
  throw new HttpError(409,'calendar_sync_in_progress');
 }
 async function setAutomatic(uid:string,enabled:boolean,eventId?:string){
  if(enabled&&!calendarAllowed(env,uid))throw new HttpError(403,'kakao_calendar_not_available');
  const member=await store.get(`members/${uid}`);if(enabled&&member?.data.status!=='active')throw new HttpError(403,'active_membership_required');
  if(enabled){const record=await store.get(`authProviderTokens/${uid}-kakao`);if(!record)throw new HttpError(409,'kakao_calendar_consent_required');const token=await decrypt<Token>(encryptedToken(record),env.TOKEN_ENCRYPTION_KEY!,`authProviderTokens/${uid}-kakao`);if(!token.scopes.includes('talk_calendar'))throw new HttpError(409,'kakao_calendar_consent_required');}
  const path=`authCalendarSettings/${uid}`,old=await store.get(path);await store.commit([...(enabled?[check(`members/${uid}`,member)]:[]),put(path,{enabled,updatedAt:new Date(deps.now()).toISOString()},old)]);
  if(enabled&&eventId)await queue(eventId,uid);
 }
 async function process(id:string):Promise<SyncProgress>{
  if(env.KAKAO_CALENDAR_ENABLED!=='true'||!deps.calendarCall||!deps.refreshKakao||!env.TOKEN_ENCRYPTION_KEY||!store.query)return empty();
  const requestPath=`calendarSyncRequests/${id}`,request=await store.get(requestPath);if(!request)return empty();
  const eventId=request.data.eventId,actorId=request.data.requestedBy;
  if(!validId(eventId)||!validId(actorId)||id!==`${eventId}_${actorId}`)throw new HttpError(400,'invalid_calendar_request');
  const jobPath=`authCalendarJobs/${id}`,oldJob=await store.get(jobPath);
  if(oldJob?.data.status==='processing'&&Number(oldJob.data.leaseUntil)>deps.now())return empty(true,true);
  const actor=await store.get(`members/${actorId}`);if(actor?.data.status!=='active'){await store.commit([{path:requestPath,remove:true,version:request.version}]);return empty();}
  const admin=actor.data.role==='leader',event=await store.get(`events/${eventId}`);
  const [members,links]=await Promise.all([admin?store.query('members','status','active'):Promise.resolve([actor]),store.query('authCalendarLinks','eventId',eventId)]);
  let poll:Snapshot=null,votes:StoredDocument<Data>[]=[];
  if(event&&validId(event.data.pollId)){poll=await store.get(`polls/${event.data.pollId}`);votes=await store.query('votes','pollId',event.data.pollId);}
  const candidates=[...new Set([...(admin?members.map(item=>String(item.data.id)):[actorId]),...links.filter(item=>admin||item.data.uid===actorId).map(item=>String(item.data.uid))])].filter(uid=>validId(uid)&&calendarAllowed(env,uid)).sort();
  const sameRevision=oldJob?.data.requestVersion===request.version;
  const completed=new Set<string>(sameRevision&&Array.isArray(oldJob?.data.completed)?oldJob!.data.completed as string[]:[]);
  const batch=candidates.filter(uid=>!completed.has(uid)).slice(0,BATCH_SIZE);
  const snapshot=await many(batch.flatMap(uid=>[`members/${uid}`,`rsvps/${eventId}_${uid}`,`authCalendarSettings/${uid}`,`authProviderTokens/${uid}-kakao`]));
  const operation=randomToken(),now=new Date(deps.now()).toISOString();
  const counts:SyncProgress={pending:false,busy:false,synced:sameRevision?Number(oldJob?.data.synced)||0:0,skipped:sameRevision?Number(oldJob?.data.skipped)||0:0,failed:sameRevision?Number(oldJob?.data.failed)||0:0};
  const job:Data={id,eventId,requestedBy:actorId,requestVersion:request.version,completed:[...completed],...counts,status:'processing',operation,leaseUntil:deps.now()+60000,updatedAt:now};
  try{await store.commit([check(requestPath,request),check(`members/${actorId}`,actor),put(jobPath,job,oldJob)]);}catch(error){if(error instanceof ConflictError)return empty(true,true);throw error;}
  type Action={uid:string;path:string;old:Snapshot;token:Token;tokenRecord:Snapshot;remove:boolean;signature:string;guards:Mutation[]};
  const actions:Action[]=[];let waiting=false;
  try{
  const principals=new Map(await Promise.all(batch.map(async uid=>[uid,await deps.lookupUser(uid)] as const)));
  for(const uid of batch){
   const member=snapshot.get(`members/${uid}`)??null,rsvp=snapshot.get(`rsvps/${eventId}_${uid}`)??null,settings=snapshot.get(`authCalendarSettings/${uid}`)??null,record=snapshot.get(`authProviderTokens/${uid}-kakao`)??null;
   const path=`authCalendarLinks/${await sha256(`${uid}\u0000${eventId}`)}`,old=links.find(item=>item.data.uid===uid)??null;
   if(settings?.data.enabled!==true||!record){completed.add(uid);counts.skipped++;continue;}
   const principal=principals.get(uid);if(!principal||principal.disabled){completed.add(uid);counts.skipped++;continue;}
   const vote=votes.find(item=>item.data.memberId===uid);
   const remove=!event||member?.data.status!=='active'||!eligibleForEvent(event.data,rsvp?.data,poll?.data,vote?.data);
   let token:Token;try{token=await decrypt<Token>(encryptedToken(record),env.TOKEN_ENCRYPTION_KEY!,`authProviderTokens/${uid}-kakao`);}catch{completed.add(uid);counts.failed++;continue;}
   if(!token.scopes.includes('talk_calendar')){completed.add(uid);counts.skipped++;continue;}
   if(old?.data.status==='processing'){
    if(!old.data.kakaoEventId){completed.add(uid);counts.failed++;continue;}
    if(Date.parse(String(old.data.updatedAt))+60000>deps.now()){waiting=true;continue;}
   }
   let signature:string;try{signature=remove?'deleted':await sha256(JSON.stringify(calendarPayload(event!.data)));}catch{completed.add(uid);counts.failed++;continue;}
   if((remove&&!old?.data.kakaoEventId)||(!remove&&old?.data.status==='synced'&&old.data.signature===signature)){completed.add(uid);counts.skipped++;continue;}
   const guards=[check(`members/${uid}`,member),check(`authCalendarSettings/${uid}`,settings),check(`rsvps/${eventId}_${uid}`,rsvp),check(`events/${eventId}`,event)];
   if(event&&poll&&!rsvp){guards.push(check(`polls/${event.data.pollId}`,poll),check(`votes/${event.data.pollId}_${uid}`,vote??null));}
   actions.push({uid,path,old,token,tokenRecord:record,remove,signature,guards});
  }
   const ready:Action[]=[];const refreshed:Mutation[]=[];
   await Promise.all(actions.map(async action=>{
    if(action.token.expiresAt<=deps.now()+30000){
     if(!action.token.refreshToken){completed.add(action.uid);counts.failed++;return;}
     try{const fresh=await deps.refreshKakao!(action.token.refreshToken);action.token={...action.token,...fresh,refreshToken:fresh.refreshToken??action.token.refreshToken,scopes:fresh.scopes??action.token.scopes};if(!action.token.scopes.includes('talk_calendar')){completed.add(action.uid);counts.failed++;return;}refreshed.push(put(`authProviderTokens/${action.uid}-kakao`,{encrypted:await encrypt(action.token,env.TOKEN_ENCRYPTION_KEY!,`authProviderTokens/${action.uid}-kakao`),updatedAt:now},action.tokenRecord));}catch(error){if(error instanceof HttpError&&[400,401,403].includes(error.status)){completed.add(action.uid);counts.failed++;}else waiting=true;return;}
    }
    ready.push(action);
   }));
   if(refreshed.length){await store.commit(refreshed);const current=await many(ready.map(item=>`authProviderTokens/${item.uid}-kakao`));for(const action of ready){const path=`authProviderTokens/${action.uid}-kakao`,record=current.get(path)??null,expected=refreshed.find(write=>write.path===path);if(expected&&JSON.stringify(record?.data.encrypted)!==JSON.stringify(expected.data?.encrypted))throw new ConflictError();action.tokenRecord=record;}}
   if(ready.length){
    const guards=new Map<string,Mutation>();for(const action of ready){for(const guard of action.guards)guards.set(guard.path,guard);guards.set(`authProviderTokens/${action.uid}-kakao`,check(`authProviderTokens/${action.uid}-kakao`,action.tokenRecord));}
    await store.commit([check(requestPath,request),check(`members/${actorId}`,actor),...guards.values(),...ready.map(action=>put(action.path,{...action.old?.data,uid:action.uid,eventId,status:'processing',operation,updatedAt:now},action.old))]);
    const outcomes=new Map<string,{id?:string;rejected?:boolean}>();
    await Promise.all(ready.map(async action=>{try{if(action.remove){if(!deps.calendarDelete)throw new HttpError(503,'kakao_calendar_not_configured');await deps.calendarDelete(action.token.accessToken,String(action.old!.data.kakaoEventId));outcomes.set(action.uid,{});}else{const id=await deps.calendarCall!(action.token.accessToken,typeof action.old?.data.kakaoEventId==='string'?action.old.data.kakaoEventId:null,calendarPayload(event!.data));outcomes.set(action.uid,{id});}}catch(error){outcomes.set(action.uid,{rejected:error instanceof HttpError&&[400,401,403,404,422].includes(error.status)});}}));
    const claimed=await many(ready.map(action=>action.path));const finish:Mutation[]=[];
    for(const action of ready){
     const current=claimed.get(action.path)??null;if(current?.data.operation!==operation){waiting=true;continue;}
     const result=outcomes.get(action.uid)!;
     if('rejected' in result){if(!result.rejected&&action.old?.data.kakaoEventId){waiting=true;continue;}completed.add(action.uid);counts.failed++;if(result.rejected)finish.push(action.old?put(action.path,action.old.data,current):{path:action.path,remove:true,version:current.version});continue;}
     completed.add(action.uid);counts.synced++;finish.push(put(action.path,{uid:action.uid,eventId,status:action.remove?'deleted':'synced',signature:action.signature,updatedAt:now,...(result.id?{kakaoEventId:result.id}:{})},current));
    }
    if(finish.length)await store.commit(finish);
   }
  }catch(error){
   const current=await store.get(jobPath);if(current?.data.operation===operation)await store.commit([put(jobPath,{...current.data,status:'queued',leaseUntil:0,updatedAt:now},current)]);
   if(error instanceof ConflictError)return empty(true,true);throw error;
  }
  const [latestRequest,currentJob]=await Promise.all([store.get(requestPath),store.get(jobPath)]);
  if(currentJob?.data.operation!==operation)return empty(true,true);
  const allDone=candidates.every(uid=>completed.has(uid));const sameRequest=latestRequest?.version===request.version;
  counts.pending=!allDone||!!latestRequest&&!sameRequest;counts.busy=waiting&&!allDone;
  const writes=[put(jobPath,{...job,...counts,completed:[...completed],status:allDone?'done':'queued',leaseUntil:0},currentJob)];
  if(allDone&&sameRequest)writes.push({path:requestPath,remove:true,version:request.version});
  await store.commit(writes);return counts;
 }
 async function synchronize(request:Request,eventId:string){
  const actor=await verify(request);const member=await store.get(`members/${actor.uid}`);if(member?.data.status!=='active')throw new HttpError(403,'active_membership_required');
  if(!validId(eventId))throw new HttpError(400,'invalid_calendar_request');
  const job=process(`${eventId}_${actor.uid}`);deps.waitUntil?.(job.catch(()=>{}));return job;
 }
 return {queue,setAutomatic,process,synchronize,async runPending(){if(env.KAKAO_CALENDAR_ENABLED!=='true'||!store.query)return;const requests=await store.query('calendarSyncRequests','status','pending');const next=requests.sort((a,b)=>String(a.data.requestedAt).localeCompare(String(b.data.requestedAt)))[0];if(next&&typeof next.data.id==='string')return process(next.data.id);}};
}
