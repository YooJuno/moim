import { describe, expect, it } from 'vitest';
import { contiguousEndSlots, expandTimeWindows, pollTimeWindows } from '../src/lib/poll-times';
import type { Poll, PollSlot } from '../src/lib/types';

const window = (id: string, date = '2026-10-31', start = '18:00', end = '21:00'): PollSlot => ({ id, date, start, end });

describe('availability time windows', () => {
  it('splits 18–21 into six 30-minute cells and keeps unchanged cell identities', () => {
    const slots = expandTimeWindows([window('w1')], 30);
    expect(slots.map(slot => `${slot.start}-${slot.end}`)).toEqual(['18:00-18:30','18:30-19:00','19:00-19:30','19:30-20:00','20:00-20:30','20:30-21:00']);
    expect(expandTimeWindows([window('w1')], 30, slots).map(slot => slot.id)).toEqual(slots.map(slot => slot.id));
    const extended = expandTimeWindows([window('w1', undefined, '17:30', '21:30')], 30, slots);
    expect(extended.slice(1, -1).map(slot => slot.id)).toEqual(slots.map(slot => slot.id));
  });
  it('supports independent windows by date and optional hourly cells', () => {
    const slots = expandTimeWindows([window('w1'), window('w2', '2026-11-01', '15:00', '17:00')], 30);
    expect(slots.filter(slot => slot.date === '2026-10-31')).toHaveLength(6);
    expect(slots.filter(slot => slot.date === '2026-11-01')).toHaveLength(4);
    expect(expandTimeWindows([window('w1')], 60)).toHaveLength(3);
    expect(() => expandTimeWindows([window('w1', undefined, '18:30', '20:30')], 60)).toThrow('1시간');
  });
  it('rejects overlapping windows and incomplete selectable units', () => {
    expect(() => expandTimeWindows([window('a'), window('b', undefined, '20:00', '22:00')], 30)).toThrow('겹치는');
    expect(() => expandTimeWindows([window('a', undefined, '18:15', '21:00')], 30)).toThrow('30분');
    expect(() => expandTimeWindows([window('a', undefined, '18:00', '19:30')], 60)).toThrow('1시간');
    expect(() => expandTimeWindows([window('a', undefined, '21:00', '18:00')], 30)).toThrow('시작');
    expect(expandTimeWindows([window('a', undefined, '18:00', '19:00'), window('b', undefined, '19:00', '21:00')], 30)).toHaveLength(6);
  });
  it('reconstructs old segmented polls and respects stored per-date source windows', () => {
    const slots = expandTimeWindows([window('w1')], 30);
    const base = { slots, slotMinutes:30 } as Poll;
    expect(pollTimeWindows(base)).toEqual([{ ...slots[0], end:'21:00' }]);
    const separate = [window('w1', undefined, '18:00', '19:00'), window('w2', undefined, '19:00', '21:00')];
    expect(pollTimeWindows({ ...base, timeWindows:separate })).toEqual(separate);
    expect(pollTimeWindows({ slots:[window('legacy')] } as Poll)).toEqual([window('legacy')]);
  });
  it('offers confirmation end times only while candidate cells stay contiguous on the same date', () => {
    const slots = expandTimeWindows([window('a', undefined, '18:00', '19:30'), window('b', undefined, '20:00', '21:00'), window('c', '2026-11-01')], 30);
    expect(contiguousEndSlots(slots, slots[0].id).map(slot => slot.end)).toEqual(['18:30','19:00','19:30']);
    expect(contiguousEndSlots(slots, slots[1].id).map(slot => slot.end)).toEqual(['19:00','19:30']);
  });
});
