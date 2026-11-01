import {describe,expect,it} from 'vitest';
import {pendingEventInvitations} from '../src/lib/event-invitations';
import type {MoimEvent,Rsvp} from '../src/lib/types';
const now=new Date(2026,10,1,10,0);
const event=(id:string,patch:Partial<MoimEvent>={}):MoimEvent=>({id,title:id,description:'',date:'2026-11-01',start:'12:00',end:'14:00',location:'서울',creatorId:'admin',createdAt:'2026-10-31',invitedMemberIds:['me'],...patch});
const reply=(eventId:string,memberId='me',status:Rsvp['status']='going'):Rsvp=>({id:`${eventId}_${memberId}`,eventId,memberId,status,updatedAt:'2026-11-01'});
describe('event invitations',()=>{
 it('shows only unresponded upcoming invitations for this member in time order',()=>{
  const events=[event('later',{date:'2026-11-02'}),event('today'),event('past',{end:'09:00'}),event('other',{invitedMemberIds:['other']}),event('legacy',{invitedMemberIds:undefined}),event('accepted'),event('declined')];
  const replies=[reply('accepted'),reply('declined','me','notGoing'),reply('today','other')];
  expect(pendingEventInvitations(events,replies,'me',now).map(e=>e.id)).toEqual(['today','later']);
  expect(pendingEventInvitations(events,replies,undefined,now)).toEqual([]);
 });
 it('keeps midnight events pending until the next day',()=>{
  const events=[event('midnight',{end:'24:00'})];
  expect(pendingEventInvitations(events,[],'me',new Date(2026,10,1,23,59))).toHaveLength(1);
  expect(pendingEventInvitations(events,[],'me',new Date(2026,10,2,0,0))).toHaveLength(0);
 });
});
