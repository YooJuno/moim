import type { Poll, PollSlot, Vote } from './types';
import { timeToMinutes } from './poll-times';

export interface PollAvailabilityWindow {
  date: string;
  start: string;
  end: string;
  durationMinutes: number;
  memberIds: string[];
  startSlotId: string;
  endSlotId: string;
}
export type PollResultSort = 'duration' | 'participants';

export function sortPollResults(windows: PollAvailabilityWindow[], order: PollResultSort = 'duration'): PollAvailabilityWindow[] {
  return windows.slice().sort((a, b) => {
    const duration = b.durationMinutes - a.durationMinutes;
    const participants = b.memberIds.length - a.memberIds.length;
    return (order === 'participants' ? participants || duration : duration || participants)
      || a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.end.localeCompare(b.end)
      || a.memberIds.join('\0').localeCompare(b.memberIds.join('\0'));
  });
}

/** Each result keeps the same participants available throughout its entire time range. */
export function getPollAvailabilityWindows(poll: Pick<Poll, 'id' | 'slots'>, votes: Vote[], minParticipants = 1): PollAvailabilityWindow[] {
  const minimum = Number.isFinite(minParticipants) ? Math.max(1, Math.ceil(minParticipants)) : 1;
  const latest = new Map<string, Vote>();
  for (const vote of votes) {
    if (vote.pollId !== poll.id) continue;
    const previous = latest.get(vote.memberId);
    if (!previous || vote.updatedAt >= previous.updatedAt) latest.set(vote.memberId, vote);
  }
  const available = new Map<string, Set<string>>();
  for (const vote of latest.values()) for (const slotId of new Set(vote.slotIds)) {
    const members = available.get(slotId) ?? new Set<string>(); members.add(vote.memberId); available.set(slotId, members);
  }
  const byDate = new Map<string, PollSlot[]>();
  for (const slot of poll.slots) {
    if (!(timeToMinutes(slot.end) > timeToMinutes(slot.start))) continue;
    const slots = byDate.get(slot.date) ?? []; slots.push(slot); byDate.set(slot.date, slots);
  }
  const cohorts = new Map<string, PollAvailabilityWindow[]>();
  const seen = new Set<string>();
  for (const [date, candidates] of byDate) {
    const slots = candidates.slice().sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id));
    for (let first = 0; first < slots.length; first++) {
      let members = new Set(available.get(slots[first].id) ?? []);
      for (let last = first; last < slots.length; last++) {
        if (last > first) {
          if (slots[last - 1].end !== slots[last].start) break;
          const current = available.get(slots[last].id);
          members = new Set([...members].filter(id => current?.has(id)));
        }
        if (members.size < minimum) break;
        const memberIds = [...members].sort();
        const start = slots[first].start; const end = slots[last].end;
        const fingerprint = JSON.stringify([date, start, end, memberIds]);
        if (seen.has(fingerprint)) continue;
        seen.add(fingerprint);
        const result: PollAvailabilityWindow = { date, start, end, durationMinutes:timeToMinutes(end) - timeToMinutes(start), memberIds, startSlotId:slots[first].id, endSlotId:slots[last].id };
        const key = JSON.stringify([date, memberIds]);
        const group = cohorts.get(key) ?? []; group.push(result); cohorts.set(key, group);
      }
    }
  }
  const maximal: PollAvailabilityWindow[] = [];
  for (const group of cohorts.values()) {
    // Earlier starts with later ends contain shorter windows for this exact cohort only.
    group.sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
    let furthestEnd = '';
    for (const window of group) {
      if (window.end <= furthestEnd) continue;
      maximal.push(window); furthestEnd = window.end;
    }
  }
  return sortPollResults(maximal);
}

export function formatPollDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60); const remainder = minutes % 60;
  return [hours ? `${hours}시간` : '', remainder ? `${remainder}분` : ''].filter(Boolean).join(' ') || '0분';
}
