import { describe, expect, it } from 'vitest';
import { monthlyPollDates, monthlyPollTitle, nextPollMonth } from '../src/lib/poll-presets';
import { expandTimeWindows } from '../src/lib/poll-times';

describe('monthly availability preset', () => {
  it('starts in the next calendar month and generates its functional title', () => {
    expect(nextPollMonth(new Date(2026, 9, 24))).toBe('2026-11');
    expect(nextPollMonth(new Date(2026, 11, 31))).toBe('2027-01');
    expect(monthlyPollTitle('2026-11')).toBe('2026년 11월 일정 취합');
  });
  it('selects every November 2026 weekend once', () => {
    expect(monthlyPollDates('2026-11')).toEqual(['2026-11-01','2026-11-07','2026-11-08','2026-11-14','2026-11-15','2026-11-21','2026-11-22','2026-11-28','2026-11-29']);
  });
  it('includes weekday public holidays, deduplicates weekend holidays and excludes past dates', () => {
    const dates = monthlyPollDates('2026-05', '2026-05-01');
    expect(dates).toContain('2026-05-05');
    expect(dates).toContain('2026-05-24');
    expect(dates).toContain('2026-05-25');
    expect(dates.filter(date => date === '2026-05-24')).toHaveLength(1);
    expect(monthlyPollDates('2026-05', '2026-05-26')).toEqual(['2026-05-30','2026-05-31']);
  });
  it('requires known holiday data and a valid month instead of guessing', () => {
    expect(() => monthlyPollDates('2028-01')).toThrow('공휴일 정보');
    expect(() => monthlyPollDates('2026-13')).toThrow('취합할 월');
  });
  it('splits the 08:00–24:00 window into sixteen whole-hour cells', () => {
    const cells = expandTimeWindows([{id:'window',date:'2026-11-01',start:'08:00',end:'24:00'}],60);
    expect(cells).toHaveLength(16);
    expect(cells[0]).toMatchObject({start:'08:00',end:'09:00'});
    expect(cells.at(-1)).toMatchObject({start:'23:00',end:'24:00'});
    expect(() => expandTimeWindows([{id:'bad',date:'2026-11-01',start:'24:00',end:'24:00'}],60)).toThrow('시작');
    expect(() => expandTimeWindows([{id:'bad',date:'2026-11-01',start:'23:00',end:'24:30'}],30)).toThrow('시작');
  });
});
