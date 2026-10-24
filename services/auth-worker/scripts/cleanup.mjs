#!/usr/bin/env node
// Manual, bounded cleanup. Reads credentials from the local environment only.
import {webcrypto} from 'node:crypto';
const {FIREBASE_PROJECT_ID:project,FIREBASE_CLIENT_EMAIL:email,FIREBASE_PRIVATE_KEY:pem}=process.env;
if(!project||!email||!pem){console.error('FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY are required.');process.exit(1);}
const apply=process.argv.includes('--apply');const encode=value=>Buffer.from(value).toString('base64url');const now=Math.floor(Date.now()/1000);
try {
 const header=encode(JSON.stringify({alg:'RS256',typ:'JWT'})),claims=encode(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/cloud-platform',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const key=await webcrypto.subtle.importKey('pkcs8',Buffer.from(pem.replace(/\\n/g,'\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,''),'base64'),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const assertion=`${header}.${claims}.${encode(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5',key,Buffer.from(`${header}.${claims}`)))}`;
 const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});if(!auth.ok)throw Error('Service authentication failed.');const {access_token:token}=await auth.json();
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'},base=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents`;const candidates=[];
 for(const collectionId of ['authStates','authExchanges']){
  const response=await fetch(`${base}:runQuery`,{method:'POST',headers,body:JSON.stringify({structuredQuery:{from:[{collectionId}],where:{fieldFilter:{field:{fieldPath:'expiresAt'},op:'LESS_THAN_OR_EQUAL',value:{integerValue:String(Date.now())}}},limit:50}})});if(!response.ok)throw Error('Expired-document query failed.');for(const item of await response.json())if(item.document)candidates.push(item.document);
 }
 if(apply&&candidates.length){const response=await fetch(`${base}:commit`,{method:'POST',headers,body:JSON.stringify({writes:candidates.map(document=>({delete:document.name,currentDocument:{updateTime:document.updateTime}}))})});if(!response.ok)throw Error('Cleanup changed concurrently; rerun the bounded command.');}
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',expiredDocuments:candidates.length,deleted:apply?candidates.length:0,maximumPerRun:100}));
}catch(error){console.error(error instanceof Error?error.message:'Cleanup failed.');process.exitCode=1;}
