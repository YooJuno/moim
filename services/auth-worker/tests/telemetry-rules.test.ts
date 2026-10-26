import { afterAll, beforeAll, describe, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment:RulesTestEnvironment;
describe.skipIf(!enabled)('server-only diagnostic documents',()=>{
  beforeAll(async()=>{
    environment=await initializeTestEnvironment({projectId:'demo-moim-telemetry',firestore:{rules:readFileSync(new URL('../../../firestore.rules',import.meta.url),'utf8')}});
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async context=>{
      await setDoc(doc(context.firestore(),'appErrors','slot-000'),{code:'auth/network-request-failed'});
      await setDoc(doc(context.firestore(),'appErrorMeta','budget'),{day:'2026-10-26',count:1});
      await setDoc(doc(context.firestore(),'members','administrator'),{role:'leader',status:'active'});
    });
  },30000);
  afterAll(async()=>{await environment?.cleanup();});
  it('denies direct client reads, listing, writes and deletes even for the administrator',async()=>{
    for(const db of [environment.unauthenticatedContext().firestore(),environment.authenticatedContext('administrator').firestore(),environment.authenticatedContext('pending').firestore()])for(const [name,id] of [['appErrors','slot-000'],['appErrorMeta','budget']]){
      await assertFails(getDoc(doc(db,name,id)));
      await assertFails(getDocs(collection(db,name)));
      await assertFails(setDoc(doc(db,name,id),{code:'forged'}));
      await assertFails(deleteDoc(doc(db,name,id)));
    }
  });
});
