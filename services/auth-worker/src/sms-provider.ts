import type {Env} from './types';

export interface SmsProviderResult {id:string;status:'accepted'|'rejected'|'unknown';messageId?:string;groupId?:string;code?:string}
export const SOLAPI_SEND_URL='https://api.solapi.com/messages/v4/send-many/detail';
const hex=(value:ArrayBuffer|Uint8Array)=>[...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
export async function solapiAuthorization(key:string,secret:string,date=new Date().toISOString(),salt=hex(crypto.getRandomValues(new Uint8Array(16)))) {
 const signer=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(await crypto.subtle.sign('HMAC',signer,new TextEncoder().encode(date+salt)));
 return `HMAC-SHA256 apiKey=${key}, date=${date}, salt=${salt}, signature=${signature}`;
}
export async function sendSolapi(messages:{id:string;to:string;text:string}[],env:Env):Promise<SmsProviderResult[]> {
 const unknown=()=>messages.map(message=>({id:message.id,status:'unknown' as const}));
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try {
  const response=await fetch(SOLAPI_SEND_URL,{method:'POST',signal:controller.signal,headers:{Authorization:await solapiAuthorization(env.SOLAPI_API_KEY!,env.SOLAPI_API_SECRET!),'Content-Type':'application/json'},body:JSON.stringify({messages:messages.map(message=>({to:message.to,from:env.SOLAPI_SENDER!.replace(/\D/g,''),text:message.text,type:'LMS',country:'82',autoTypeDetect:false,customFields:{moimId:message.id}})),showMessageList:true,allowDuplicates:false})});
  const data=await response.json() as {groupInfo?:{groupId?:string};messageList?:Record<string,unknown>[];failedMessageList?:Record<string,unknown>[];errorCode?:string};
  const found=new Map<string,SmsProviderResult>();
  for(const [entries,failed] of [[data.messageList,false],[data.failedMessageList,true]] as const)for(const entry of entries??[]) {
   const id=(entry.customFields as {moimId?:string}|undefined)?.moimId; if(!id||!messages.some(message=>message.id===id))continue;
   const code=String(entry.statusCode??'');const messageId=typeof entry.messageId==='string'?entry.messageId:undefined;
   found.set(id,{id,status:failed?'rejected':code==='2000'?'accepted':'unknown',...(messageId?{messageId}:{}),...(data.groupInfo?.groupId?{groupId:data.groupInfo.groupId}:{}),...(code?{code}: {})});
  }
  // An opaque error or timeout never proves that the provider did not accept the message.
  return messages.map(message=>found.get(message.id)??{id:message.id,status:'unknown'});
 }catch{return unknown();}finally{clearTimeout(timer);}
}
