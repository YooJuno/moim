import type { Poll, PollSlot } from './types';
import { uid } from './utils';

export const timeToMinutes = (value: string) => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; };
const minutesToTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

/** Original windows keep the editor compact; older segmented polls can be reconstructed. */
export function pollTimeWindows(poll: Poll | undefined): PollSlot[] {
  if (!poll) return [];
  if (poll.timeWindows?.length) return poll.timeWindows.map(window => ({ ...window }));
  const ordered = poll.slots.slice().sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  if (!poll.slotMinutes) return ordered.map(slot => ({ ...slot }));
  const windows: PollSlot[] = [];
  for (const slot of ordered) {
    const previous = windows[windows.length - 1];
    if (previous && previous.date === slot.date && previous.end === slot.start) previous.end = slot.end;
    else windows.push({ ...slot });
  }
  return windows;
}

export function expandTimeWindows(windows: PollSlot[], unit: 30 | 60, previousSlots: PollSlot[] = []): PollSlot[] {
  const ordered = windows.slice().sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const slots: PollSlot[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const window = ordered[index]; const start = timeToMinutes(window.start); const end = timeToMinutes(window.end);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(window.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.start) || !/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(window.end) || end <= start) throw new Error('후보 날짜와 시작·종료 시간을 확인해 주세요.');
    if (start % unit || end % unit || (end - start) % unit) throw new Error(`${unit === 60 ? '1시간' : '30분'} 단위의 시작·종료 시간을 입력해 주세요.`);
    const previous = ordered[index - 1];
    if (previous && previous.date === window.date && previous.end > window.start) throw new Error('같은 날짜에 겹치는 시간대가 있어요.');
    for (let minute = start; minute < end; minute += unit) {
      const segmentStart = minutesToTime(minute); const segmentEnd = minutesToTime(minute + unit);
      const original = previousSlots.find(slot => slot.date === window.date && slot.start === segmentStart && slot.end === segmentEnd);
      slots.push({ id: original?.id ?? uid(), date: window.date, start: segmentStart, end: segmentEnd });
    }
  }
  return slots;
}

export function contiguousEndSlots(slots: PollSlot[], startId: string): PollSlot[] {
  const start = slots.find(slot => slot.id === startId);
  if (!start) return [];
  const ordered = slots.filter(slot => slot.date === start.date && slot.start >= start.start).sort((a, b) => a.start.localeCompare(b.start));
  const result: PollSlot[] = [start];
  let end = start.end;
  for (const slot of ordered) {
    if (slot.id === start.id || slot.start < end) continue;
    if (slot.start !== end) break;
    result.push(slot); end = slot.end;
  }
  return result;
}
