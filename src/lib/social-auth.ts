import { useEffect, useState } from 'react';
import { GoogleAuthProvider, linkWithPopup, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from './firebase';
import { getAuthAPIURL } from './api-url';
export { getAuthAPIURL } from './api-url';

export type SocialProvider='kakao'|'naver';
export type SocialIntent='signin'|'link';
export interface AuthProviderConfig {providers:{kakao:boolean;naver:boolean};calendar:{kakao:boolean}}
export interface AccountProviders {google:boolean;kakao:boolean;naver:boolean;calendar:{kakao:boolean}}
export interface SocialAuthResult {uid:string;provider:SocialProvider;intent:SocialIntent}
interface Attempt {version:1;provider:SocialProvider;intent:SocialIntent;verifier:string;createdAt:number;origin:string;apiURL:string;uid?:string}
export const SOCIAL_ATTEMPT_KEY='moim-social-auth:v1';
const ATTEMPT_MAX_AGE=10*60*1000;
const emptyConfig=():AuthProviderConfig=>({providers:{kakao:false,naver:false},calendar:{kakao:false}});
const isProvider=(value:unknown):value is SocialProvider=>value==='kakao'||value==='naver';
const isIntent=(value:unknown):value is SocialIntent=>value==='signin'||value==='link';
const validUID=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=128&&!/[\s\u0000-\u001f]/.test(value);
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

function requestError(status:number,code?:string,calendar=false){if(code==='kakao_calendar_consent_required'||code==='calendar_consent_required')return new Error('카카오 계정을 연결하고 캘린더 사용에 동의해 주세요.');if(code==='kakao_reconnect_required'||code==='reconnect_required')return new Error('카카오 계정을 다시 연결해 주세요.');if(code==='event_attendance_required')return new Error('참여 예정으로 등록한 뒤 캘린더에 추가해 주세요.');if(code==='active_membership_required')return new Error('승인된 멤버만 캘린더에 추가할 수 있어요.');if(code==='kakao_time_requires_five_minutes')return new Error('모임 시간을 5분 단위로 맞춘 뒤 다시 시도해 주세요.');if(code==='kakao_calendar_not_configured')return new Error('지금은 카카오 캘린더를 사용할 수 없어요.');if(status===409&&!calendar)return new Error('이미 다른 계정에 연결된 로그인 계정이에요. 기존 계정으로 로그인해 주세요.');if(status===401||status===403)return new Error('로그인 계정을 다시 확인해 주세요.');if(status===410)return new Error('로그인 요청이 만료됐어요. 다시 시작해 주세요.');return new Error(calendar?'캘린더에 일정을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.':'로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.');}
async function requestJSON(path:string,init:RequestInit={},apiURL=getAuthAPIURL(),calendar=false):Promise<unknown>{
  if(!apiURL)throw new Error('지금은 이 로그인 방식을 사용할 수 없어요.');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),10000);const originalSignal=init.signal;const abort=()=>controller.abort();if(originalSignal?.aborted)controller.abort();else originalSignal?.addEventListener('abort',abort,{once:true});
  try{const response=await fetch(new URL(path.replace(/^\//,''),apiURL),{...init,signal:controller.signal,credentials:'omit',cache:'no-store'});if(!response.ok){let code:string|undefined;try{const failure:unknown=await response.json();if(object(failure)){if(typeof failure.error==='string')code=failure.error;else if(object(failure.error)&&typeof failure.error.code==='string')code=failure.error.code;}}catch{/* Only known error codes are presented. */}throw requestError(response.status,code,calendar);}try{return await response.json();}catch{throw new Error('로그인 응답을 확인하지 못했어요. 다시 시도해 주세요.');}}
  catch(error){if(error instanceof Error&&error.name!=='AbortError'&&error.name!=='TypeError')throw error;throw new Error('로그인 연결을 확인할 수 없어요. 잠시 후 다시 시도해 주세요.');}
  finally{clearTimeout(timer);originalSignal?.removeEventListener('abort',abort);}
}

export async function fetchAuthProviderConfig(signal?:AbortSignal):Promise<AuthProviderConfig|null>{
  if(!getAuthAPIURL())return null;
  const data=await requestJSON('/config',{signal});if(!object(data)||!object(data.providers)||!object(data.calendar))throw new Error('로그인 설정을 확인하지 못했어요.');
  return {providers:{kakao:data.providers.kakao===true,naver:data.providers.naver===true},calendar:{kakao:data.calendar.kakao===true}};
}
export function useAuthProviderConfig(){
  const apiURL=getAuthAPIURL();const [state,setState]=useState<AuthProviderConfig&{enabled:boolean;loading:boolean}>({...emptyConfig(),enabled:false,loading:!!apiURL});
  useEffect(()=>{if(!apiURL){setState({...emptyConfig(),enabled:false,loading:false});return;}const controller=new AbortController();let active=true;setState({...emptyConfig(),enabled:false,loading:true});void fetchAuthProviderConfig(controller.signal).then(config=>{if(active)setState({...config??emptyConfig(),enabled:!!config,loading:false});}).catch(()=>{if(active)setState({...emptyConfig(),enabled:false,loading:false});});return()=>{active=false;controller.abort();};},[apiURL]);
  return state;
}

function base64url(bytes:Uint8Array){let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');}
export async function createSocialProof(){if(!globalThis.crypto?.getRandomValues||!globalThis.crypto?.subtle)throw new Error('이 브라우저에서 로그인을 시작하지 못했어요. 다른 브라우저로 다시 시도해 주세요.');const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);const verifier=base64url(bytes);const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));return {verifier,challenge:base64url(new Uint8Array(digest))};}
function removeAttempt(verifier?:string){try{if(!verifier){window.sessionStorage.removeItem(SOCIAL_ATTEMPT_KEY);return;}const stored=window.sessionStorage.getItem(SOCIAL_ATTEMPT_KEY);if(stored&&JSON.parse(stored).verifier===verifier)window.sessionStorage.removeItem(SOCIAL_ATTEMPT_KEY);}catch{/* No session state remains usable after an invalid attempt. */}}
function authorizationURL(value:unknown,provider:SocialProvider){if(typeof value!=='string')throw new Error('로그인 주소를 확인하지 못했어요.');const url=new URL(value);const host=provider==='kakao'?'kauth.kakao.com':'nid.naver.com';if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.port)throw new Error('로그인 주소를 확인하지 못했어요.');return url.href;}

