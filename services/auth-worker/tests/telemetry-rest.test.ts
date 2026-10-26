import { expect, it, vi } from 'vitest';
import { FirestoreStore } from '../src/google';
import type { Env } from '../src/types';

it('queries only recent diagnostic records in descending order with a strict fifty-record maximum',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const raw=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));let binary='';for(const byte of raw)binary+=String.fromCharCode(byte);
  const env:Env={FIREBASE_PROJECT_ID:'demo-moim',FIREBASE_CLIENT_EMAIL:'telemetry-rest@example.test',FIREBASE_PRIVATE_KEY:`-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----`,ALLOWED_ORIGINS:''};
  const calls:{url:string;body:Record<string,unknown>}[]=[];
  const mock=vi.spyOn(globalThis,'fetch').mockImplementation(async(target,options)=>{
    if(String(target)==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'synthetic-token',expires_in:3600}));
    calls.push({url:String(target),body:JSON.parse(String(options?.body))});
    return new Response(JSON.stringify([{document:{fields:{id:{stringValue:'slot-001'},count:{integerValue:'2'}},updateTime:'2026-10-26T12:00:00.000Z'}}]));
  });
  try {
    const store=new FirestoreStore(env),since='2026-10-19T12:00:00.000Z';
    expect(await store.recentErrors(50,since)).toEqual([{data:{id:'slot-001',count:2},version:'2026-10-26T12:00:00.000Z'}]);
    expect(calls).toEqual([{url:'https://firestore.googleapis.com/v1/projects/demo-moim/databases/(default)/documents:runQuery',body:{structuredQuery:{from:[{collectionId:'appErrors'}],where:{fieldFilter:{field:{fieldPath:'lastSeenAt'},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:since}}},orderBy:[{field:{fieldPath:'lastSeenAt'},direction:'DESCENDING'}],limit:50}}}]);
    await expect(store.recentErrors(51,since)).rejects.toThrow('invalid_query');
    await expect(store.recentErrors(0,since)).rejects.toThrow('invalid_query');
    expect(calls).toHaveLength(1);
  } finally {mock.mockRestore();}
});
