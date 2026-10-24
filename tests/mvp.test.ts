import { describe,expect,it } from 'vitest';
import { mvpWindow } from '../src/lib/mvp';
const event={id:'e',title:'모임',description:'',date:'2026-10-24',start:'18:00',end:'21:00',location:'서울',creatorId:'leader',createdAt:''};
describe('MVP voting window',()=>{
 it('opens exactly10minutes before Korean meeting end',()=>{expect(mvpWindow(event,new Date('2026-10-24T20:49:59+09:00').getTime()).isOpen).toBe(false);expect(mvpWindow(event,new Date('2026-10-24T20:50:00+09:00').getTime()).isOpen).toBe(true);});
 it('closes24hours after end',()=>{expect(mvpWindow(event,new Date('2026-10-25T20:59:59+09:00').getTime()).isOpen).toBe(true);expect(mvpWindow(event,new Date('2026-10-25T21:00:00+09:00').getTime()).isClosed).toBe(true);});
});
