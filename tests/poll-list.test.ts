import { describe, expect, it } from 'vitest';
import { isPollOpen, sortOpenPolls } from '../src/lib/poll-list';
import type { Poll, Vote } from '../src/lib/types';
const now = Date.parse('2026-11-12T12:00:00+09:00');
const poll = (id:string, deadline:string|null, createdAt='2026-11-01T00:00:00Z'):Poll => ({id,title:id,description:'',slots:[],slotIds:[],deadline,createdAt,updatedAt:createdAt,status:'open',creatorId:'admin'});
const vote:Vote={id:'answered_me',pollId:'answered',memberId:'me',slotIds:[],updatedAt:'2026-11-12T00:00:00Z'};
describe('poll list priorities',()=>{
  it('keeps unanswered polls before answered polls, then orders by deadline and creation date',()=>{
    const polls=[poll('answered','2026-11-12T12:01:00+09:00'),poll('no-limit-old',null),poll('later','2026-11-15T12:00:00+09:00'),poll('soon','2026-11-13T12:00:00+09:00'),poll('no-limit-new',null,'2026-11-12T00:00:00Z')];
    const original=polls.slice();
    expect(sortOpenPolls(polls,[vote],'me',true,now).map(p=>p.id)).toEqual(['soon','later','no-limit-new','no-limit-old','answered']);
    expect(polls).toEqual(original);
  });
  it('uses deadline order for read-only users and ignores responses from other users',()=>{
    const polls=[poll('later',null),poll('answered','2026-11-13T12:00:00+09:00')];
    expect(sortOpenPolls(polls,[vote],'me',false,now).map(p=>p.id)).toEqual(['answered','later']);
    expect(sortOpenPolls(polls,[vote],'other',true,now).map(p=>p.id)).toEqual(['answered','later']);
  });
  it('excludes closed, confirmed and expired polls exactly at the deadline',()=>{
    const deadline='2026-11-12T12:00:00+09:00';
    const open=poll('deadline',deadline);
    expect(isPollOpen(open,now-1)).toBe(true);expect(isPollOpen(open,now)).toBe(false);
    expect(sortOpenPolls([open,{...poll('closed',null),status:'closed'},{...poll('confirmed',null),status:'confirmed'},poll('open',null)],[],'me',true,now).map(p=>p.id)).toEqual(['open']);
  });
});
