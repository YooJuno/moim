import { describe,expect,it } from 'vitest';
import type { Member } from '../src/lib/types';
import { birthdaysInMonth,birthdaysOnDate,koreaDate,upcomingBirthdays } from '../src/lib/birthdays';
const member=(id:string,birthday?:string,status:Member['status']='active'):Member=>({id,name:id,email:'',role:'member',status,canCreatePoll:false,joinedAt:'',birthday});
describe('recurring birthdays',()=>{
 it('orders future dates across year boundaries and includes today',()=>{const results=upcomingBirthdays([member('new','01-01'),member('today','12-31'),member('old','12-30')],'2026-12-31');expect(results.map(value=>[value.member.id,value.date,value.daysUntil])).toEqual([['today','2026-12-31',0],['new','2027-01-01',1],['old','2027-12-30',364]]);});
 it('does not invent February29 in a nonleap year',()=>{expect(birthdaysInMonth([member('leap','02-29')],'2027-02')).toEqual([]);expect(upcomingBirthdays([member('leap','02-29')],'2026-10-24')[0].date).toBe('2028-02-29');});
 it('ignores missing invalid and pending birth dates',()=>{expect(upcomingBirthdays([member('none'),member('invalid','13-01'),member('pending','11-01','pending')],'2026-10-24')).toEqual([]);expect(birthdaysOnDate([member('yes','10-24'),member('no','10-24','pending')],'2026-10-24').map(value=>value.id)).toEqual(['yes']);});
 it('uses Korean day even when UTC is the prior date',()=>{expect(koreaDate(new Date('2026-10-23T16:00:00Z'))).toBe('2026-10-24');});
});
