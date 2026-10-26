import type { ErrorLogEntry, ErrorLogResponse, TelemetryReport, TelemetryRoute } from '../../../shared/error-telemetry';
import { ConflictError, HttpError } from './types';
import type { Dependencies, Env, FirebaseIdentity, Mutation, StoredDocument } from './types';
import { normalizeServerCode, normalizeTelemetryReport, sanitizeStoredError } from './telemetry-schema';

export const TELEMETRY_SLOT_COUNT = 256;
export const TELEMETRY_DAILY_LIMIT = 200;
export const TELEMETRY_RETENTION_MS = 7 * 86400000;
export const TELEMETRY_DEDUP_MS = 600000;
interface Budget {day:string;count:number;updatedAt:string}
const limits = new Map<string,{start:number;count:number}>();
const localDays = new Map<string,{day:string;attempts:number;exhausted:boolean}>();
const duplicates = new Map<string,number>();
const configured = (env:Env) => env.TELEMETRY_ENABLED==='true' && !!env.FIREBASE_PROJECT_ID && !!env.FIREBASE_CLIENT_EMAIL && !!env.FIREBASE_PRIVATE_KEY;
const reportRelease = (value:unknown) => typeof value==='string' && /^([a-f0-9]{7,40}-\d{8}T\d{6}Z|[a-f0-9]{7,40}|dev|unknown)$/.test(value) && value.length<=80 ? value:'unknown';

function takeLimit(key:string,maximum:number,now:number) {
  const old=limits.get(key);
  if(!old || now<old.start || now-old.start>=60000) {
    if(limits.size>=2048){for(const [id,value] of limits)if(now-value.start>=60000)limits.delete(id);if(limits.size>=2048)limits.delete(limits.keys().next().value!);}
    limits.set(key,{start:now,count:1});return;
  }
  if(old.count>=maximum)throw new HttpError(429,'rate_limited');
  old.count++;
}
function mutation(path:string,data:object,current:StoredDocument<unknown>|null):Mutation {
  return {path,data:data as Record<string,unknown>,...(current?{version:current.version}:{createOnly:true})};
}
export function telemetryRoute(path:string):TelemetryRoute {
  if(path==='/config'||path==='/places/search'||path==='/account/providers'||path==='/oauth/exchange')return path;
  if(/^\/oauth\/(kakao|naver)\/start$/.test(path))return '/oauth/start';
  if(/^\/oauth\/(kakao|naver)\/callback$/.test(path))return '/oauth/callback';
  if(/^\/oauth\/(kakao|naver)\/link\/start$/.test(path))return '/oauth/link';
  if(/^\/calendar\/kakao\/events\/[^/]+\/add$/.test(path))return '/calendar/add';
  if(/^\/notifications\/sms\/events\/[^/]+\/preview$/.test(path))return '/sms/preview';
  if(/^\/notifications\/sms\/events\/[^/]+\/send$/.test(path))return '/sms/send';
  return 'unknown';
}

