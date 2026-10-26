import {base64url,bytes,decode,signJwt} from './crypto';
import {ConflictError,HttpError} from './types';
import type {Env,FirebaseIdentity,Mutation,Store,StoredDocument} from './types';

const accessCache=new Map<string,{token:string;until:number}>();
let jwksCache:{keys:JsonWebKey[];until:number}|null=null;
export function requireFirebase(env:Env){if(!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY)throw new HttpError(503,'firebase_not_configured');}
export async function serviceToken(env:Env):Promise<string>{
 requireFirebase(env);const key=env.FIREBASE_CLIENT_EMAIL!;const cached=accessCache.get(key);if(cached && cached.until>Date.now()+60000)return cached.token;
 const now=Math.floor(Date.now()/1000);const assertion=await signJwt({iss:key,scope:'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600},key,env.FIREBASE_PRIVATE_KEY!);
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!response.ok)throw new HttpError(503,'service_auth_failed');const result=await response.json() as {access_token:string;expires_in:number};if(!result.access_token)throw new HttpError(503,'service_auth_failed');accessCache.set(key,{token:result.access_token,until:Date.now()+Math.min(result.expires_in,3600)*1000});return result.access_token;
}
export async function customToken(env:Env,uid:string){requireFirebase(env);if(!uid || uid.length>128)throw new HttpError(400,'invalid_uid');const now=Math.floor(Date.now()/1000);return signJwt({iss:env.FIREBASE_CLIENT_EMAIL,sub:env.FIREBASE_CLIENT_EMAIL,aud:'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',iat:now,exp:now+3600,uid},env.FIREBASE_CLIENT_EMAIL!,env.FIREBASE_PRIVATE_KEY!);}
export async function authAdmin(env:Env,operation:string,body:Record<string,unknown>){const response=await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/${operation}`,{method:'POST',headers:{Authorization:`Bearer ${await serviceToken(env)}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json() as {error?:{message?:string};users?:{localId:string;email?:string;displayName?:string;disabled?:boolean;providerUserInfo?:{providerId:string}[];validSince?:string}[]};if(!response.ok){if(result.error?.message?.includes('USER_NOT_FOUND'))return null;throw new HttpError(503,'firebase_account_failed');}return result;}
export async function lookupUser(env:Env,uid:string):Promise<FirebaseIdentity|null>{const result=await authAdmin(env,'accounts:lookup',{localId:[uid]});const user=result?.users?.[0];return user ? {uid:user.localId,email:user.email,name:user.displayName,disabled:user.disabled,providers:user.providerUserInfo?.map(p=>p.providerId) ?? [],validSince:Number(user.validSince)||0}:null;}
export async function createUser(env:Env,uid:string,name:string){const existing=await lookupUser(env,uid);if(existing)return;try{await authAdmin(env,'accounts',{localId:uid,displayName:name.slice(0,128),disabled:false});}catch(error){if(!await lookupUser(env,uid))throw error;}}

function valueFrom(value:unknown):unknown {const v=value as Record<string,unknown>;if('stringValue'in v)return v.stringValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;if('booleanValue'in v)return v.booleanValue;if('nullValue'in v)return null;if('arrayValue'in v)return (((v.arrayValue as {values?:unknown[]}).values) ?? []).map(valueFrom);if('mapValue'in v)return documentFrom((v.mapValue as {fields?:Record<string,unknown>}).fields ?? {});if('timestampValue'in v)return v.timestampValue;return null;}
function documentFrom(fields:Record<string,unknown>){return Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,valueFrom(value)]));}
function valueTo(value:unknown):Record<string,unknown>{if(value===null)return {nullValue:null};if(typeof value==='string')return {stringValue:value};if(typeof value==='boolean')return {booleanValue:value};if(typeof value==='number')return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};if(Array.isArray(value))return {arrayValue:{values:value.map(valueTo)}};if(typeof value==='object')return {mapValue:{fields:fieldsTo(value as Record<string,unknown>)}};throw new HttpError(500,'invalid_document_value');}
function fieldsTo(value:Record<string,unknown>){return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([key,v])=>[key,valueTo(v)]));}
export class FirestoreStore implements Store {
 constructor(private env:Env){}
 private root(){return `projects/${this.env.FIREBASE_PROJECT_ID}/databases/(default)/documents`;}
 private path(path:string){if(!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_:.-]+$/.test(path))throw new HttpError(400,'invalid_document_path');return `${this.root()}/${path}`;}
 async get<T=Record<string,unknown>>(path:string):Promise<StoredDocument<T>|null>{const response=await fetch(`https://firestore.googleapis.com/v1/${this.path(path)}`,{headers:{Authorization:`Bearer ${await serviceToken(this.env)}`}});if(response.status===404)return null;if(!response.ok)throw new HttpError(503,'database_unavailable');const value=await response.json() as {fields:Record<string,unknown>;updateTime:string};return {data:documentFrom(value.fields) as T,version:value.updateTime};}
 async query<T=Record<string,unknown>>(collection:string,field:string,value:string):Promise<StoredDocument<T>[]> {
  if(!/^[A-Za-z0-9_-]+$/.test(collection)||!/^[A-Za-z0-9_]+$/.test(field))throw new HttpError(400,'invalid_query');
  const response=await fetch(`https://firestore.googleapis.com/v1/${this.root()}:runQuery`,{method:'POST',headers:{Authorization:`Bearer ${await serviceToken(this.env)}`,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:value}}},limit:201}})});
  if(!response.ok)throw new HttpError(503,'database_unavailable');const result=await response.json() as {document?:{fields?:Record<string,unknown>;updateTime:string}}[];
  const docs=result.flatMap(item=>item.document?[{data:documentFrom(item.document.fields??{}) as T,version:item.document.updateTime}]:[]);if(docs.length>200)throw new HttpError(422,'sms_audience_too_large');return docs;
 }
 async recentErrors<T=Record<string,unknown>>(limit:number,since:string):Promise<StoredDocument<T>[]> {
  if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isFinite(Date.parse(since)))throw new HttpError(400,'invalid_query');
  const response=await fetch(`https://firestore.googleapis.com/v1/${this.root()}:runQuery`,{method:'POST',headers:{Authorization:`Bearer ${await serviceToken(this.env)}`,'Content-Type':'application/json'},body:JSON.stringify({structuredQuery:{from:[{collectionId:'appErrors'}],where:{fieldFilter:{field:{fieldPath:'lastSeenAt'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:since}}},orderBy:[{field:{fieldPath:'lastSeenAt'},direction:'DESCENDING'}],limit}})});
  if(!response.ok)throw new HttpError(503,'database_unavailable');
  const result=await response.json() as {document?:{fields?:Record<string,unknown>;updateTime:string}}[];
  return result.flatMap(item=>item.document?[{data:documentFrom(item.document.fields??{}) as T,version:item.document.updateTime}]:[]).slice(0,limit);
 }
 async commit(writes:Mutation[]){
  const token=await serviceToken(this.env),headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};const root=`https://firestore.googleapis.com/v1/${this.root()}`;const checks=writes.filter(write=>write.verify);let transaction:string|undefined;
  try {
   if(checks.length){
    const started=await fetch(`${root}:beginTransaction`,{method:'POST',headers,body:'{}'});if(!started.ok)throw new HttpError(503,'database_unavailable');transaction=(await started.json() as {transaction:string}).transaction;
    const read=await fetch(`${root}:batchGet`,{method:'POST',headers,body:JSON.stringify({documents:checks.map(write=>this.path(write.path)),transaction})});if(!read.ok)throw new HttpError(503,'database_unavailable');
    const snapshots=await read.json() as {found?:{name:string;updateTime:string};missing?:string}[];
    for(const check of checks){const name=this.path(check.path);const snapshot=snapshots.find(item=>item.found?.name===name||item.missing===name);if(!snapshot || (check.createOnly ? snapshot.missing!==name : snapshot.found?.updateTime!==check.version))throw new ConflictError();}
   }
   const body={writes:writes.filter(write=>!write.verify).map(write=>({...(write.remove ? {delete:this.path(write.path)}:{update:{name:this.path(write.path),fields:fieldsTo(write.data ?? {})}}),...(write.createOnly ? {currentDocument:{exists:false}}:write.version ? {currentDocument:{updateTime:write.version}}:{})})),...(transaction?{transaction}:{})};
   const response=await fetch(`${root}:commit`,{method:'POST',headers,body:JSON.stringify(body)});if(response.status===409 || response.status===412 || (response.status===400 && /FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(await response.clone().text())))throw new ConflictError();if(!response.ok)throw new HttpError(503,'database_unavailable');transaction=undefined;
  }finally{if(transaction)await fetch(`${root}:rollback`,{method:'POST',headers,body:JSON.stringify({transaction})}).catch(()=>{});}
 }

}
export async function verifyFirebaseToken(token:string,env:Env):Promise<FirebaseIdentity>{
 const parts=token.split('.');if(parts.length!==3 || token.length>16384)throw new HttpError(401,'invalid_firebase_token');let header:{alg?:string;kid?:string},claims:{aud?:string;iss?:string;sub?:string;exp?:number;iat?:number;auth_time?:number;email?:string;name?:string};
 try{header=JSON.parse(new TextDecoder().decode(decode(parts[0])));claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));}catch{throw new HttpError(401,'invalid_firebase_token');}
 const now=Math.floor(Date.now()/1000);if(header.alg!=='RS256' || !header.kid || claims.aud!==env.FIREBASE_PROJECT_ID || claims.iss!==`https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` || !claims.sub || claims.sub.length>128 || !/^[A-Za-z0-9:_-]+$/.test(claims.sub) || typeof claims.exp!=='number' || claims.exp<=now || typeof claims.iat!=='number' || claims.iat>now+60 || typeof claims.auth_time!=='number' || claims.auth_time>now+60)throw new HttpError(401,'invalid_firebase_token');
 const load=async()=>{const response=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');if(!response.ok)throw new HttpError(503,'token_verification_unavailable');const body=await response.json() as {keys:JsonWebKey[]};jwksCache={keys:body.keys,until:Date.now()+3600000};};
 if(!jwksCache || jwksCache.until<Date.now())await load();let jwk=jwksCache!.keys.find(key=>(key as JsonWebKey&{kid?:string}).kid===header.kid);if(!jwk){await load();jwk=jwksCache!.keys.find(key=>(key as JsonWebKey&{kid?:string}).kid===header.kid);}if(!jwk)throw new HttpError(401,'invalid_firebase_token');const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),bytes(`${parts[0]}.${parts[1]}`)))throw new HttpError(401,'invalid_firebase_token');
 return {uid:claims.sub,email:claims.email,name:claims.name,authTime:claims.auth_time};
}
export function testJwtParts(value:Record<string,unknown>){return base64url(bytes(JSON.stringify(value)));}