export async function startSocialAuth(provider:SocialProvider,intent:SocialIntent='signin'):Promise<void>{
  if(!isProvider(provider)||!isIntent(intent))throw new Error('로그인 방식을 확인해 주세요.');
  const apiURL=getAuthAPIURL();const config=await fetchAuthProviderConfig();if(!apiURL||!config?.providers[provider]||!auth)throw new Error('지금은 이 로그인 방식을 사용할 수 없어요.');
  if(intent==='link')await auth.authStateReady();const user=auth.currentUser;if(intent==='link'&&!user)throw new Error('먼저 기존 계정으로 로그인해 주세요.');
  const proof=await createSocialProof();const attempt:Attempt={version:1,provider,intent,verifier:proof.verifier,createdAt:Date.now(),origin:window.location.origin,apiURL,...(intent==='link'&&user?{uid:user.uid}:{})};
  try{window.sessionStorage.setItem(SOCIAL_ATTEMPT_KEY,JSON.stringify(attempt));}catch{throw new Error('이 브라우저에서 로그인 요청을 저장하지 못했어요. 브라우저 설정을 확인해 주세요.');}
  try{
    if(intent==='signin'){const url=new URL(`oauth/${provider}/start`,apiURL);url.searchParams.set('challenge',proof.challenge);url.searchParams.set('returnOrigin',attempt.origin);url.searchParams.set('intent','signin');window.location.assign(url.href);return;}
    if(auth.currentUser?.uid!==user!.uid)throw new Error('로그인 계정이 변경됐어요. 다시 연결해 주세요.');
    const token=await user!.getIdToken();const response=await requestJSON(`/oauth/${provider}/link/start`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({challenge:proof.challenge,returnOrigin:attempt.origin})},apiURL);
    if(!object(response))throw new Error('로그인 주소를 확인하지 못했어요.');window.location.assign(authorizationURL(response.authorizationUrl,provider));
  }catch(error){removeAttempt(proof.verifier);throw error;}
}

