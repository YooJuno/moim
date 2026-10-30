import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Bytes, collection, deleteDoc, deleteField, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where, writeBatch } from 'firebase/firestore';

const enabled=Boolean(process.env.FIRESTORE_EMULATOR_HOST);
let environment: RulesTestEnvironment;
const now=new Date().toISOString();
const member=(id: string,role='member',status='active',canCreatePoll=false)=>({id,name:id,email:`${id}@example.com`,role,status,canCreatePoll,joinedAt:now});
const post=(id: string,authorId='member',category='chat')=>({id,category,title:'제목',body:'내용',authorId,createdAt:now,updatedAt:now,images:[],pinned:false,likedBy:[]});
const poll=(id: string,deadline=Date.now()+86400000)=>({id,title:'투표',description:'가능한 시간',slots:[{id:'s1',date:'2026-11-01',start:'14:00',end:'16:00'}],slotIds:['s1'],deadline:new Date(deadline).toISOString(),deadlineAt:Timestamp.fromMillis(deadline),status:'open',creatorId:'creator',createdAt:now,updatedAt:now});
const calendarLink=(ownerId='leader')=>({ownerId,googleEventId:'google-event-1',htmlLink:'https://calendar.google.com/calendar/event?eid=local-test',syncedAt:now,attendeeIds:['member'],signature:'version-1'});
const event=(id: string)=>({id,title:'모임',description:'일정',date:'2026-11-01',start:'14:00',end:'16:00',location:'서울',creatorId:'leader',createdAt:now,endAt:Timestamp.fromDate(new Date('2026-11-01T16:00:00+09:00'))});
const client=(id: string)=>environment.authenticatedContext(id,{email:`${id}@example.com`}).firestore();
const ballot=(id:string,kind='venue')=>({id,eventId:'e1',kind,title:kind==='venue'?'장소 투표':'MVP 투표',options:[{id:'o1',label:'식당 A',detail:'서울 마포구',menu:'파스타'},{id:'o2',label:'식당 B'}],optionIds:['o1','o2'],status:'open',creatorId:kind==='venue'?'creator':'leader',createdAt:now,updatedAt:now});
const ledger=(id: string,creatorId='treasurer')=>({id,type:'income',category:'회비',amount:10000,date:'2026-10-24',description:'회비 납부',creatorId,createdAt:now,updatedAt:now});
const fileRecord=(id:string,postId='p1',ownerId='member',uploadedBy=ownerId,size=3)=>({id,postId,ownerId,uploadedBy,size,name:'기록.bin',mimeType:'application/octet-stream',createdAt:now,chunkCount:Math.ceil(size/786432),sha256:'a'.repeat(64)});
const fileReference=(file:ReturnType<typeof fileRecord>)=>({id:file.id,name:file.name,size:file.size,mimeType:file.mimeType});
function stageFile(db:ReturnType<typeof client>,file:ReturnType<typeof fileRecord>,missingIndex=-1){const batch=writeBatch(db);for(let index=0;index<file.chunkCount;index++){if(index===missingIndex)continue;const length=Math.min(786432,file.size-index*786432);batch.set(doc(db,'postFiles',file.id,'chunks',String(index)),{index,bytes:Bytes.fromUint8Array(new Uint8Array(length))});}batch.set(doc(db,'postFiles',file.id),file);return batch.commit();}
function removeFile(db:ReturnType<typeof client>,id:string){const batch=writeBatch(db);for(let index=0;index<7;index++)batch.delete(doc(db,'postFiles',id,'chunks',String(index)));batch.delete(doc(db,'postFiles',id));return batch.commit();}

