import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorLogEntry, TelemetryReport } from '../../../shared/error-telemetry';
import { createApp } from '../src/app';
import { createTelemetryService, TELEMETRY_DAILY_LIMIT, TELEMETRY_RETENTION_MS, telemetryRoute } from '../src/telemetry';
import { ConflictError, HttpError } from '../src/types';
import type { Dependencies, Env, FirebaseIdentity, Mutation, Store, StoredDocument } from '../src/types';

class MemoryStore implements Store {
  values=new Map<string,StoredDocument<Record<string,unknown>>>();sequence=0;reads=0;commits=0;
  async get<T=Record<string,unknown>>(path:string){this.reads++;return structuredClone(this.values.get(path) ?? null) as StoredDocument<T>|null;}
  async commit(writes:Mutation[]){for(const write of writes){const old=this.values.get(write.path);if(write.createOnly&&old || write.version&&old?.version!==write.version)throw new ConflictError();}this.commits++;for(const write of writes){if(write.remove)this.values.delete(write.path);else this.values.set(write.path,{data:structuredClone(write.data ?? {}),version:String(++this.sequence)});}}
  async recentErrors<T=Record<string,unknown>>(limit:number,since:string){return [...this.values.entries()].filter(([path,value])=>path.startsWith('appErrors/')&&String(value.data.lastSeenAt)>=since).map(([,value])=>structuredClone(value)).sort((a,b)=>String(b.data.lastSeenAt).localeCompare(String(a.data.lastSeenAt))).slice(0,limit) as StoredDocument<T>[];}
  seed(path:string,data:object){this.values.set(path,{data:structuredClone(data) as Record<string,unknown>,version:String(++this.sequence)});}
}
const origin='https://app.test';
const report:TelemetryReport={kind:'auth',code:'auth/network-request-failed',context:'google-signin',route:'/login',release:'abcdef123-20261026T120000Z',frames:[{file:'index-abc123.js',line:100,column:20}],browser:'safari',device:'mobile'};
let serial=0,env:Env,deps:Dependencies,store:MemoryStore,now:number,jobs:Promise<unknown>[],current:FirebaseIdentity|null;
const request=(body:unknown=report,headers:Record<string,string>={})=>new Request('https://worker.test/telemetry/errors',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.10',...headers},body:JSON.stringify(body)});
const adminRequest=(token='valid',query='')=>new Request(`https://worker.test/telemetry/errors${query}`,{headers:{Origin:origin,Authorization:`Bearer ${token}`,'CF-Connecting-IP':'192.0.2.20'}});
const entries=()=>[...store.values.entries()].filter(([path])=>path.startsWith('appErrors/')).map(([,value])=>value.data as unknown as ErrorLogEntry);
const settle=async()=>{await Promise.all(jobs.splice(0));};

beforeEach(()=>{
  serial++;now=Date.parse('2026-10-26T12:00:00.000Z');store=new MemoryStore();jobs=[];current={uid:'administrator',authTime:100,validSince:90};
  env={FIREBASE_PROJECT_ID:`telemetry-${serial}`,FIREBASE_CLIENT_EMAIL:'synthetic@example.test',FIREBASE_PRIVATE_KEY:'private-key-never-log',ALLOWED_ORIGINS:origin,TELEMETRY_ENABLED:'true',TELEMETRY_RELEASE:'abcdef123'};
  store.seed('members/administrator',{status:'active',role:'leader',email:'do-not-log@example.test',phone:'01012345678'});
  deps={store,now:()=>now,verifyIdToken:async token=>{if(token!=='valid')throw new HttpError(401,'invalid_firebase_token');return {uid:'administrator',authTime:100};},lookupUser:async()=>current,createUser:vi.fn(),customToken:vi.fn(),providerExchange:vi.fn(),waitUntil:job=>jobs.push(job)};
});

describe('private bounded error telemetry',()=>{
  it('accepts anonymous login diagnostics and stores only whitelisted fields with server timestamps',async()=>{
    const app=createApp(env,deps),response=await app.fetch(request({...report,code:'sensitive-token@example.test'},{Authorization:'Bearer private-token',Referer:'https://app.test/?phone=01012345678'}));
    expect(response.status).toBe(202);expect(await response.json()).toEqual({accepted:true});
    await settle();expect(entries()).toHaveLength(1);
    expect(entries()[0]).toMatchObject({...report,code:'unknown-error',source:'client',count:1,firstSeenAt:new Date(now).toISOString(),lastSeenAt:new Date(now).toISOString()});
    expect(entries()[0].fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify([...store.values.entries()].filter(([path])=>path.startsWith('appError')))).not.toMatch(/sensitive-token|private-token|private-key|01012345678|do-not-log|192\.0\.2|administrator|Referer/);
    const reply=await app.fetch(adminRequest());
    expect(reply.status).toBe(200);expect(reply.headers.get('Cache-Control')).toBe('no-store');
    expect((await reply.json() as any).errors).toHaveLength(1);
  });

  it('requires approved origins and rejects PII payloads, excessive bodies, and rates before Firestore access',async()=>{
    const app=createApp(env,deps);
    expect((await app.fetch(request(report,{Origin:'https://evil.test'}))).status).toBe(403);
    const noOrigin=request();noOrigin.headers.delete('Origin');expect((await app.fetch(noOrigin)).status).toBe(403);
    expect((await app.fetch(request({...report,message:'private email@example.test'}))).status).toBe(400);
    expect((await app.fetch(request({...report,frames:[{file:'https://host/private?token=secret',line:1,column:1}]}))).status).toBe(400);
    expect((await app.fetch(request({...report,release:'x'.repeat(5000)}))).status).toBe(413);
    expect((await app.fetch(request({...report,uid:'private-user'}))).status).toBe(400);
    expect((await app.fetch(request({...report,stack:'private'}))).status).toBe(400);
    expect((await app.fetch(request())).status).toBe(429);
    await settle();expect(store.reads).toBe(0);expect(entries()).toHaveLength(0);
  });

  it('gates listing on the verified current active administrator and never collects listing failures',async()=>{
    const app=createApp(env,deps);
    expect((await app.fetch(adminRequest('forged'))).status).toBe(401);
    current={uid:'administrator',disabled:true};expect((await app.fetch(adminRequest())).status).toBe(401);
    current=null;expect((await app.fetch(adminRequest())).status).toBe(401);
    current={uid:'administrator',validSince:101};expect((await app.fetch(adminRequest())).status).toBe(401);
    current={uid:'administrator'};
    for(const [status,role] of [['pending','leader'],['active','member'],['rejected','leader']]){store.seed('members/administrator',{status,role});expect((await app.fetch(adminRequest())).status).toBe(403);}
    store.seed('members/administrator',{status:'active',role:'leader'});
    expect((await app.fetch(adminRequest('valid','?limit=51'))).status).toBe(400);
    expect((await app.fetch(adminRequest('valid','?limit=0'))).status).toBe(400);
    await settle();expect(entries()).toHaveLength(0);
  });

  it('coalesces the same incident for ten minutes and enforces the shared global daily write budget under races',async()=>{
    const service=createTelemetryService(env,deps,async()=>({uid:'administrator'}));
    await service.recordClient(report);await service.recordClient(report);
    expect(entries()).toHaveLength(1);expect(store.commits).toBe(1);
    now+=600001;await service.recordClient(report);
    expect(entries()[0].count).toBe(2);expect(store.commits).toBe(2);
    store.seed('appErrorMeta/budget',{day:new Date(now).toISOString().slice(0,10),count:199,updatedAt:new Date(now).toISOString()});
    await Promise.all([service.recordClient({...report,release:'a'.repeat(40)}),service.recordClient({...report,release:'b'.repeat(40)})]);
    expect(store.values.get('appErrorMeta/budget')!.data.count).toBe(TELEMETRY_DAILY_LIMIT);
    expect(entries().length).toBeLessThanOrEqual(2);
    const reads=store.reads;await service.recordClient({...report,release:'c'.repeat(40)});
    expect(store.reads).toBe(reads);
  });

  it('physically bounds records to 256 slots and lists only a seven-day safe window',async()=>{
    const service=createTelemetryService(env,deps,async()=>({uid:'administrator'}));
    for(let day=0;day<3;day++)for(let index=0;index<120;index++){
      now=Date.parse('2026-10-26T12:00:00.000Z')+day*86400000+index*1000;
      await service.recordClient({...report,release:(day*120+index).toString(16).padStart(8,'0')});
    }
    expect(entries().length).toBeLessThanOrEqual(256);expect(store.values.size).toBeLessThanOrEqual(258);
    const records=await service.list(adminRequest());expect(records.errors.length).toBeLessThanOrEqual(50);
    expect(records.errors.length).toBeGreaterThan(0);
    const valid=records.errors[0];store.seed(`appErrors/${valid.id}`,{...valid,email:'private@example.test'});
    expect((await service.list(adminRequest())).errors.some(value=>value.id===valid.id)).toBe(false);
    now+=TELEMETRY_RETENTION_MS+1;expect((await service.list(adminRequest())).errors).toHaveLength(0);
  });

  it('never rolls back a newer UTC day budget when an older request finishes after midnight',async()=>{
    now=Date.parse('2026-10-26T23:59:59.999Z');
    store.seed('appErrorMeta/budget',{day:'2026-10-27',count:200,updatedAt:'2026-10-27T00:00:00.000Z'});
    await createTelemetryService(env,deps,async()=>({uid:'administrator'})).recordClient(report);
    expect(store.commits).toBe(0);
    expect(store.values.get('appErrorMeta/budget')!.data).toMatchObject({day:'2026-10-27',count:200});
    expect(entries()).toHaveLength(0);
  });

  it('captures caught server errors using route categories while dropping queries, IDs, and exception messages',async()=>{
    const app=createApp(env,deps);
    const response=await app.fetch(new Request('https://worker.test/account/providers?email=private@example.test&token=secret',{headers:{Origin:origin}}));
    expect(response.status).toBe(401);await settle();
    expect(entries()[0]).toMatchObject({source:'server',kind:'server',context:'server-request',code:'firebase_auth_required',route:'/account/providers',httpStatus:401});
    expect(JSON.stringify(entries())).not.toMatch(/private@example|secret|\?|Authorization/);
    expect(telemetryRoute('/notifications/sms/events/private-event-id/send')).toBe('/sms/send');
    expect(telemetryRoute('/oauth/naver/callback')).toBe('/oauth/callback');
    expect(telemetryRoute('/private-user/path')).toBe('unknown');
  });

  it('does not delay or replace application responses when diagnostic storage fails',async()=>{
    const app=createApp(env,deps);deps.store.get=vi.fn(async()=>{throw new Error('private-store-error@example.test');});
    const response=await app.fetch(request());expect(response.status).toBe(202);await settle();
    expect(store.commits).toBe(0);
    const unavailable=await app.fetch(new Request('https://worker.test/places/search?q=private-address',{headers:{Origin:origin,Authorization:'Bearer valid'}}));
    expect(unavailable.status).toBe(500);await settle();expect(entries()).toHaveLength(0);
    expect(jobs).toHaveLength(0);
  });

  it('keeps disabled collection inert and reports readiness to administrators',async()=>{
    env.TELEMETRY_ENABLED='false';const app=createApp(env,deps);
    expect((await app.fetch(request())).status).toBe(202);await settle();expect(store.commits).toBe(0);
    expect(await (await app.fetch(adminRequest())).json()).toEqual({enabled:false,errors:[]});
  });
});
