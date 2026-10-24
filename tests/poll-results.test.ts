import { describe, expect, it } from 'vitest';
import { formatPollDuration, getPollAvailabilityWindows, sortPollResults } from '../src/lib/poll-results';
import type { PollSlot, Vote } from '../src/lib/types';

const date = '2026-10-31';
const slots = (day = date, hours = [18,19,20,21]): PollSlot[] => hours.map(hour => ({ id:`${day}-${hour}`,date:day,start:`${hour}:00`,end:`${hour + 1}:00` }));
const vote = (memberId:string, slotIds:string[], updatedAt = '2026-10-24T12:00:00.000Z'): Vote => ({ id:`p1_${memberId}`,pollId:'p1',memberId,slotIds,updatedAt });
const example = () => {
  const candidates = slots();
  const votes = [vote('A',candidates.slice(0,3).map(slot => slot.id)),vote('B',candidates.slice(0,2).map(slot => slot.id)),vote('C',candidates.slice(1,4).map(slot => slot.id))];
  return { poll:{ id:'p1',slots:candidates },votes };
};
const summary = (result:ReturnType<typeof getPollAvailabilityWindows>) => result.map(window => [window.start,window.end,window.durationMinutes,window.memberIds.join('')]);

describe('continuous poll results', () => {
  it('retains both two-hour cohorts and the shorter three-person cohort', () => {
    const {poll,votes} = example();
    const result = getPollAvailabilityWindows(poll,votes,2);
    expect(summary(result)).toEqual([['18:00','20:00',120,'AB'],['19:00','21:00',120,'AC'],['19:00','20:00',60,'ABC']]);
    expect(result[0].startSlotId).toBe(`${date}-18`);
    expect(result[0].endSlotId).toBe(`${date}-19`);
    expect(result[1].endSlotId).toBe(`${date}-20`);
  });
  it('removes contained ranges only for the same exact participant set', () => {
    const candidates = slots();
    const votes = [vote('A',candidates.map(slot => slot.id)),vote('B',candidates.map(slot => slot.id)),vote('C',[candidates[1].id])];
    expect(summary(getPollAvailabilityWindows({id:'p1',slots:candidates},votes,2))).toEqual([['18:00','22:00',240,'AB'],['19:00','20:00',60,'ABC']]);
  });
  it('never bridges a missing candidate hour or joins different dates', () => {
    const candidates = [...slots(date,[18,20]),...slots('2026-11-01',[18])];
    const votes = [vote('A',candidates.map(slot => slot.id)),vote('B',candidates.map(slot => slot.id))];
    const result = getPollAvailabilityWindows({id:'p1',slots:candidates},votes,2);
    expect(result.map(window => [window.date,window.start,window.end])).toEqual([[date,'18:00','19:00'],[date,'20:00','21:00'],['2026-11-01','18:00','19:00']]);
  });
  it('sorts by duration by default and by cohort size when requested', () => {
    const {poll,votes} = example();
    const result = getPollAvailabilityWindows(poll,votes,2);
    expect(sortPollResults(result,'participants').map(window => window.memberIds.join(''))).toEqual(['ABC','AB','AC']);
    expect(result.map(window => window.memberIds.join(''))).toEqual(['AB','AC','ABC']);
  });
  it('filters the number of people across the entire range', () => {
    const {poll,votes} = example();
    expect(summary(getPollAvailabilityWindows(poll,votes,3))).toEqual([['19:00','20:00',60,'ABC']]);
    expect(getPollAvailabilityWindows(poll,votes,4)).toEqual([]);
  });
  it('keeps single-person windows when there is no shared availability', () => {
    const candidates = slots(date,[18,19]);
    const votes = [vote('A',[candidates[0].id]),vote('B',[candidates[1].id]),vote('C',[])];
    expect(getPollAvailabilityWindows({id:'p1',slots:candidates},votes,2)).toEqual([]);
    expect(summary(getPollAvailabilityWindows({id:'p1',slots:candidates},votes,1))).toEqual([['18:00','19:00',60,'A'],['19:00','20:00',60,'B']]);
  });
  it('uses the latest response per person and ignores removed candidate ids', () => {
    const candidates = slots(date,[18,19]);
    const votes = [vote('A',candidates.map(slot => slot.id),'2026-10-23T12:00:00.000Z'),vote('A',[candidates[1].id,'removed']),vote('B',candidates.map(slot => slot.id)),{...vote('X',candidates.map(slot => slot.id)),pollId:'another-poll'}];
    expect(summary(getPollAvailabilityWindows({id:'p1',slots:candidates},votes,2))).toEqual([['19:00','20:00',60,'AB']]);
    expect(getPollAvailabilityWindows({id:'p1',slots:candidates},[])).toEqual([]);
  });
  it('reads older broad candidate slots and formats their full duration', () => {
    const candidates = [{id:'old',date,start:'14:00',end:'16:30'}];
    const result = getPollAvailabilityWindows({id:'p1',slots:candidates},[vote('A',['old']),vote('B',['old'])],2);
    expect(result[0].durationMinutes).toBe(150);
    expect(formatPollDuration(result[0].durationMinutes)).toBe('2시간 30분');
  });
});