function takeAttempt(params:URLSearchParams):Attempt{
  let raw:string|null;try{raw=window.sessionStorage.getItem(SOCIAL_ATTEMPT_KEY);}catch{throw new Error('이 브라우저의 로그인 요청을 확인하지 못했어요. 다시 시작해 주세요.');}removeAttempt();
  if(!raw)throw new Error('이 브라우저에서 시작한 로그인 요청이 없어요. 다시 시작해 주세요.');
  let attempt:unknown;try{attempt=JSON.parse(raw);}catch{throw new Error('로그인 요청을 확인하지 못했어요. 다시 시작해 주세요.');}
  const provider=params.get('provider'),intent=params.get('intent');
  if(!object(attempt)||attempt.version!==1||!isProvider(attempt.provider)||!isIntent(attempt.intent)||typeof attempt.verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(attempt.verifier)||typeof attempt.createdAt!=='number'||attempt.origin!==window.location.origin||attempt.apiURL!==getAuthAPIURL()||provider!==attempt.provider||intent!==attempt.intent||params.getAll('provider').length!==1||params.getAll('intent').length!==1||(attempt.intent==='link'&&!validUID(attempt.uid)))throw new Error('로그인 요청이 일치하지 않아요. 다시 시작해 주세요.');
  if(Date.now()-attempt.createdAt>ATTEMPT_MAX_AGE||attempt.createdAt>Date.now()+60000)throw new Error('로그인 요청이 만료됐어요. 다시 시작해 주세요.');
  return attempt as unknown as Attempt;
}

export async function exchangeSocialCallback(params:URLSearchParams):Promise<SocialAuthResult>{
  const attempt=takeAttempt(params);if(params.has('error'))throw new Error('로그인이 취소됐거나 완료되지 않았어요. 다시 시작해 주세요.');
  const code=params.get('code');if(!code||!/^[A-Za-z0-9_-]{16,1024}$/.test(code)||params.getAll('code').length!==1)throw new Error('로그인 응답을 확인하지 못했어요. 다시 시작해 주세요.');
  if(!auth)throw new Error('로그인을 준비하지 못했어요. 다시 시작해 주세요.');await auth.authStateReady();
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(attempt.intent==='link'){const user=auth.currentUser;if(!user||user.uid!==attempt.uid)throw new Error('연결을 시작한 계정으로 다시 로그인해 주세요.');headers.Authorization=`Bearer ${await user.getIdToken()}`;}
  const data=await requestJSON('/oauth/exchange',{method:'POST',headers,body:JSON.stringify({code,verifier:attempt.verifier})},attempt.apiURL);
  if(!object(data)||data.provider!==attempt.provider||data.intent!==attempt.intent||!validUID(data.uid))throw new Error('로그인 계정을 확인하지 못했어요. 다시 시작해 주세요.');
  if(attempt.intent==='link'){if(data.linked!==true||data.uid!==attempt.uid||auth.currentUser?.uid!==attempt.uid)throw new Error('연결할 계정이 일치하지 않아요. 기존 계정으로 다시 로그인해 주세요.');return {uid:data.uid,provider:attempt.provider,intent:'link'};}
  if(typeof data.firebaseCustomToken!=='string'||!data.firebaseCustomToken||data.firebaseCustomToken.length>16384)throw new Error('로그인 응답을 확인하지 못했어요. 다시 시작해 주세요.');
  const credential=await signInWithCustomToken(auth,data.firebaseCustomToken);if(credential.user.uid!==data.uid){await signOut(auth);throw new Error('로그인 계정이 일치하지 않아요. 다시 시작해 주세요.');}
  return {uid:data.uid,provider:attempt.provider,intent:'signin'};
}

