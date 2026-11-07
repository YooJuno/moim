import { expect, it } from 'vitest';
import { buildPollGridIndex, slotPosition } from '../src/lib/poll-grid';
it('indexes date overrides, gaps, stale choices and each voter only once per slot',()=>{
  const slots=[{id:'a',date:'2026-12-05',start:'08:00',end:'09:00'},{id:'b',date:'2026-12-05',start:'10:00',end:'11:00'},{id:'c',date:'2026-12-06',start:'12:00',end:'13:00'}];
  const vote=(id:string,slotIds:string[])=>({id,pollId:'p',memberId:id,slotIds,updatedAt:''});
  const grid=buildPollGridIndex(slots,[vote('one',['a','a','c','removed']),vote('two',['a','b'])]);
  expect(grid.dates).toEqual(['2026-12-05','2026-12-06']);expect(grid.dayIds.get('2026-12-05')).toEqual(['a','b']);expect(grid.slotAt.get(slotPosition('2026-12-05','09:00','10:00'))).toBeUndefined();
  expect(grid.voters.get('a')?.map(v=>v.memberId)).toEqual(['one','two']);expect(grid.voters.has('removed')).toBe(false);expect(grid.topCount).toBe(2);
});
