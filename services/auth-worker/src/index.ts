import {createApp} from './app';
import {createUser,customToken,FirestoreStore,lookupUser,verifyFirebaseToken} from './google';
import {exchangeProvider,kakaoCalendarCall,refreshKakao} from './providers';
import type {Env} from './types';
import {sendSolapi} from './sms-provider';
export default {fetch(request:Request,env:Env,ctx?:{waitUntil:(promise:Promise<unknown>)=>void}){return createApp(env,{store:new FirestoreStore(env),now:Date.now,verifyIdToken:token=>verifyFirebaseToken(token,env),lookupUser:uid=>lookupUser(env,uid),createUser:(uid,name)=>createUser(env,uid,name),customToken:uid=>customToken(env,uid),providerExchange:(provider,code,state,redirect)=>exchangeProvider(provider,code,state,redirect,env),calendarCall:kakaoCalendarCall,refreshKakao:token=>refreshKakao(token,env),sendSms:messages=>sendSolapi(messages,env),...(ctx?{waitUntil:(promise:Promise<unknown>)=>ctx.waitUntil(promise)}:{})}).fetch(request);}};