export async function getAccountProviders():Promise<AccountProviders>{
  if(!auth)throw new Error('로그인이 필요해요.');await auth.authStateReady();const user=auth.currentUser;if(!user)throw new Error('로그인이 필요해요.');const data=await requestJSON('/account/providers',{headers:{Authorization:`Bearer ${await user.getIdToken()}`}});if(!object(data)||!object(data.calendar))throw new Error('계정 연결 상태를 확인하지 못했어요.');if(auth.currentUser?.uid!==user.uid)throw new Error('로그인 계정이 변경됐어요.');return {google:data.google===true,kakao:data.kakao===true,naver:data.naver===true,calendar:{kakao:data.calendar.kakao===true}};
}
export async function linkGoogleAccount(expectedUID:string):Promise<void>{
  if(!auth)throw new Error('먼저 기존 계정으로 로그인해 주세요.');await auth.authStateReady();const user=auth.currentUser;if(!user||user.uid!==expectedUID)throw new Error('먼저 기존 계정으로 로그인해 주세요.');const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
  try{const result=await linkWithPopup(user,provider);if(result.user.uid!==expectedUID||auth.currentUser?.uid!==expectedUID)throw new Error('연결할 계정이 일치하지 않아요.');}
  catch(error){const code=object(error)?error.code:undefined;if(code==='auth/credential-already-in-use'||code==='auth/email-already-in-use'||code==='auth/account-exists-with-different-credential')throw new Error('이미 다른 계정에 연결된 Google 계정이에요. 기존 계정으로 로그인해 주세요.');if(code==='auth/requires-recent-login')throw new Error('다시 로그인한 뒤 Google 계정을 연결해 주세요.');if(code==='auth/popup-closed-by-user')throw new Error('연결 창이 닫혔어요. 다시 시도해 주세요.');throw error;}
}


export interface KakaoCalendarAddResult {added:true;alreadySynced:boolean;eventId:string;kakaoEventId:string}
export async function addToKakaoCalendar(eventId:string):Promise<KakaoCalendarAddResult>{
  if(!/^[A-Za-z0-9_-]{1,200}$/.test(eventId))throw new Error('모임 일정을 확인해 주세요.');
  if(!getAuthAPIURL()||!auth)throw new Error('지금은 카카오 캘린더를 사용할 수 없어요.');
  await auth.authStateReady();const user=auth.currentUser;if(!user)throw new Error('먼저 로그인해 주세요.');const token=await user.getIdToken();if(auth.currentUser?.uid!==user.uid)throw new Error('로그인 계정이 변경됐어요. 다시 시도해 주세요.');
  const data=await requestJSON(`/calendar/kakao/events/${encodeURIComponent(eventId)}/add`,{method:'POST',headers:{Authorization:`Bearer ${token}`}},getAuthAPIURL(),true);
  if(auth.currentUser?.uid!==user.uid)throw new Error('로그인 계정이 변경됐어요. 다시 시도해 주세요.');
  if(!object(data)||data.added!==true||typeof data.alreadySynced!=='boolean'||data.eventId!==eventId||typeof data.kakaoEventId!=='string'||!data.kakaoEventId||data.kakaoEventId.length>200)throw new Error('캘린더 추가 결과를 확인하지 못했어요. 다시 확인해 주세요.');
  return {added:true,alreadySynced:data.alreadySynced,eventId,kakaoEventId:data.kakaoEventId};
}