export function createTelemetryService(env:Env,deps:Dependencies,verify:(request:Request)=>Promise<FirebaseIdentity>) {
  const project=env.FIREBASE_PROJECT_ID;
  const enabled=()=>configured(env);
  const ingestRate=(request:Request)=>{
    const now=deps.now();
    // IPs live only in this bounded in-memory limiter and never enter stored records.
    takeLimit(`${project}:client:${request.headers.get('CF-Connecting-IP') ?? 'unknown'}`,5,now);
    takeLimit(`${project}:all`,30,now);
  };
  const record=async(report:TelemetryReport,source:'client'|'server',httpStatus?:number):Promise<void>=>{
    if(!enabled())return;
    try {
      const now=deps.now(),day=new Date(now).toISOString().slice(0,10);
      let local=localDays.get(project);
      if(!local || local.day!==day){local={day,attempts:0,exhausted:false};localDays.set(project,local);}
      if(local.exhausted || local.attempts>=TELEMETRY_DAILY_LIMIT)return;
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([source,report.kind,report.code,report.context,report.route,report.release,report.frames ?? [],report.browser ?? '',report.device ?? '',httpStatus ?? 0])));
      const fingerprint=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
      const duplicateKey=`${project}:${fingerprint}`,last=duplicates.get(duplicateKey);
      if(last!==undefined && now>=last && now-last<TELEMETRY_DEDUP_MS)return;
      if(duplicates.size>=2048){for(const [key,time] of duplicates)if(now-time>=TELEMETRY_DEDUP_MS)duplicates.delete(key);if(duplicates.size>=2048)duplicates.delete(duplicates.keys().next().value!);}
      duplicates.set(duplicateKey,now);local.attempts++;
      const slot=(Number.parseInt(fingerprint.slice(0,8),16)+Number(day.replaceAll('-','')))%TELEMETRY_SLOT_COUNT;
      const id=`slot-${String(slot).padStart(3,'0')}`,path=`appErrors/${id}`;
      for(let attempt=0;attempt<2;attempt++) {
        const budget=await deps.store.get<Budget>('appErrorMeta/budget');
        // A request that started before UTC midnight must never reset a newer day's budget.
        if(typeof budget?.data.day==='string' && budget.data.day>day)return;
        const count=budget?.data.day===day && Number.isInteger(budget.data.count) ? budget.data.count:0;
        if(count>=TELEMETRY_DAILY_LIMIT){local.exhausted=true;return;}
        const current=await deps.store.get<ErrorLogEntry>(path);
        const prior=current ? sanitizeStoredError(current.data,now):null;
        if(prior?.fingerprint===fingerprint && now-Date.parse(prior.lastSeenAt)<TELEMETRY_DEDUP_MS)return;
        const same=prior?.fingerprint===fingerprint;
        const timestamp=new Date(now).toISOString();
        const entry:ErrorLogEntry={...report,id,source,fingerprint,count:same?Math.min(prior.count+1,200000):1,firstSeenAt:same?prior.firstSeenAt:timestamp,lastSeenAt:timestamp,...(httpStatus!==undefined?{httpStatus}:{})};
        try {
          await deps.store.commit([mutation('appErrorMeta/budget',{day,count:count+1,updatedAt:timestamp},budget),mutation(path,entry,current)]);
          return;
        } catch(error) {
          if(!(error instanceof ConflictError) || attempt===1)return;
        }
      }
    } catch {
      // Telemetry never changes an application result and never logs its own failure.
    }
  };
  return {
    enabled,ingestRate,
    recordClient:(report:TelemetryReport)=>record(report,'client'),
    async recordServer(code:unknown,route:TelemetryRoute,status?:number) {
      if(!enabled() || route==='unknown' || (status!==undefined && (!Number.isInteger(status) || status<400 || status>599)))return;
      try {
        takeLimit(`${project}:all`,30,deps.now());
        const report=normalizeTelemetryReport({kind:'server',code:'unknown-error',context:'server-request',route,release:reportRelease(env.TELEMETRY_RELEASE)});
        report.code=normalizeServerCode(code);
        await record(report,'server',status);
      } catch { /* Never recursively collect logging failures or rate-limit failures. */ }
    },
    async list(request:Request,limit=50):Promise<ErrorLogResponse> {
      const identity=await verify(request),member=await deps.store.get(`members/${identity.uid}`);
      if(member?.data.status!=='active' || member.data.role!=='leader')throw new HttpError(403,'telemetry_admin_required');
      if(!enabled())return {errors:[],enabled:false};
      if(!deps.store.recentErrors)throw new HttpError(503,'telemetry_unavailable');
      if(!Number.isInteger(limit)||limit<1||limit>50)throw new HttpError(400,'telemetry_invalid_limit');
      const records=await deps.store.recentErrors<ErrorLogEntry>(limit,new Date(deps.now()-TELEMETRY_RETENTION_MS).toISOString());
      const errors=records.map(value=>sanitizeStoredError(value.data,deps.now())).filter((value):value is ErrorLogEntry=>value!==null).sort((a,b)=>b.lastSeenAt.localeCompare(a.lastSeenAt)).slice(0,limit);
      return {errors,enabled:true};
    },
  };
}
