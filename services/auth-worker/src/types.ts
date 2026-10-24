export type Provider='kakao'|'naver';
export type Intent='signin'|'link';
export interface Env {
 FIREBASE_PROJECT_ID:string;FIREBASE_CLIENT_EMAIL?:string;FIREBASE_PRIVATE_KEY?:string;
 STATE_SECRET?:string;TOKEN_ENCRYPTION_KEY?:string;ALLOWED_ORIGINS:string;AUTH_BASE_URL?:string;
 KAKAO_REST_API_KEY?:string;KAKAO_CLIENT_SECRET?:string;NAVER_CLIENT_ID?:string;NAVER_CLIENT_SECRET?:string;
 KAKAO_CALENDAR_ENABLED?:string;
 SMS_ENABLED?:string;SOLAPI_API_KEY?:string;SOLAPI_API_SECRET?:string;SOLAPI_SENDER?:string;SOLAPI_LMS_UNIT_PRICE?:string;
}
export interface StoredDocument<T=Record<string,unknown>> {data:T;version:string}
export interface Mutation {path:string;data?:Record<string,unknown>;remove?:boolean;version?:string;createOnly?:boolean;verify?:boolean}
export interface Store {
 get<T=Record<string,unknown>>(path:string):Promise<StoredDocument<T>|null>;
 commit(writes:Mutation[]):Promise<void>;
 query?<T=Record<string,unknown>>(collection:string,field:string,value:string):Promise<StoredDocument<T>[]>;
}
export interface FirebaseIdentity {uid:string;email?:string;name?:string;disabled?:boolean;providers?:string[];authTime?:number;validSince?:number}
export interface ProviderIdentity {subject:string;name:string;email:string;accessToken:string;refreshToken?:string;expiresAt:number;scopes:string[]}
export interface Dependencies {
 store:Store;now:()=>number;
 verifyIdToken:(token:string)=>Promise<FirebaseIdentity>;
 lookupUser:(uid:string)=>Promise<FirebaseIdentity|null>;
 createUser:(uid:string,name:string)=>Promise<void>;
 customToken:(uid:string)=>Promise<string>;
 providerExchange:(provider:Provider,code:string,state:string,redirectUri:string)=>Promise<ProviderIdentity>;
 calendarCall?:(token:string,eventId:string|null,payload:Record<string,unknown>)=>Promise<string>;
 refreshKakao?:(refreshToken:string)=>Promise<{accessToken:string;refreshToken?:string;expiresAt:number;scopes?:string[]}>;
 sendSms?:(messages:{id:string;to:string;text:string}[])=>Promise<import('./sms-provider').SmsProviderResult[]>;
}
export class HttpError extends Error {constructor(public status:number,public code:string){super(code);}}
export class ConflictError extends Error {constructor(){super('concurrent_update');}}
