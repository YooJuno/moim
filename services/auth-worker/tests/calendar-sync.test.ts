import {beforeEach,expect,it,vi} from 'vitest';
import {createCalendarSyncService,eligibleForEvent} from '../src/calendar-sync';
import {encrypt,sha256} from '../src/crypto';
import {ConflictError,HttpError} from '../src/types';
import type {Dependencies,Env,Mutation,Store,StoredDocument} from '../src/types';

class MemoryStore implements Store {
 values=new Map<string,StoredDocument>();revision=0;cost=0;beforeCommit?: (writes:Mutation[])=>Promise<void>;
 async get<T=Record<string,unknown>>(path:string){this.cost++;return structuredClone(this.values.get(path)??null) as StoredDocument<T>|null;}
 async getMany(paths:string[]){this.cost++;return new Map(paths.map(path=>[path,structuredClone(this.values.get(path)??null)]));}
 async query<T=Record<string,unknown>>(collection:string,field:string,value:string){this.cost++;return [...this.values].filter(([path,record])=>path.startsWith(collection+'/')&&record.data[field]===value).map(([,record])=>structuredClone(record) as StoredDocument<T>);}
 async commit(writes:Mutation[]){this.cost+=writes.some(w=>w.verify)?3:1;await this.beforeCommit?.(writes);for(const w of writes){const old=this.values.get(w.path);if((w.createOnly&&old)||(w.version&&w.version!==old?.version))throw new ConflictError();}for(const w of writes){if(w.verify)continue;if(w.remove)this.values.delete(w.path);else this.values.set(w.path,{data:structuredClone(w.data??{}),version:String(++this.revision)});}}
 async seed(path:string,data:Record<string,unknown>){await this.commit([{path,data}]);}
}
const env:Env={FIREBASE_PROJECT_ID:'demo',ALLOWED_ORIGINS:'https://app.test',TOKEN_ENCRYPTION_KEY:'B'.repeat(43),KAKAO_CALENDAR_ENABLED:'true'};
const event={id:'e1',title:'농구',date:'2026-11-10',start:'14:00',end:'16:00',location:'서울',pollId:'p1'};
const slots=[{id:'a',date:event.date,start:'14:00',end:'15:00'},{id:'b',date:event.date,start:'15:00',end:'16:00'}];
let store:MemoryStore,deps:Dependencies,service:ReturnType<typeof createCalendarSyncService>,now:number;
async function member(uid:string,options:{automatic?:boolean;status?:string;role?:string;expired?:boolean;scopes?:string[]}={}){
 await store.seed(`members/${uid}`,{id:uid,status:options.status??'active',role:options.role??'member'});
 await store.seed(`authCalendarSettings/${uid}`,{enabled:options.automatic!==false});
 const path=`authProviderTokens/${uid}-kakao`;
 await store.seed(path,{encrypted:await encrypt({accessToken:uid,refreshToken:`refresh-${uid}`,expiresAt:now+(options.expired?-1:3600000),scopes:options.scopes??['talk_calendar']},env.TOKEN_ENCRYPTION_KEY!,path)});
}
async function going(uid:string,status='going'){await store.seed(`rsvps/e1_${uid}`,{id:`e1_${uid}`,eventId:'e1',memberId:uid,status});}
async function run(){const id=await service.queue('e1','leader');return service.process(id);}
const linkPath=async(uid:string)=>`authCalendarLinks/${await sha256(`${uid}\u0000e1`)}`;
beforeEach(async()=>{
 now=Date.now();store=new MemoryStore();deps={store,now:()=>now,lookupUser:vi.fn(async uid=>{store.cost++;return {uid};}),verifyIdToken:async()=>({uid:'leader'}),createUser:async()=>{},customToken:async()=>'',providerExchange:async()=>{throw Error('No external OAuth');},calendarCall:vi.fn(async(token,id)=>{store.cost++;return id??`external-${token}`;}),calendarDelete:vi.fn(async()=>{store.cost++;}),refreshKakao:vi.fn(async(token)=>{store.cost++;return {accessToken:token.replace('refresh-',''),expiresAt:now+3600000};})};
 service=createCalendarSyncService(env,deps,deps.verifyIdToken);
 await member('leader',{role:'leader',automatic:false});await store.seed('events/e1',event);await store.seed('polls/p1',{id:'p1',slots,status:'confirmed',eventId:'e1'});
});
it('requires every hour of the confirmed interval and respects explicit attendance overrides',()=>{
 expect(eligibleForEvent(event,undefined,{slots},{slotIds:['a','b']})).toBe(true);
 expect(eligibleForEvent(event,undefined,{slots},{slotIds:['a']})).toBe(false);
 expect(eligibleForEvent(event,{status:'notGoing'},{slots},{slotIds:['a','b']})).toBe(false);
 expect(eligibleForEvent(event,{status:'going'},undefined,undefined)).toBe(true);
});
it('syncs opted-in attendees and full-range voters, excluding declines, pending and non-consenting users',async()=>{
 for(const uid of ['going','voter','partial','declined','off','pending','no-scope'])await member(uid,{automatic:uid!=='off',status:uid==='pending'?'pending':'active',scopes:uid==='no-scope'?[]:undefined});
 for(const uid of ['going','off','no-scope','pending'])await going(uid);
 for(const uid of ['voter','partial','declined'])await store.seed(`votes/p1_${uid}`,{pollId:'p1',memberId:uid,slotIds:uid==='partial'?['a']:['a','b']});
 await going('declined','notGoing');let result=await run();while(result.pending)result=await service.process('e1_leader');
 expect(deps.calendarCall).toHaveBeenCalledTimes(2);expect(vi.mocked(deps.calendarCall!).mock.calls.map(c=>c[0]).sort()).toEqual(['going','voter']);
 expect(JSON.stringify(vi.mocked(deps.calendarCall!).mock.calls)).not.toContain('attendees');
});
it('does not duplicate unchanged events and updates the same ID when time or venue changes',async()=>{
 await member('a');await going('a');await run();await run();expect(deps.calendarCall).toHaveBeenCalledTimes(1);
 await store.seed('events/e1',{...event,start:'15:00',location:'새 주소'});await run();expect(deps.calendarCall).toHaveBeenLastCalledWith('a','external-a',expect.objectContaining({location:{name:'새 주소'}}));
 expect((await store.get(await linkPath('a')))?.data.status).toBe('synced');
});
it('removes the registered event on decline and on event deletion',async()=>{
 await member('a');await going('a');await run();await going('a','notGoing');await run();expect(deps.calendarDelete).toHaveBeenCalledWith('a','external-a');
 await going('a');await run();await store.commit([{path:'events/e1',remove:true}]);await run();expect(deps.calendarDelete).toHaveBeenCalledTimes(2);
});
it('limits private testing and never exposes other attendees to a member-triggered request',async()=>{
 await member('a');await member('b');await going('a');await going('b');
 service=createCalendarSyncService({...env,KAKAO_CALENDAR_TEST_ONLY:'true',KAKAO_CALENDAR_TEST_UIDS:'a'},deps,deps.verifyIdToken);await run();expect(deps.calendarCall).toHaveBeenCalledTimes(1);
 service=createCalendarSyncService(env,deps,deps.verifyIdToken);await service.queue('e1','a');await service.process('e1_a');expect(deps.calendarCall).toHaveBeenCalledTimes(1);
});
it('continues bounded batches through the scheduled runner and stays below the free request budget',async()=>{
 await member('leader',{role:'leader',automatic:true,expired:true});await going('leader');
 for(let i=0;i<13;i++){const uid=`m${i.toString().padStart(2,'0')}`;await member(uid,{expired:true});await going(uid);}
 await service.queue('e1','leader');store.cost=0;const first=await service.process('e1_leader');
 expect(first.pending).toBe(true);expect(store.cost+4).toBeLessThanOrEqual(50); // four cold HTTP auth/service-token requests
 expect(deps.calendarCall).toHaveBeenCalledTimes(6);await service.runPending();expect(deps.calendarCall).toHaveBeenCalledTimes(12);await service.runPending();expect(deps.calendarCall).toHaveBeenCalledTimes(14);expect(await store.get('calendarSyncRequests/e1_leader')).toBeNull();
});
it('keeps a newer queued revision if the event changes during a provider write',async()=>{
 await member('a');await going('a');deps.calendarCall=vi.fn(async()=>{await store.seed('events/e1',{...event,location:'변경 주소'});await service.queue('e1','leader');return 'external-a';});
 expect((await run()).pending).toBe(true);expect(await store.get('calendarSyncRequests/e1_leader')).not.toBeNull();
 deps.calendarCall=vi.fn(async(_token,id)=>id!);await service.runPending();expect(deps.calendarCall).toHaveBeenCalledWith('a','external-a',expect.objectContaining({location:{name:'변경 주소'}}));
});
it('does not create duplicates from parallel jobs or retry an unknown create outcome',async()=>{
 await member('a');await going('a');await service.queue('e1','leader');const outcomes=await Promise.all([service.process('e1_leader'),service.process('e1_leader')]);expect(outcomes.some(r=>r.busy)).toBe(true);expect(deps.calendarCall).toHaveBeenCalledTimes(1);
 await store.commit([{path:await linkPath('a'),remove:true}]);deps.calendarCall=vi.fn().mockRejectedValue(new Error('Network response lost'));await run();now+=120000;await run();expect(deps.calendarCall).toHaveBeenCalledTimes(1);expect((await store.get(await linkPath('a')))?.data.status).toBe('processing');
});
it('retries a safe known-ID update after a transient failure',async()=>{
 await member('a');await going('a');await run();await store.seed('events/e1',{...event,title:'수정'});deps.calendarCall=vi.fn().mockRejectedValueOnce(new Error('Network')).mockResolvedValue('external-a');expect((await run()).pending).toBe(true);now+=61000;await service.runPending();expect(deps.calendarCall).toHaveBeenCalledTimes(2);expect(await store.get('calendarSyncRequests/e1_leader')).toBeNull();
});
it('checks live auto-sync permission before writes and skips deleted or disabled identities',async()=>{
 await member('a');await going('a');vi.mocked(deps.lookupUser).mockImplementation(async uid=>({uid,disabled:uid==='a'}));await run();expect(deps.calendarCall).not.toHaveBeenCalled();
 vi.mocked(deps.lookupUser).mockImplementation(async uid=>({uid}));store.beforeCommit=async writes=>{if(writes.some(w=>w.path.startsWith('authCalendarLinks/')&&!w.verify)){store.beforeCommit=undefined;await store.seed('authCalendarSettings/a',{enabled:false});}};
 expect((await run()).busy).toBe(true);expect(deps.calendarCall).not.toHaveBeenCalled();await service.runPending();expect(deps.calendarCall).not.toHaveBeenCalled();
});
it('requires explicit valid consent for enabling, and allows turning it off after losing membership',async()=>{
 await member('a',{scopes:[]});await expect(service.setAutomatic('a',true,'e1')).rejects.toMatchObject({code:'kakao_calendar_consent_required'});
 await member('a');await service.setAutomatic('a',true,'e1');expect((await store.get('calendarSyncRequests/e1_a'))?.data.requestedBy).toBe('a');await store.seed('members/a',{id:'a',status:'rejected'});await service.setAutomatic('a',false);expect((await store.get('authCalendarSettings/a'))?.data.enabled).toBe(false);
});
it('allows consent reconnection after a definite provider rejection without leaving a duplicate lock',async()=>{
 await member('a');await going('a');deps.calendarCall=vi.fn().mockRejectedValueOnce(new HttpError(401,'kakao_reconnect_required')).mockResolvedValue('external-a');expect((await run()).failed).toBe(1);expect(await store.get(await linkPath('a'))).toBeNull();await run();expect(deps.calendarCall).toHaveBeenCalledTimes(2);
});
