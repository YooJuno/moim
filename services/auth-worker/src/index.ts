import {createApp} from './app';
import {createUser,customToken,FirestoreStore,lookupUser,verifyFirebaseToken} from './google';
import {exchangeProvider,kakaoCalendarCall,kakaoCalendarDelete,refreshKakao} from './providers';
import type {Env} from './types';
import {sendSolapi} from './sms-provider';
const dependencies=(env:Env,ctx?:{waitUntil:(promise:Promise<unknown>)=>void})=>({store:new FirestoreStore(env),now:Date.now,verifyIdToken:(token:string)=>verifyFirebaseToken(token,env),lookupUser:(uid:string)=>lookupUser(env,uid),createUser:(uid:string,name:string)=>createUser(env,uid,name),customToken:(uid:string)=>customToken(env,uid),providerExchange:(provider:import('./types').Provider,code:string,state:string,redirect:string)=>exchangeProvider(provider,code,state,redirect,env),calendarCall:kakaoCalendarCall,calendarDelete:kakaoCalendarDelete,refreshKakao:(token:string)=>refreshKakao(token,env),sendSms:(messages:{id:string;to:string;text:string}[])=>sendSolapi(messages,env),...(ctx?{waitUntil:(promise:Promise<unknown>)=>ctx.waitUntil(promise)}:{})});
export default {
 fetch(request:Request,env:Env,ctx?:{waitUntil:(promise:Promise<unknown>)=>void}){return createApp(env,dependencies(env,ctx)).fetch(request);},
 async scheduled(_controller:unknown,env:Env,ctx:{waitUntil:(promise:Promise<unknown>)=>void}){await createApp(env,dependencies(env,ctx)).processCalendarJobs();}
};
