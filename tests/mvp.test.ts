import { describe, expect, it } from 'vitest';
import { mvpWindow } from '../src/lib/mvp';
const event={id:'e',title:'모임',description:'',date:'2026-10-24',start:'18:00',end:'21:00',location:'서울',creatorId:'leader',createdAt:''};
describe('MVP voting window', () => {
  it('opens exactly when the Korean meeting ends', () => {
    expect(mvpWindow(event, Date.parse('2026-10-24T20:50:00+09:00')).isOpen).toBe(false);
    expect(mvpWindow(event, Date.parse('2026-10-24T20:59:59.999+09:00')).isOpen).toBe(false);
    expect(mvpWindow(event, Date.parse('2026-10-24T21:00:00+09:00')).isOpen).toBe(true);
  });
  it('closes at the one-hour boundary without a grace period', () => {
    expect(mvpWindow(event, Date.parse('2026-10-24T21:59:59.999+09:00')).isOpen).toBe(true);
    expect(mvpWindow(event, Date.parse('2026-10-24T22:00:00+09:00'))).toMatchObject({isOpen:false,isClosed:true});
    expect(mvpWindow(event, Date.parse('2026-10-25T20:59:59+09:00')).isClosed).toBe(true);
  });
  it('handles midnight endings and ignores the browser timezone', () => {
    const midnight = {...event,end:'24:00'};
    expect(mvpWindow(midnight, Date.parse('2026-10-24T15:00:00Z')).isOpen).toBe(true);
    expect(mvpWindow(midnight, Date.parse('2026-10-24T16:00:00Z'))).toMatchObject({isOpen:false,isClosed:true});
  });
});
