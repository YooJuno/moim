import {expect,it,vi} from 'vitest';
import {FirestoreStore} from '../src/google';
import type {Env} from '../src/types';

it('claims SMS logs in a REST transaction while checking original document revisions without rewriting them',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const raw=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));let binary='';for(const byte of raw)binary+=String.fromCharCode(byte);
 const env:Env={FIREBASE_PROJECT_ID:'demo',FIREBASE_CLIENT_EMAIL:'rest-guard-test@example.com',FIREBASE_PRIVATE_KEY:`-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----`,ALLOWED_ORIGINS:''};
 const prefix='projects/demo/databases/(default)/documents/';const requests:{url:string;body:Record<string,unknown>}[]=[];
 const mocked=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{const target=String(url);if(target.includes('oauth2.googleapis.com'))return new Response(JSON.stringify({access_token:'synthetic-token',expires_in:3600}));const body=JSON.parse(options?.body as string||'{}');requests.push({url:target,body});if(target.endsWith(':beginTransaction'))return new Response(JSON.stringify({transaction:'synthetic-transaction'}));if(target.endsWith(':batchGet'))return new Response(JSON.stringify([{found:{name:prefix+'events/e1',updateTime:'revision-1'}},{missing:prefix+'rsvps/e1_member'}]));return new Response('{}');});
 try{const store=new FirestoreStore(env);await store.commit([{path:'events/e1',verify:true,version:'revision-1'},{path:'rsvps/e1_member',verify:true,createOnly:true},{path:'smsDeliveries/claim',createOnly:true,data:{id:'claim',status:'processing'}}]);const commit=requests.find(request=>request.url.endsWith(':commit'))!.body;expect(commit.transaction).toBe('synthetic-transaction');expect(commit.writes).toEqual([{update:{name:prefix+'smsDeliveries/claim',fields:{id:{stringValue:'claim'},status:{stringValue:'processing'}}},currentDocument:{exists:false}}]);expect(requests.find(request=>request.url.endsWith(':batchGet'))!.body).toMatchObject({documents:[prefix+'events/e1',prefix+'rsvps/e1_member'],transaction:'synthetic-transaction'});
 requests.length=0;await expect(store.commit([{path:'events/e1',verify:true,version:'older-revision'},{path:'smsDeliveries/second',createOnly:true,data:{id:'second'}}])).rejects.toThrow('concurrent_update');expect(requests.some(request=>request.url.endsWith(':commit'))).toBe(false);expect(requests.some(request=>request.url.endsWith(':rollback'))).toBe(true);
 }finally{mocked.mockRestore();}
});
