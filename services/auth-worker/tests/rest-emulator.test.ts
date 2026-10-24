import {expect,it,vi} from 'vitest';
import {FirestoreStore} from '../src/google';
import type {Env} from '../src/types';

it.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('verifies revisions and creates the SMS claim through actual Firestore REST transactions locally',async()=>{
 const host=process.env.FIRESTORE_EMULATOR_HOST!;if(!/^127\.0\.0\.1:\d+$|^localhost:\d+$/.test(host))throw new Error('Local emulator only');
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);const raw=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));let binary='';for(const byte of raw)binary+=String.fromCharCode(byte);
 const env:Env={FIREBASE_PROJECT_ID:'demo-moim',FIREBASE_CLIENT_EMAIL:'local-rest-only@example.com',FIREBASE_PRIVATE_KEY:`-----BEGIN PRIVATE KEY-----\n${btoa(binary)}\n-----END PRIVATE KEY-----`,ALLOWED_ORIGINS:''};
 const original=globalThis.fetch;const root=`http://${host}/v1/projects/demo-moim/databases/(default)/documents`;
 await original(`${root}/events/sms-rest-test`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:{id:{stringValue:'sms-rest-test'},title:{stringValue:'Synthetic local event'}}})});
 await original(`${root}/smsDeliveries/sms-rest-claim`,{method:'DELETE',headers:{Authorization:'Bearer owner'}});
 const mocked=vi.spyOn(globalThis,'fetch').mockImplementation(async(url,options)=>{const target=String(url);if(target.startsWith('https://oauth2.googleapis.com/'))return new Response(JSON.stringify({access_token:'synthetic-token',expires_in:3600}));if(!target.startsWith('https://firestore.googleapis.com/v1/'))throw new Error('External HTTP disabled');const headers=new Headers(options?.headers);headers.set('Authorization','Bearer owner');return original(target.replace('https://firestore.googleapis.com',`http://${host}`),{...options,headers});});
 try{const store=new FirestoreStore(env);const before=await store.get('events/sms-rest-test');await store.commit([{path:'events/sms-rest-test',verify:true,version:before!.version},{path:'smsDeliveries/sms-rest-claim',createOnly:true,data:{id:'sms-rest-claim',status:'processing'}}]);expect((await store.get('smsDeliveries/sms-rest-claim'))?.data.status).toBe('processing');expect((await store.get('events/sms-rest-test'))?.version).toBe(before!.version);
 await expect(store.commit([{path:'events/sms-rest-test',verify:true,version:'2020-01-01T00:00:00.000000Z'},{path:'smsDeliveries/must-not-exist',createOnly:true,data:{id:'must-not-exist'}}])).rejects.toThrow('concurrent_update');expect(await store.get('smsDeliveries/must-not-exist')).toBeNull();
 }finally{mocked.mockRestore();}
});