describe.skipIf(!enabled)('Firebase access boundaries',()=>{
  beforeAll(async()=>{
    environment=await initializeTestEnvironment({projectId:'demo-moim',firestore:{rules:readFileSync(new URL('../firestore.rules',import.meta.url),'utf8')}});
  },30000);
  beforeEach(async()=>{
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async context=>{
      const db=context.firestore();const batch=writeBatch(db);
      for(const record of [member('leader','leader'),member('leader2','leader'),member('treasurer','treasurer'),member('member'),member('creator','member','active',true),member('pending','member','pending'),member('rejected','member','rejected')]) batch.set(doc(db,'members',record.id),record);
      for(const id of ['leader','treasurer','member','pending']) batch.set(doc(db,'profiles',id),{id,phone:'010-0000-0000',area:'서울'});
      batch.set(doc(db,'settings','club'),{name:'테스트 모임',description:''});
      batch.set(doc(db,'settings','bylaws'),{content:'회칙',updatedAt:now,editorId:'leader'});
      batch.set(doc(db,'posts','p1'),post('p1'));
      batch.set(doc(db,'posts','notice'),post('notice','leader','notice'));
      batch.set(doc(db,'polls','open'),poll('open'));
      batch.set(doc(db,'polls','no-deadline'),{...poll('no-deadline'),deadline:null,deadlineAt:null,slotMinutes:30,timeWindows:[{id:'w1',date:'2026-11-01',start:'14:00',end:'16:00'}]});
      batch.set(doc(db,'polls','expired'),poll('expired',Date.now()-86400000));
      batch.set(doc(db,'polls','confirmed'),{...poll('confirmed'),status:'confirmed',eventId:'poll-confirmed'});
      batch.set(doc(db,'events','e1'),event('e1'));
      batch.set(doc(db,'events','poll-confirmed'),{...event('poll-confirmed'),pollId:'confirmed'});
      batch.set(doc(db,'ledger','l1'),ledger('l1'));
      batch.set(doc(db,'places','saved'),{id:'saved',name:'테스트 장소',address:'테스트 지역',createdAt:now,updatedAt:now});
      batch.set(doc(db,'ballots','venue'),ballot('venue'));
      for(const [id,offset] of [['mvp-before',3600000],['mvp-open',300000],['mvp-expired',-90000000]] as const){
        batch.set(doc(db,'events',id),{...event(id),endAt:Timestamp.fromMillis(Date.now()+offset)});
        for(const memberId of ['member','creator'])batch.set(doc(db,'rsvps',`${id}_${memberId}`),{id:`${id}_${memberId}`,eventId:id,memberId,status:'going',updatedAt:now});
      }
      await batch.commit();
    });
  });
  afterAll(async()=>{await environment?.cleanup();});

  it('blocks anonymous and rejected users from member content',async()=>{
    for(const db of [environment.unauthenticatedContext().firestore(),client('rejected')]) {
      await assertFails(getDoc(doc(db,'settings','club')));
      await assertFails(getDocs(collection(db,'posts')));
      await assertFails(getDoc(doc(db,'ledger','l1')));
    }
    await assertSucceeds(getDoc(doc(client('pending'),'members','pending')));
    await assertSucceeds(getDoc(doc(client('pending'),'profiles','pending')));
  });
  it('creates new Google users only as pending members without privileges',async()=>{
    const db=client('new');
    await assertFails(setDoc(doc(db,'members','new'),member('new','leader')));
    await assertFails(setDoc(doc(db,'members','new'),member('new','member','active')));
    await assertFails(setDoc(doc(db,'members','new'),member('new','member','pending',true)));
    await assertSucceeds(setDoc(doc(db,'members','new'),member('new','member','pending')));
    await assertFails(updateDoc(doc(db,'members','new'),{status:'active'}));
  });
  it('protects phone and area from other members and treasurers',async()=>{
    await assertSucceeds(getDoc(doc(client('member'),'profiles','member')));
    await assertSucceeds(getDoc(doc(client('leader'),'profiles','member')));
    await assertFails(getDoc(doc(client('treasurer'),'profiles','member')));
    await assertFails(getDoc(doc(client('creator'),'profiles','member')));
    await assertFails(getDocs(collection(client('member'),'profiles')));
  });
  it('allows filtered active directory reads and prevents self role escalation',async()=>{
    const db=client('member');
    await assertSucceeds(getDocs(query(collection(db,'members'),where('status','==','active'))));
    await assertFails(getDocs(collection(db,'members')));
    await assertSucceeds(updateDoc(doc(db,'members','member'),{name:'변경한 이름'}));
    await assertFails(updateDoc(doc(db,'members','member'),{role:'leader'}));
    await assertFails(updateDoc(doc(db,'members','member'),{canCreatePoll:true}));
    await assertFails(updateDoc(doc(client('leader'),'members','leader'),{role:'member'}));
    await assertSucceeds(updateDoc(doc(client('leader'),'members','pending'),{status:'active'}));
  });
  it('limits notices, pin changes, settings and bylaws to leaders',async()=>{
    const memberDb=client('member');
    await assertFails(setDoc(doc(memberDb,'posts','n2'),post('n2','member','notice')));
    await assertFails(updateDoc(doc(memberDb,'posts','p1'),{pinned:true}));
    await assertFails(setDoc(doc(memberDb,'settings','club'),{name:'변경',description:''}));
    await assertFails(setDoc(doc(client('treasurer'),'settings','bylaws'),{content:'변경',updatedAt:now,editorId:'treasurer'}));
    await assertSucceeds(setDoc(doc(client('leader'),'settings','bylaws'),{content:'변경',updatedAt:now,editorId:'leader'}));
    await assertSucceeds(setDoc(doc(memberDb,'posts','p2'),post('p2')));
    await assertFails(updateDoc(doc(client('creator'),'posts','p1'),{body:'다른 사람 글 수정'}));
  });
  it('allows only own like changes without forging other member likes',async()=>{
    const db=client('member');
    await assertSucceeds(updateDoc(doc(db,'posts','p1'),{likedBy:['member']}));
    await assertFails(updateDoc(doc(db,'posts','p1'),{likedBy:['member','creator']}));
    await assertFails(updateDoc(doc(db,'posts','p1'),{likedBy:['member','member']}));
    await assertSucceeds(updateDoc(doc(db,'posts','p1'),{likedBy:[]}));
  });
  it('requires explicit poll creation permission and preserves creator identity',async()=>{
    await assertFails(setDoc(doc(client('member'),'polls','new'),{...poll('new'),creatorId:'member'}));
    await assertSucceeds(setDoc(doc(client('creator'),'polls','new'),poll('new')));
    await assertFails(updateDoc(doc(client('member'),'polls','open'),{title:'임의 변경'}));
    await assertFails(updateDoc(doc(client('creator'),'polls','open'),{creatorId:'member'}));
    await assertSucceeds(updateDoc(doc(client('creator'),'polls','open'),{title:'수정'}));
    await assertFails(updateDoc(doc(client('creator'),'polls','confirmed'),{title:'확정 후 수정'}));
    await assertFails(deleteDoc(doc(client('leader'),'polls','confirmed')));
  });
  it('accepts own valid availability and an empty answer, rejecting expired and forged votes',async()=>{
    const db=client('member');
    const vote={id:'open_member',pollId:'open',memberId:'member',slotIds:['s1'],updatedAt:now};
    await assertSucceeds(setDoc(doc(db,'votes','open_member'),vote));
    await assertSucceeds(setDoc(doc(db,'votes','open_member'),{...vote,slotIds:[]}));
    await assertFails(setDoc(doc(db,'votes','open_member'),{...vote,slotIds:['unknown']}));
    await assertFails(setDoc(doc(db,'votes','open_creator'),{...vote,id:'open_creator',memberId:'creator'}));
    await assertFails(setDoc(doc(db,'votes','expired_member'),{...vote,id:'expired_member',pollId:'expired'}));
    await assertFails(setDoc(doc(db,'votes','confirmed_member'),{...vote,id:'confirmed_member',pollId:'confirmed'}));
  });
  it('confirms a poll with one linked event atomically, for leaders only',async()=>{
    const creatorDb=client('creator');
    await assertFails(updateDoc(doc(creatorDb,'polls','open'),{status:'confirmed',eventId:'poll-fresh-instance'}));
    const db=client('leader');
    await assertFails(updateDoc(doc(db,'polls','open'),{status:'confirmed',eventId:'poll-fresh-instance'}));
    const batch=writeBatch(db);
    batch.set(doc(db,'events','poll-fresh-instance'),{...event('poll-fresh-instance'),pollId:'open'});
    batch.update(doc(db,'polls','open'),{status:'confirmed',eventId:'poll-fresh-instance'});
    await assertSucceeds(batch.commit());
  });
  it('cannot confirm a poll by reusing an existing event and its old responses',async()=>{
    await environment.withSecurityRulesDisabled(async context=>{await updateDoc(doc(context.firestore(),'events','e1'),{pollId:'open'});});
    const db=client('leader'),batch=writeBatch(db);
    batch.set(doc(db,'events','e1'),{...event('e1'),pollId:'open'});
    batch.update(doc(db,'polls','open'),{status:'confirmed',eventId:'e1'});
    await assertFails(batch.commit());
    expect((await getDoc(doc(db,'polls','open'))).data()!.status).toBe('open');
  });
  it('returns a confirmed poll to closed only when its linked event is deleted in the same batch',async()=>{
    const db=client('leader');
    await assertFails(updateDoc(doc(db,'polls','confirmed'),{status:'closed',eventId:deleteField()}));
    const batch=writeBatch(db);
    batch.delete(doc(db,'events','poll-confirmed'));
    batch.update(doc(db,'polls','confirmed'),{status:'closed',eventId:deleteField()});
    await assertSucceeds(batch.commit());
  });
  it('limits event editing to leaders and RSVPs to the responding member',async()=>{
    await assertFails(setDoc(doc(client('treasurer'),'events','e2'),{...event('e2'),creatorId:'treasurer'}));
    await assertSucceeds(setDoc(doc(client('leader'),'events','e2'),event('e2')));
    const rsvp={id:'e1_member',eventId:'e1',memberId:'member',status:'going',updatedAt:now};
    await assertSucceeds(setDoc(doc(client('member'),'rsvps','e1_member'),rsvp));
    await assertFails(setDoc(doc(client('creator'),'rsvps','e1_member'),rsvp));
    await assertFails(setDoc(doc(client('member'),'rsvps','unknown_member'),{...rsvp,id:'unknown_member',eventId:'unknown'}));
  });

  it('allows no-deadline votes until manual closure and validates optional deadline pairs',async()=>{
    const db=client('member');
    const vote={id:'no-deadline_member',pollId:'no-deadline',memberId:'member',slotIds:['s1'],updatedAt:now};
    await assertSucceeds(setDoc(doc(db,'votes',vote.id),vote));
    await assertSucceeds(updateDoc(doc(client('creator'),'polls','no-deadline'),{status:'closed'}));
    await assertFails(setDoc(doc(db,'votes',vote.id),{...vote,slotIds:[]}));
    await assertSucceeds(updateDoc(doc(client('creator'),'polls','no-deadline'),{status:'open'}));
    await assertSucceeds(setDoc(doc(db,'votes',vote.id),{...vote,slotIds:[]}));
    await assertFails(setDoc(doc(client('creator'),'polls','invalid-null'),{...poll('invalid-null'),deadline:null}));
    await assertFails(setDoc(doc(client('creator'),'polls','invalid-timestamp'),{...poll('invalid-timestamp'),deadlineAt:null}));
  });
  it('supports 2000 fine-grained availability candidates and rejects invalid segmentation metadata',async()=>{
    const slots=Array.from({length:2000},(_,index)=>({id:`segment-${index}`,date:'2026-11-01',start:'14:00',end:'14:30'}));
    const detailed={...poll('segments'),slots,slotIds:slots.map(slot=>slot.id),deadline:null,deadlineAt:null,slotMinutes:30,timeWindows:[{id:'window',date:'2026-11-01',start:'14:00',end:'16:00'}]};
    await assertSucceeds(setDoc(doc(client('creator'),'polls','segments'),detailed));
    await assertSucceeds(setDoc(doc(client('member'),'votes','segments_member'),{id:'segments_member',pollId:'segments',memberId:'member',slotIds:detailed.slotIds,updatedAt:now}));
    await assertFails(updateDoc(doc(client('creator'),'polls','segments'),{slotMinutes:15}));
    await assertFails(updateDoc(doc(client('creator'),'polls','segments'),{timeWindows:Array.from({length:249},()=>detailed.timeWindows[0])}));
    await assertFails(updateDoc(doc(client('creator'),'polls','segments'),{slots:[...slots,{...slots[0],id:'one-too-many'}],slotIds:[...detailed.slotIds,'one-too-many']}));
  });
  it('restricts calendar metadata to the linking leader while other leaders can edit event details',async()=>{
    const leaderDb=client('leader'),otherDb=client('leader2');
    await assertFails(updateDoc(doc(client('member'),'events','e1'),{calendarLink:calendarLink('member')}));
    await assertFails(updateDoc(doc(client('treasurer'),'events','e1'),{calendarLink:calendarLink('treasurer')}));
    await assertSucceeds(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:calendarLink()}));
    await assertSucceeds(updateDoc(doc(otherDb,'events','e1'),{title:'다른 관리자의 일정 수정'}));
    await assertFails(updateDoc(doc(otherDb,'events','e1'),{calendarLink:calendarLink('leader2')}));
    await assertFails(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:calendarLink('leader2')}));
    await assertFails(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:deleteField()}));
    await assertSucceeds(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:{...calendarLink(),signature:'version-2',attendeeIds:['member','creator']}}));
    await assertFails(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:{...calendarLink(),htmlLink:'javascript:alert(1)'}}));
    await assertFails(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:{...calendarLink(),attendeeIds:['member','member']}}));
    await assertFails(updateDoc(doc(leaderDb,'events','e1'),{calendarLink:{...calendarLink(),accessToken:'never-store-tokens'}}));
  });
  it('allows only leader-managed raster thumbnails in group settings, including removal',async()=>{
    const db=client('leader');const settings={name:'모임 사진',description:'대표 이미지',photoURL:'data:image/png;base64,aGVsbG8='};
    await assertSucceeds(setDoc(doc(db,'settings','club'),settings));
    await assertFails(setDoc(doc(client('member'),'settings','club'),settings));
    await assertFails(setDoc(doc(db,'settings','club'),{...settings,photoURL:'data:image/svg+xml;base64,aGVsbG8='}));
    await assertFails(setDoc(doc(db,'settings','club'),{...settings,photoURL:'https://example.com/photo.jpg'}));
    await assertFails(setDoc(doc(db,'settings','club'),{...settings,photoURL:'data:image/png;base64,'+'a'.repeat(180000)}));
    await assertSucceeds(setDoc(doc(db,'settings','club'),{name:'모임 사진',description:'대표 이미지 삭제'}));
  });


  it('allows delegated venue ballots while limiting legacy manual MVP setup to leaders',async()=>{
    await assertSucceeds(setDoc(doc(client('creator'),'ballots','new-venue'),ballot('new-venue')));
    await assertFails(setDoc(doc(client('member'),'ballots','member-venue'),{...ballot('member-venue'),creatorId:'member'}));
    await assertFails(setDoc(doc(client('creator'),'ballots','manual-mvp'),{...ballot('manual-mvp','mvp'),creatorId:'creator'}));
    await assertFails(setDoc(doc(client('creator'),'ballots','missing-event'),{...ballot('missing-event'),eventId:'missing'}));
    await assertFails(updateDoc(doc(client('member'),'ballots','venue'),{title:'다른 사람 수정'}));
    await assertSucceeds(updateDoc(doc(client('creator'),'ballots','venue'),{title:'후보 업데이트'}));
  });
  it('stores one editable own venue choice only while open and rejects forged options or identities',async()=>{
    const db=client('member');const response={id:'venue_member',ballotId:'venue',eventId:'e1',memberId:'member',optionId:'o1',updatedAt:now};
    await assertSucceeds(setDoc(doc(db,'ballotResponses',response.id),response));
    await assertSucceeds(setDoc(doc(db,'ballotResponses',response.id),{...response,optionId:'o2'}));
    await assertFails(setDoc(doc(db,'ballotResponses',response.id),{...response,optionId:'unknown'}));
    await assertFails(setDoc(doc(db,'ballotResponses','venue_creator'),{...response,id:'venue_creator',memberId:'creator'}));
    await assertFails(setDoc(doc(db,'ballotResponses',response.id),{...response,eventId:'different-event'}));
    await assertSucceeds(updateDoc(doc(client('creator'),'ballots','venue'),{status:'closed'}));
    await assertFails(setDoc(doc(db,'ballotResponses',response.id),response));
  });
  it('allows only ballot managers to remove closed responses together with the deleted ballot',async()=>{
    const response={id:'venue_member',ballotId:'venue',eventId:'e1',memberId:'member',optionId:'o1',updatedAt:now};
    await assertSucceeds(setDoc(doc(client('member'),'ballotResponses',response.id),response));
    await assertFails(deleteDoc(doc(client('creator'),'ballotResponses',response.id)));
    await assertSucceeds(updateDoc(doc(client('creator'),'ballots','venue'),{status:'closed'}));
    await assertFails(deleteDoc(doc(client('member'),'ballotResponses',response.id)));
    const db=client('creator');const batch=writeBatch(db);batch.delete(doc(db,'ballotResponses',response.id));batch.delete(doc(db,'ballots','venue'));await assertSucceeds(batch.commit());
  });
  it('confirms venue and event location together, including the thirtieth option',async()=>{
    const db=client('leader');
    const options=Array.from({length:30},(_,index)=>({id:`v${index}`,label:`장소 ${index}`,detail:`주소 ${index}`,menu:'함께 먹을 메뉴'}));
    await environment.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'ballots','venue30'),{...ballot('venue30'),options,optionIds:options.map(option=>option.id)});});
    await assertFails(updateDoc(doc(db,'ballots','venue30'),{status:'confirmed',selectedOptionId:'v29'}));
    const incorrect=writeBatch(db);incorrect.update(doc(db,'events','e1'),{location:'다른 장소'});incorrect.update(doc(db,'ballots','venue30'),{status:'confirmed',selectedOptionId:'v29'});await assertFails(incorrect.commit());
    const batch=writeBatch(db);batch.update(doc(db,'events','e1'),{location:'장소 29 · 주소 29'});batch.update(doc(db,'ballots','venue30'),{status:'confirmed',selectedOptionId:'v29'});await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db,'ballots','venue30'),{status:'open'}));
    await assertFails(deleteDoc(doc(db,'ballots','venue30')));
  });
  it('opens MVP voting ten minutes before event end and closes it after 24 hours',async()=>{
    const db=client('member');
    const vote=(eventId:string)=>({id:`${eventId}_member`,eventId,memberId:'member',candidateId:'creator',updatedAt:now});
    await assertFails(setDoc(doc(db,'mvpVotes','mvp-before_member'),vote('mvp-before')));
    await assertSucceeds(setDoc(doc(db,'mvpVotes','mvp-open_member'),vote('mvp-open')));
    await assertSucceeds(setDoc(doc(db,'mvpVotes','mvp-open_member'),{...vote('mvp-open'),candidateId:'member'}));
    await assertFails(setDoc(doc(db,'mvpVotes','mvp-expired_member'),vote('mvp-expired')));
    await assertFails(setDoc(doc(client('leader'),'mvpVotes','mvp-open_leader'),{...vote('mvp-open'),id:'mvp-open_leader',memberId:'leader'}));
    await assertFails(setDoc(doc(db,'mvpVotes','mvp-open_member'),{...vote('mvp-open'),candidateId:'leader'}));
    await assertFails(setDoc(doc(db,'mvpVotes','mvp-open_creator'),{...vote('mvp-open'),id:'mvp-open_creator',memberId:'creator'}));
  });


  it('lets only leaders add offline roster records without granting authentication permissions',async()=>{
    const record={...member('roster-test'),email:'',isRoster:true,position:'회장'};
    await assertFails(setDoc(doc(client('member'),'members',record.id),record));
    await assertFails(setDoc(doc(client('treasurer'),'members',record.id),record));
    await assertSucceeds(setDoc(doc(client('leader'),'members',record.id),record));
    await assertFails(setDoc(doc(client('leader'),'members','roster-admin'),{...record,id:'roster-admin',role:'leader'}));
    await assertFails(setDoc(doc(client('new'),'members','new'),{...member('new','member','pending'),position:'회장'}));
    await assertFails(setDoc(doc(client('new'),'members','new'),{...member('new','member','pending'),isRoster:true}));
    await assertFails(updateDoc(doc(client('member'),'members','member'),{position:'회장'}));
    await assertSucceeds(updateDoc(doc(client('leader'),'members','member'),{position:'회장'}));
    await assertFails(updateDoc(doc(client('leader'),'members','member'),{isRoster:true}));
  });
  it('validates private month-day birthdays including leap day and rejects invalid dates',async()=>{
    const db=client('member');const profile={id:'member',phone:'',area:'',birthday:'02-29'};
    await assertSucceeds(setDoc(doc(db,'profiles','member'),profile));
    await assertFails(setDoc(doc(db,'profiles','member'),{...profile,birthday:'02-30'}));
    await assertFails(setDoc(doc(db,'profiles','member'),{...profile,birthday:'04-31'}));
    await assertFails(setDoc(doc(db,'profiles','member'),{...profile,birthday:'2000-02-29'}));
    await assertFails(getDoc(doc(client('treasurer'),'profiles','member')));
    await assertSucceeds(getDoc(doc(client('leader'),'profiles','member')));
    await assertSucceeds(updateDoc(doc(db,'members','member'),{birthday:'02-29'}));
    await assertSucceeds(setDoc(doc(db,'profiles','member'),{id:'member',phone:'',area:''}));
  });
  it('links a roster to a real signup and removes only roster documents in one authorized batch',async()=>{
    const leader=client('leader');const roster={...member('roster-link'),email:'',isRoster:true,position:'부회장'};
    await assertSucceeds(setDoc(doc(leader,'members','roster-link'),roster));
    await assertSucceeds(setDoc(doc(leader,'profiles','roster-link'),{id:'roster-link',phone:'010-0000-0000',area:'테스트 지역',birthday:'03-15'}));
    await assertFails(deleteDoc(doc(client('member'),'members','roster-link')));
    const batch=writeBatch(leader);
    batch.update(doc(leader,'members','pending'),{name:roster.name,status:'active',isRoster:false,position:'부회장'});
    batch.set(doc(leader,'profiles','pending'),{id:'pending',phone:'010-0000-0000',area:'테스트 지역',birthday:'03-15'});
    batch.delete(doc(leader,'profiles','roster-link'));batch.delete(doc(leader,'members','roster-link'));
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(client('pending'),'profiles','pending')));
    await assertFails(deleteDoc(doc(leader,'members','pending')));
    await assertFails(deleteDoc(doc(leader,'profiles','pending')));
  });


  it('stores receipt image and ledger flag atomically with accountant-only writes and active reads',async()=>{
    const db=client('treasurer');const receipt={entryId:'l1',fileName:'receipt.png',imageURL:'data:image/png;base64,aGVsbG8=',uploadedBy:'treasurer',updatedAt:now};
    await assertFails(setDoc(doc(db,'receipts','l1'),receipt));
    await assertFails(updateDoc(doc(db,'ledger','l1'),{hasReceipt:true}));
    const memberDb=client('member');const unauthorized=writeBatch(memberDb);unauthorized.set(doc(memberDb,'receipts','l1'),{...receipt,uploadedBy:'member'});unauthorized.update(doc(memberDb,'ledger','l1'),{hasReceipt:true});await assertFails(unauthorized.commit());
    const batch=writeBatch(db);batch.set(doc(db,'receipts','l1'),receipt);batch.update(doc(db,'ledger','l1'),{hasReceipt:true});await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(client('member'),'receipts','l1')));
    await assertSucceeds(getDoc(doc(client('pending'),'receipts','l1')));
    await assertFails(updateDoc(doc(db,'receipts','l1'),{imageURL:'data:image/svg+xml;base64,aGVsbG8='}));
    await assertFails(updateDoc(doc(db,'receipts','l1'),{imageURL:'data:image/png;base64,'+'a'.repeat(700000)}));
    await assertFails(updateDoc(doc(db,'receipts','l1'),{uploadedBy:'leader'}));
    await assertFails(updateDoc(doc(db,'ledger','l1'),{hasReceipt:false}));
    await assertFails(deleteDoc(doc(db,'receipts','l1')));
    await assertFails(deleteDoc(doc(db,'ledger','l1')));
    const remove=writeBatch(db);remove.delete(doc(db,'receipts','l1'));remove.update(doc(db,'ledger','l1'),{hasReceipt:false});await assertSucceeds(remove.commit());
  });
  it('deletes receipt together with the parent ledger entry and prevents orphan receipt uploads',async()=>{
    const db=client('leader');const receipt={entryId:'l1',fileName:'receipt.jpg',imageURL:'data:image/jpeg;base64,aGVsbG8=',uploadedBy:'leader',updatedAt:now};
    const add=writeBatch(db);add.set(doc(db,'receipts','l1'),receipt);add.update(doc(db,'ledger','l1'),{hasReceipt:true});await assertSucceeds(add.commit());
    await assertSucceeds(updateDoc(doc(db,'ledger','l1'),{description:'수정해도 첨부 유지'}));
    const remove=writeBatch(db);remove.delete(doc(db,'receipts','l1'));remove.delete(doc(db,'ledger','l1'));await assertSucceeds(remove.commit());
    await assertFails(setDoc(doc(db,'receipts','l1'),receipt));
  });


  it('exposes saved places only to active members',async()=>{
    await assertSucceeds(getDocs(collection(client('member'),'places')));
    await assertSucceeds(getDoc(doc(client('treasurer'),'places','saved')));
    await assertSucceeds(getDocs(collection(client('pending'),'places')));
    await assertFails(getDoc(doc(client('rejected'),'places','saved')));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(),'places','saved')));
  });
  it('restricts saved-place CRUD to leaders and preserves the creation date',async()=>{
    const place={id:'new-place',name:'장소 이름',address:'모임 장소 주소',createdAt:now,updatedAt:now};
    await assertFails(setDoc(doc(client('member'),'places',place.id),place));
    await assertFails(updateDoc(doc(client('treasurer'),'places','saved'),{name:'임의 변경'}));
    await assertFails(deleteDoc(doc(client('member'),'places','saved')));
    const db=client('leader');await assertSucceeds(setDoc(doc(db,'places',place.id),place));
    await assertSucceeds(updateDoc(doc(db,'places',place.id),{address:'다른 주소'}));
    await assertFails(updateDoc(doc(db,'places',place.id),{createdAt:'changed'}));
    await assertSucceeds(deleteDoc(doc(db,'places',place.id)));
  });
  it('rejects malformed saved-place fields, empty names and oversized addresses',async()=>{
    const db=client('leader');const place={id:'invalid',name:'장소',address:'주소',createdAt:now,updatedAt:now};
    await assertFails(setDoc(doc(db,'places',place.id),{...place,name:''}));
    await assertFails(setDoc(doc(db,'places',place.id),{...place,name:'a'.repeat(81)}));
    await assertFails(setDoc(doc(db,'places',place.id),{...place,address:''}));
    await assertFails(setDoc(doc(db,'places',place.id),{...place,address:'a'.repeat(301)}));
    await assertFails(setDoc(doc(db,'places',place.id),{...place,id:'different'}));
    await assertFails(setDoc(doc(db,'places',place.id),{...place,privateField:'not-allowed'}));
  });


  it('allows active members to create and read immutable group photos with owner or leader deletion',async()=>{
    const db=client('member');const photo={id:'group-photo',imageURL:'data:image/jpeg;base64,aGVsbG8=',uploadedBy:'member',createdAt:now};
    await assertSucceeds(setDoc(doc(db,'photos',photo.id),photo));
    await assertSucceeds(getDoc(doc(client('creator'),'photos',photo.id)));
    await assertSucceeds(getDoc(doc(client('pending'),'photos',photo.id)));
    await assertFails(updateDoc(doc(db,'photos',photo.id),{imageURL:'data:image/jpeg;base64,YQ=='}));
    await assertFails(deleteDoc(doc(client('creator'),'photos',photo.id)));
    await assertSucceeds(deleteDoc(doc(client('leader'),'photos',photo.id)));
    await assertSucceeds(setDoc(doc(db,'photos',photo.id),photo));await assertSucceeds(deleteDoc(doc(db,'photos',photo.id)));
  });
  it('rejects unapproved, forged, oversized and non-raster group photo uploads',async()=>{
    const photo={id:'invalid-photo',imageURL:'data:image/png;base64,aGVsbG8=',uploadedBy:'member',createdAt:now};const db=client('member');
    await assertFails(setDoc(doc(client('pending'),'photos',photo.id),{...photo,uploadedBy:'pending'}));
    await assertFails(setDoc(doc(db,'photos',photo.id),{...photo,uploadedBy:'leader'}));
    await assertFails(setDoc(doc(db,'photos',photo.id),{...photo,imageURL:'data:image/png;base64,'+'a'.repeat(700000)}));
    await assertFails(setDoc(doc(db,'photos',photo.id),{...photo,imageURL:'data:image/svg+xml;base64,aGVsbG8='}));
    await assertFails(setDoc(doc(db,'photos',photo.id),{...photo,imageURL:'https://example.com/private-photo.jpg'}));
    await assertFails(setDoc(doc(db,'photos',photo.id),{...photo,unexpected:'field'}));
  });


  it('allows members to publish only a valid month-day birthday without changing privileges',async()=>{
    const db=client('member');await assertSucceeds(updateDoc(doc(db,'members','member'),{birthday:'02-29'}));
    await assertSucceeds(getDoc(doc(client('creator'),'members','member')));
    await assertFails(updateDoc(doc(db,'members','member'),{birthday:'02-30'}));
    await assertFails(updateDoc(doc(db,'members','member'),{birthday:'2000-02-29'}));
    await assertFails(updateDoc(doc(db,'members','member'),{birthday:'03-15',role:'leader'}));
    await assertFails(updateDoc(doc(db,'members','member'),{birthday:'03-15',canCreatePoll:true}));
    await assertFails(updateDoc(doc(db,'members','creator'),{birthday:'03-15'}));
    await assertSucceeds(updateDoc(doc(db,'members','member'),{birthday:deleteField()}));
  });
  it('mirrors public birthday and private profile atomically while keeping phone and area out of directory documents',async()=>{
    const db=client('member');const batch=writeBatch(db);
    batch.update(doc(db,'members','member'),{name:'생일 등록',birthday:'03-15'});
    batch.set(doc(db,'profiles','member'),{id:'member',phone:'010-0000-0000',area:'테스트 지역',birthday:'03-15'});await assertSucceeds(batch.commit());
    await assertFails(updateDoc(doc(db,'members','member'),{phone:'010-0000-0000'}));
    await assertFails(updateDoc(doc(client('leader'),'members','member'),{area:'테스트 지역'}));
    await assertFails(getDoc(doc(client('creator'),'profiles','member')));
    await assertSucceeds(updateDoc(doc(client('leader'),'members','member'),{birthday:'12-31'}));
  });


  it('restricts new office assignments to canonical positions without granting authority and preserves unchanged legacy labels',async()=>{
    const db=client('leader');
    for(const position of ['회장','부회장','총무',''])await assertSucceeds(updateDoc(doc(db,'members','member'),{position}));
    await assertFails(updateDoc(doc(db,'members','member'),{position:'비품관리'}));
    await assertFails(setDoc(doc(db,'members','roster-custom'),{...member('roster-custom'),email:'',isRoster:true,position:'기쁨조'}));
    await assertFails(updateDoc(doc(client('member'),'members','member'),{position:'회장'}));
    await environment.withSecurityRulesDisabled(async context=>{await updateDoc(doc(context.firestore(),'members','member'),{position:'예전 직책'});});
    await assertSucceeds(updateDoc(doc(client('member'),'members','member'),{name:'이름만 수정',birthday:'03-15'}));
    await assertSucceeds(updateDoc(doc(db,'members','member'),{canCreatePoll:true}));
    await assertSucceeds(updateDoc(doc(db,'members','member'),{position:'총무'}));
    await assertFails(updateDoc(doc(client('member'),'members','member'),{role:'treasurer'}));
  });


  it('stores private per-account language/theme without exposing them or granting authority',async()=>{
    const db=client('member');await assertSucceeds(updateDoc(doc(db,'profiles','member'),{language:'en',theme:'dark'}));
    await assertSucceeds(updateDoc(doc(db,'profiles','member'),{language:'ko',theme:'system'}));
    await assertFails(updateDoc(doc(db,'profiles','member'),{language:'ja'}));
    await assertFails(updateDoc(doc(db,'profiles','member'),{theme:'automatic'}));
    await assertFails(updateDoc(doc(db,'profiles','creator'),{language:'en',theme:'light'}));
    await assertFails(getDoc(doc(client('creator'),'profiles','member')));
    await assertFails(updateDoc(doc(db,'profiles','member'),{language:'en',role:'leader'}));
    await assertFails(updateDoc(doc(db,'members','member'),{theme:'dark'}));
    await assertSucceeds(updateDoc(doc(db,'members','member'),{name:'개인 정보 수정',birthday:'02-29'}));
    await assertSucceeds(updateDoc(doc(db,'profiles','member'),{phone:'010-0000-0000',area:'테스트 지역',birthday:'02-29'}));
    await assertSucceeds(updateDoc(doc(client('leader'),'profiles','member'),{area:'관리자 수정 지역'}));
  });


  it('restricts explicit SMS master and automatic-confirm settings to typed admin flags',async()=>{
    const settings={name:'알림 설정',description:'',smsEnabled:false,smsAutoOnConfirm:false};
    await assertSucceeds(setDoc(doc(client('leader'),'settings','club'),settings));
    await assertFails(updateDoc(doc(client('member'),'settings','club'),{smsEnabled:true}));
    await assertFails(updateDoc(doc(client('treasurer'),'settings','club'),{smsAutoOnConfirm:true}));
    await assertFails(updateDoc(doc(client('leader'),'settings','club'),{smsEnabled:'true'}));
    await assertSucceeds(updateDoc(doc(client('leader'),'settings','club'),{smsEnabled:true,smsAutoOnConfirm:true}));
  });


  it('lets pending accounts read group content and active directory without reading other private profiles',async()=>{
    const db=client('pending');
    for(const name of ['posts','comments','polls','votes','events','rsvps','ballots','ballotResponses','mvpVotes','ledger','receipts','photos','settings','places'])await assertSucceeds(getDocs(collection(db,name)));
    await assertSucceeds(getDocs(query(collection(db,'members'),where('status','==','active'))));
    await assertSucceeds(getDoc(doc(db,'members','member')));await assertSucceeds(getDoc(doc(db,'profiles','pending')));
    await assertFails(getDoc(doc(db,'profiles','member')));await assertFails(getDocs(collection(db,'profiles')));
    await assertFails(getDocs(collection(db,'members')));await assertFails(getDoc(doc(db,'members','rejected')));
  });
  it('keeps pending accounts unable to participate or write content while allowing their own profile and preferences',async()=>{
    const db=client('pending');await assertSucceeds(updateDoc(doc(db,'members','pending'),{name:'가입 대기자',birthday:'03-15'}));await assertSucceeds(updateDoc(doc(db,'profiles','pending'),{phone:'010-0000-0000',area:'테스트 지역',birthday:'03-15',language:'en',theme:'dark'}));
    await assertFails(updateDoc(doc(db,'members','pending'),{status:'active'}));
    await assertFails(setDoc(doc(db,'posts','pending-post'),post('pending-post','pending')));
    await assertFails(updateDoc(doc(db,'posts','p1'),{likedBy:['pending']}));
    await assertFails(setDoc(doc(db,'comments','pending-comment'),{id:'pending-comment',postId:'p1',authorId:'pending',body:'댓글',createdAt:now}));
    await assertFails(setDoc(doc(db,'votes','open_pending'),{id:'open_pending',pollId:'open',memberId:'pending',slotIds:['s1'],updatedAt:now}));
    await assertFails(setDoc(doc(db,'rsvps','e1_pending'),{id:'e1_pending',eventId:'e1',memberId:'pending',status:'going',updatedAt:now}));
    await assertFails(setDoc(doc(db,'ballotResponses','venue_pending'),{id:'venue_pending',ballotId:'venue',eventId:'e1',memberId:'pending',optionId:'o1',updatedAt:now}));
    await assertFails(setDoc(doc(db,'mvpVotes','mvp-open_pending'),{id:'mvp-open_pending',eventId:'mvp-open',memberId:'pending',candidateId:'member',updatedAt:now}));
    await assertFails(updateDoc(doc(db,'ledger','l1'),{amount:20000}));
    await assertFails(setDoc(doc(db,'photos','pending-photo'),{id:'pending-photo',imageURL:'data:image/png;base64,aGVsbG8=',uploadedBy:'pending',createdAt:now}));
    await assertFails(updateDoc(doc(db,'settings','club'),{name:'무단 수정'}));
  });

  it('lets treasurers manage positive integer accounting entries without gaining member management',async()=>{
    const db=client('treasurer');
    await assertSucceeds(setDoc(doc(db,'ledger','l2'),ledger('l2')));
    await assertSucceeds(updateDoc(doc(db,'ledger','l1'),{amount:20000}));
    await assertFails(updateDoc(doc(db,'ledger','l1'),{amount:-1}));
    await assertFails(updateDoc(doc(db,'ledger','l1'),{amount:0.5}));
    await assertFails(updateDoc(doc(db,'ledger','l1'),{creatorId:'leader'}));
    await assertFails(setDoc(doc(client('member'),'ledger','l3'),ledger('l3','member')));
    await assertSucceeds(getDoc(doc(client('member'),'ledger','l1')));
    await assertFails(updateDoc(doc(db,'members','pending'),{status:'active'}));
  });

  it('supports optional bounded ledger notes with unchanged author and receipt protections',async()=>{
    const db=client('treasurer');const entry=doc(db,'ledger','l1');
    await assertSucceeds(setDoc(doc(db,'ledger','notes'),{...ledger('notes'),memo:'대관료, "현장 결제"\n다음 달 정산'}));
    await assertSucceeds(updateDoc(entry,{memo:'m'.repeat(2000)}));
    await assertSucceeds(getDoc(doc(client('pending'),'ledger','l1')));
    await assertFails(updateDoc(entry,{memo:'m'.repeat(2001)}));
    await assertFails(setDoc(doc(db,'ledger','long-notes'),{...ledger('long-notes'),memo:'m'.repeat(2001)}));
    await assertFails(updateDoc(entry,{memo:42}));
    await assertFails(updateDoc(entry,{memo:null}));
    await assertFails(updateDoc(doc(client('pending'),'ledger','l1'),{memo:'무단 수정'}));
    await assertFails(updateDoc(doc(client('member'),'ledger','l1'),{memo:'무단 수정'}));
    await assertFails(updateDoc(entry,{memo:'수정',creatorId:'leader'}));
    const receipt={entryId:'l1',fileName:'receipt.jpg',imageURL:'data:image/jpeg;base64,aGVsbG8=',uploadedBy:'treasurer',updatedAt:now};
    const attach=writeBatch(db);attach.set(doc(db,'receipts','l1'),receipt);attach.update(entry,{hasReceipt:true});await assertSucceeds(attach.commit());
    await assertSucceeds(updateDoc(entry,{memo:'영수증 첨부 후 수정'}));
    await assertFails(updateDoc(entry,{memo:'m'.repeat(2001),hasReceipt:true}));
    await assertFails(updateDoc(entry,{memo:'첨부 무단 해제',hasReceipt:false}));
    await assertSucceeds(updateDoc(entry,{memo:''}));
    await assertSucceeds(updateDoc(entry,{memo:deleteField()}));
    const remove=writeBatch(db);remove.delete(doc(db,'receipts','l1'));remove.update(entry,{hasReceipt:false});await assertSucceeds(remove.commit());
  });

  it('keeps staged files private and exposes only linked files to active and pending readers',async()=>{
    const db=client('member'),file=fileRecord('draft-file','draft-post');
    await assertSucceeds(stageFile(db,file));
    for(const reader of ['member','creator','pending']){
      await assertFails(getDoc(doc(client(reader),'postFiles',file.id)));
      await assertFails(getDoc(doc(client(reader),'postFiles',file.id,'chunks','0')));
    }
    await assertSucceeds(setDoc(doc(db,'posts','draft-post'),{...post('draft-post'),attachments:[fileReference(file)]}));
    for(const reader of ['member','creator','pending']){
      await assertSucceeds(getDoc(doc(client(reader),'postFiles',file.id)));
      await assertSucceeds(getDoc(doc(client(reader),'postFiles',file.id,'chunks','0')));
    }
    await assertFails(getDoc(doc(client('rejected'),'postFiles',file.id)));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(),'postFiles',file.id,'chunks','0')));
    await assertFails(updateDoc(doc(db,'postFiles',file.id),{name:'이름 바꾸기.bin'}));
    await assertFails(updateDoc(doc(db,'postFiles',file.id,'chunks','0'),{bytes:Bytes.fromUint8Array(new Uint8Array(3))}));
    await assertFails(removeFile(db,file.id));
  });

  it('validates complete five MiB manifests within rule access limits and bounds post references',async()=>{
    const db=client('member'),large=fileRecord('large-file','p1','member','member',5*1024*1024);
    // Node gRPC's emulator transport caps one request at 4MiB. Browser SDK integration
    // covers the atomic 5MiB upload; here seed each immutable chunk to test all seven lookups.
    await environment.withSecurityRulesDisabled(async context=>{
      for(let index=0;index<large.chunkCount;index++)await setDoc(doc(context.firestore(),'postFiles',large.id,'chunks',String(index)),{index,bytes:Bytes.fromUint8Array(new Uint8Array(Math.min(786432,large.size-index*786432)))});
    });
    await assertSucceeds(setDoc(doc(db,'postFiles',large.id),large));
    const second=fileRecord('second-file'),third=fileRecord('third-file');
    await assertSucceeds(stageFile(db,second));await assertSucceeds(stageFile(db,third));
    const attachments=[large,second,third].map(fileReference);
    await assertSucceeds(updateDoc(doc(db,'posts','p1'),{attachments}));
    await assertSucceeds(updateDoc(doc(client('creator'),'posts','p1'),{likedBy:['creator']}));
    await assertFails(updateDoc(doc(db,'posts','p1'),{attachments:[...attachments,attachments[0]]}));
    await assertFails(updateDoc(doc(db,'posts','p1'),{attachments:[attachments[0],attachments[0]]}));
    for(const change of [{name:'forged.bin'},{size:1},{mimeType:'text/plain'},{id:'missing-file'},{id:'../p1'},{unexpected:true}])await assertFails(updateDoc(doc(db,'posts','p1'),{attachments:[{...attachments[0],...change}]}));
    await assertFails(setDoc(doc(db,'posts','different-post'),{...post('different-post'),attachments:[attachments[0]]}));
    await assertFails(updateDoc(doc(client('pending'),'posts','p1'),{attachments:[]}));
    await assertFails(updateDoc(doc(client('creator'),'posts','p1'),{attachments:[]}));
  });

  it('rejects partial, forged, oversized, unapproved and unauthorized file staging',async()=>{
    const db=client('member');
    await assertFails(stageFile(db,fileRecord('partial','p1','member','member',786433),1));
    await assertFails(setDoc(doc(db,'postFiles','no-chunks'),fileRecord('no-chunks')));
    await assertFails(setDoc(doc(db,'postFiles','missing-parent','chunks','0'),{index:0,bytes:Bytes.fromUint8Array(new Uint8Array(3))}));
    await assertFails(setDoc(doc(db,'postFiles','too-large'),{...fileRecord('too-large'),size:5242881,chunkCount:7}));
    await assertFails(stageFile(db,{...fileRecord('forged-uploader'),uploadedBy:'leader'}));
    await assertFails(stageFile(db,{...fileRecord('forged-owner'),ownerId:'creator'}));
    await assertFails(stageFile(client('creator'),fileRecord('other-author','p1','member','creator')));
    await assertFails(stageFile(client('pending'),fileRecord('pending-file','p1','member','pending')));
    await assertFails(stageFile(db,fileRecord('notice-file','notice','leader','member')));
    await assertSucceeds(stageFile(client('leader'),fileRecord('notice-file','notice','leader','leader')));
    await assertFails(stageFile(db,{...fileRecord('long-name'),name:'a'.repeat(201)}));
    await assertFails(stageFile(db,{...fileRecord('extra-field'),unexpected:true} as ReturnType<typeof fileRecord>));
  });

  it('unlinks before cleanup and deletes the manifest and every chunk together',async()=>{
    const db=client('member'),file=fileRecord('cleanup-file','p1','member','leader');
    await assertSucceeds(stageFile(client('leader'),file));
    await assertSucceeds(updateDoc(doc(db,'posts','p1'),{attachments:[fileReference(file)]}));
    await assertFails(deleteDoc(doc(db,'postFiles',file.id,'chunks','0')));
    await assertFails(deleteDoc(doc(db,'postFiles',file.id)));
    await assertSucceeds(updateDoc(doc(db,'posts','p1'),{attachments:[]}));
    await assertFails(getDoc(doc(client('pending'),'postFiles',file.id)));
    await assertFails(getDoc(doc(client('pending'),'postFiles',file.id,'chunks','0')));
    await assertFails(deleteDoc(doc(db,'postFiles',file.id,'chunks','0')));
    await assertFails(deleteDoc(doc(db,'postFiles',file.id)));
    await assertFails(removeFile(client('creator'),file.id));
    await assertSucceeds(removeFile(db,file.id));
    await environment.withSecurityRulesDisabled(async context=>{
      expect((await getDoc(doc(context.firestore(),'postFiles',file.id))).exists()).toBe(false);
      expect((await getDocs(collection(context.firestore(),'postFiles',file.id,'chunks'))).empty).toBe(true);
    });
    const removedPostFile=fileRecord('deleted-post-file');
    await assertSucceeds(stageFile(db,removedPostFile));
    await assertSucceeds(updateDoc(doc(db,'posts','p1'),{attachments:[fileReference(removedPostFile)]}));
    await assertSucceeds(deleteDoc(doc(db,'posts','p1')));
    await assertFails(getDoc(doc(db,'postFiles',removedPostFile.id)));
    await assertSucceeds(removeFile(db,removedPostFile.id));
  });
});
